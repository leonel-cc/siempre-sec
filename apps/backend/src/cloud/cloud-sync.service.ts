import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ChildProcess, spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { EntityManager, LessThanOrEqual, Repository } from 'typeorm';
import {
  CloudEventTransportInput,
  PersistedCloudEventInput,
  PhoneRecipientTransport,
  PhoneRecipientsGetMessage,
  PhoneRecipientsResultMessage,
} from '@security-ai/shared';
import { CamerasService } from '../cameras/cameras.service';
import { Event } from '../events/entities/event.entity';
import { CloudOutbox } from './entities/cloud-outbox.entity';

const SYNC_INTERVAL_MS = 5_000;
const DEVICE_SYNC_INTERVAL_MS = 60_000;
const PHONE_RECIPIENTS_TIMEOUT_MS = 2_000;
const MAX_PHONE_RECIPIENTS = 100;
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALERT_EVENT_TYPES = new Set(['WEAPON_DETECTED', 'FACE_COVERED']);

export function validatePhoneRecipients(value: unknown): PhoneRecipientTransport[] {
  if (!Array.isArray(value)) {
    throw new Error('Secure phone recipient response must contain a recipients array');
  }
  if (value.length > MAX_PHONE_RECIPIENTS) {
    throw new Error(`Secure phone recipient response exceeds the ${MAX_PHONE_RECIPIENTS} recipient limit`);
  }
  return value.map((recipient, index) => {
    if (!recipient || typeof recipient !== 'object') {
      throw new Error(`Secure phone recipient at index ${index} is invalid`);
    }
    const candidate = recipient as Partial<PhoneRecipientTransport>;
    if (typeof candidate.recipientId !== 'string' || !UUID_PATTERN.test(candidate.recipientId)) {
      throw new Error(`Secure phone recipient at index ${index} has an invalid UUID`);
    }
    if (typeof candidate.phone !== 'string' || !E164_PATTERN.test(candidate.phone)) {
      throw new Error(`Secure phone recipient at index ${index} has an invalid E.164 phone number`);
    }
    return { recipientId: candidate.recipientId, phone: candidate.phone };
  });
}

interface ActivePublisher {
  process: ChildProcess;
  stopTimer: NodeJS.Timeout;
  expiresAt: number;
}

@Injectable()
export class CloudSyncService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(CloudSyncService.name);
  private readonly cloudUrl: string;
  private readonly installationId: string;
  private readonly installationSecret: string;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private shuttingDown = false;
  private lastDeviceSync = 0;
  private readonly publishers = new Map<string, ActivePublisher>();

  constructor(
    config: ConfigService,
    private readonly cameras: CamerasService,
    @InjectRepository(CloudOutbox)
    private readonly outbox: Repository<CloudOutbox>,
  ) {
    this.cloudUrl = (config.get<string>('CLOUD_API_URL') || '').replace(/\/$/, '');
    this.installationId = config.get<string>('CLOUD_INSTALLATION_ID') || '';
    this.installationSecret = config.get<string>('CLOUD_INSTALLATION_SECRET') || '';
  }

  get enabled(): boolean {
    return Boolean(this.cloudUrl && this.installationId && this.installationSecret);
  }

  onApplicationBootstrap() {
    if (!this.enabled) {
      this.logger.log('Cloud sync disabled; installation is not enrolled');
      return;
    }
    void this.runCycle();
    this.timer = setInterval(() => void this.runCycle(), SYNC_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    this.shuttingDown = true;
    if (this.timer) clearInterval(this.timer);
    for (const publisher of this.publishers.values()) {
      clearTimeout(publisher.stopTimer);
      publisher.process.kill();
    }
    this.publishers.clear();
  }

  async enqueueEvent(
    event: Event,
    metadata: Record<string, unknown>,
    manager?: EntityManager,
  ): Promise<void> {
    if (!this.enabled) return;
    const payload: PersistedCloudEventInput = {
      localEventId: event.id,
      localCameraId: event.cameraId,
      eventType: event.eventType,
      occurredAt: event.timestamp,
      metadata: {
        confidence: event.confidence,
        severity: metadata.severity,
        ruleName: metadata.rule_name,
        threatClass: metadata.threat_class,
      },
    };
    await (manager?.getRepository(CloudOutbox) ?? this.outbox).upsert(
      {
        idempotencyKey: `event:${event.id}`,
        kind: 'event',
        payload: JSON.stringify(payload),
        attempts: 0,
        nextAttemptAt: new Date(),
        lastError: null,
      },
      ['idempotencyKey'],
    );
  }

  private async runCycle() {
    if (this.running) return;
    this.running = true;
    try {
      if (Date.now() - this.lastDeviceSync >= DEVICE_SYNC_INTERVAL_MS) {
        await this.syncDevice();
        this.lastDeviceSync = Date.now();
      }
      await this.processCommands();
      await this.flushOutbox();
    } catch (error) {
      this.logger.warn(`Cloud synchronization failed: ${this.errorMessage(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async syncDevice() {
    await this.post('/v1/installations/me/heartbeat', {});
    const cameras = await this.cameras.findAll();
    await this.post('/v1/installations/me/cameras/sync', {
      cameras: cameras.map((camera) => ({
        localCameraId: camera.id,
        displayName: camera.name,
        capabilities: {
          liveView: true,
          audio: false,
          ptz: false,
          events: true,
        },
        enabled: camera.enabled,
      })),
    });
  }

  private async flushOutbox() {
    const pending = await this.outbox.find({
      where: { nextAttemptAt: LessThanOrEqual(new Date()) },
      order: { createdAt: 'ASC' },
      take: 20,
    });
    for (const item of pending) {
      try {
        if (item.kind === 'event') {
          const payload = JSON.parse(item.payload) as PersistedCloudEventInput;
          let transportPayload: CloudEventTransportInput = payload;
          if (ALERT_EVENT_TYPES.has(payload.eventType)) {
            const recipients = await this.requestPhoneRecipients();
            if (recipients.length) transportPayload = { ...payload, recipients };
          }
          await this.post('/v1/installations/me/events', transportPayload);
        }
        await this.outbox.remove(item);
      } catch (error) {
        item.attempts += 1;
        item.lastError = this.errorMessage(error).slice(0, 500);
        const delay = Math.min(5 * 2 ** Math.min(item.attempts, 8), 900);
        item.nextAttemptAt = new Date(Date.now() + delay * 1000);
        await this.outbox.save(item);
      }
    }
  }

  private requestPhoneRecipients(): Promise<PhoneRecipientTransport[]> {
    const required = process.env.PHONE_RECIPIENTS_IPC_REQUIRED === '1';
    const send = process.send;
    if (typeof send !== 'function' || !process.connected) {
      return required
        ? Promise.reject(new Error('Secure phone recipient channel is unavailable'))
        : Promise.resolve([]);
    }

    const requestId = randomUUID();
    const request: PhoneRecipientsGetMessage = { type: 'phone-recipients:get', requestId };
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (recipients: PhoneRecipientTransport[]) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        process.off('message', onMessage);
        resolve(recipients);
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        process.off('message', onMessage);
        if (required) reject(error);
        else resolve([]);
      };
      const onMessage = (message: unknown) => {
        if (!message || typeof message !== 'object') return;
        const result = message as Partial<PhoneRecipientsResultMessage>;
        if (result.type !== 'phone-recipients:result' || result.requestId !== requestId) return;
        try {
          finish(validatePhoneRecipients(result.recipients));
        } catch (error) {
          settled = true;
          clearTimeout(timer);
          process.off('message', onMessage);
          reject(error);
        }
      };
      const timer = setTimeout(
        () => fail(new Error('Secure phone recipient request timed out')),
        PHONE_RECIPIENTS_TIMEOUT_MS,
      );
      process.on('message', onMessage);
      try {
        send.call(process, request, (error) => {
          if (error) fail(new Error(`Secure phone recipient request failed: ${error.message}`));
        });
      } catch (error) {
        fail(new Error(`Secure phone recipient request failed: ${this.errorMessage(error)}`));
      }
    });
  }

  private async processCommands() {
    const commands = await this.get<Array<{
      id: string;
      type: string;
      payload: Record<string, unknown>;
    }>>('/v1/installations/me/commands');
    for (const command of commands) {
      let status: 'ACKNOWLEDGED' | 'FAILED' = 'ACKNOWLEDGED';
      let error: string | undefined;
      try {
        if (command.type !== 'START_LIVE') {
          throw new Error(`Unsupported remote command: ${command.type}`);
        }
        await this.startLivePublisher(command.payload);
      } catch (executionError) {
        status = 'FAILED';
        error = this.errorMessage(executionError).slice(0, 500);
        this.logger.warn(`Remote command ${command.id} failed: ${error}`);
      }
      await this.post(`/v1/installations/me/commands/${command.id}/ack`, { status, error });
    }
  }

  private async startLivePublisher(
    payload: Record<string, unknown>,
    superviseUntil?: number,
  ): Promise<void> {
    const localCameraId = typeof payload.localCameraId === 'string' ? payload.localCameraId : '';
    const publishUrl = typeof payload.publishUrl === 'string' ? payload.publishUrl : '';
    const streamKey = typeof payload.streamKey === 'string' ? payload.streamKey : '';
    if (!/^[a-zA-Z0-9-]{1,160}$/.test(localCameraId) || !streamKey) {
      throw new Error('Invalid live publication command');
    }
    const parsedUrl = new URL(publishUrl);
    if (!['rtmp:', 'rtmps:'].includes(parsedUrl.protocol)) {
      throw new Error('Live publication URL must use RTMP');
    }
    let ttlSeconds = typeof payload.publisherTtlSeconds === 'number'
      ? Math.max(1, Math.min(payload.publisherTtlSeconds, 15 * 60))
      : 5 * 60;
    if (superviseUntil) {
      ttlSeconds = Math.min(ttlSeconds, Math.max(1, Math.ceil((superviseUntil - Date.now()) / 1000)));
    }
    const existing = this.publishers.get(localCameraId);
    if (existing && existing.process.exitCode === null && existing.process.signalCode === null) {
      clearTimeout(existing.stopTimer);
      existing.stopTimer = this.publisherStopTimer(localCameraId, existing.process, ttlSeconds);
      existing.expiresAt = Date.now() + ttlSeconds * 1000;
      return;
    }

    const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
    const sourceUrl = `http://127.0.0.1:5000/sources/${localCameraId}/stream?view=raw&fps=20`;
    const targetUrl = `${publishUrl.replace(/\/$/, '')}/${encodeURIComponent(streamKey)}`;
    const publisher = spawn(ffmpeg, [
      '-hide_banner',
      '-loglevel', 'warning',
      '-nostats',
      '-progress', 'pipe:1',
      '-fflags', 'nobuffer',
      '-flags', 'low_delay',
      '-i', sourceUrl,
      '-an',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-pix_fmt', 'yuv420p',
      '-r', '20',
      '-g', '40',
      '-f', 'flv',
      targetUrl,
    ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const activePublisher = {
      process: publisher,
      stopTimer: this.publisherStopTimer(localCameraId, publisher, ttlSeconds),
      expiresAt: superviseUntil ?? Date.now() + ttlSeconds * 1000,
    };
    this.publishers.set(localCameraId, activePublisher);
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let published = false;
      let restartScheduled = false;
      let stderr = '';
      const cleanupAndRestart = () => {
        clearTimeout(activePublisher.stopTimer);
        const wasActive = this.publishers.get(localCameraId) === activePublisher;
        if (wasActive) this.publishers.delete(localCameraId);
        if (
          !restartScheduled
          && (published || superviseUntil !== undefined)
          && wasActive
          && !this.shuttingDown
          && activePublisher.expiresAt > Date.now()
        ) {
          restartScheduled = true;
          const retryTimer = setTimeout(() => {
            const remainingSeconds = Math.ceil((activePublisher.expiresAt - Date.now()) / 1000);
            if (remainingSeconds <= 0) return;
            void this.startLivePublisher(
              { ...payload, publisherTtlSeconds: remainingSeconds },
              activePublisher.expiresAt,
            )
              .catch(error => this.logger.warn(
                `Remote publisher restart failed for camera ${localCameraId}: ${this.errorMessage(error)}`,
              ));
          }, 2_000);
          retryTimer.unref();
        }
      };
      const startupTimer = setTimeout(() => {
        publisher.kill();
        if (!settled) {
          settled = true;
          reject(new Error(`FFmpeg did not publish video within 15 seconds${stderr ? `: ${stderr}` : ''}`));
        }
      }, 15_000);
      publisher.stdout?.on('data', data => {
        if (!settled && data.toString().includes('progress=continue')) {
          clearTimeout(startupTimer);
          settled = true;
          published = true;
          resolve();
        }
      });
      publisher.stderr?.on('data', data => {
        stderr = `${stderr}${data.toString()}`.slice(-500).trim();
      });
      publisher.once('error', error => {
        clearTimeout(startupTimer);
        cleanupAndRestart();
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
      publisher.once('exit', code => {
        clearTimeout(startupTimer);
        cleanupAndRestart();
        if (!settled) {
          settled = true;
          reject(new Error(
            `FFmpeg exited during startup with code ${code ?? 'unknown'}${stderr ? `: ${stderr}` : ''}`,
          ));
        } else if (code && code !== 0) {
          this.logger.warn(`Remote publisher for camera ${localCameraId} exited with code ${code}`);
        }
      });
    });
  }

  private publisherStopTimer(localCameraId: string, publisher: ChildProcess, ttlSeconds: number) {
    const timer = setTimeout(() => {
      const active = this.publishers.get(localCameraId);
      if (active?.process === publisher) {
        this.publishers.delete(localCameraId);
        publisher.kill();
      }
    }, ttlSeconds * 1000);
    timer.unref();
    return timer;
  }

  private async post<T = void>(path: string, body: unknown): Promise<T> {
    const response = await this.request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response.json() as Promise<T>;
  }

  private async get<T>(path: string): Promise<T> {
    const response = await this.request(path);
    return response.json() as Promise<T>;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(`${this.cloudUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Device ${this.installationId}.${this.installationSecret}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Cloud API ${response.status}`);
    }
    return response;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
