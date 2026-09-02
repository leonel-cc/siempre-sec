import { app } from 'electron';
import { generateKeyPairSync } from 'crypto';
import { readEncrypted, removeSecureFile, writeEncrypted } from './secure-storage';

interface PendingEnrollment {
  cloudUrl: string;
  deviceCode: string;
  userCode: string;
  expiresAt: string;
  privateKey: string;
}

interface CloudCredentials {
  cloudUrl: string;
  installationId: string;
  secret: string;
  privateKey: string;
}

export interface CloudEnrollmentStatus {
  state: 'UNENROLLED' | 'PENDING' | 'ENROLLED';
  cloudUrl?: string;
  installationId?: string;
  userCode?: string;
  expiresAt?: string;
}

function normalizeCloudUrl(value: string): string {
  const url = new URL(value.trim());
  const localDevelopment = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(localDevelopment && !app.isPackaged)) {
    throw new Error('Cloud URL must use HTTPS');
  }
  return url.toString().replace(/\/$/, '');
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Cloud API returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function enrollmentPlatform(): 'windows' | 'macos' | 'linux' {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  return 'linux';
}

export async function requestCloudEnrollment(
  cloudUrlInput: string,
  installationName: string,
): Promise<CloudEnrollmentStatus> {
  const cloudUrl = normalizeCloudUrl(cloudUrlInput);
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const challenge = await postJson<{
    deviceCode: string;
    userCode: string;
    expiresAt: string;
  }>(`${cloudUrl}/v1/enrollment/request`, {
    installationName: installationName.trim(),
    platform: enrollmentPlatform(),
    publicKey,
  });
  const pending: PendingEnrollment = {
    cloudUrl,
    deviceCode: challenge.deviceCode,
    userCode: challenge.userCode,
    expiresAt: challenge.expiresAt,
    privateKey,
  };
  writeEncrypted('cloud-enrollment.bin', pending);
  return {
    state: 'PENDING',
    cloudUrl,
    userCode: pending.userCode,
    expiresAt: pending.expiresAt,
  };
}

export async function exchangeCloudEnrollment(): Promise<CloudEnrollmentStatus> {
  const pending = readEncrypted<PendingEnrollment>('cloud-enrollment.bin');
  if (!pending || new Date(pending.expiresAt) <= new Date()) {
    removeSecureFile('cloud-enrollment.bin');
    throw new Error('Enrollment request is missing or expired');
  }
  const result = await postJson<{ installationId: string; secret: string }>(
    `${pending.cloudUrl}/v1/enrollment/exchange`,
    { deviceCode: pending.deviceCode },
  );
  writeEncrypted('cloud-credentials.bin', {
    cloudUrl: pending.cloudUrl,
    installationId: result.installationId,
    secret: result.secret,
    privateKey: pending.privateKey,
  } satisfies CloudCredentials);
  removeSecureFile('cloud-enrollment.bin');
  return {
    state: 'ENROLLED',
    cloudUrl: pending.cloudUrl,
    installationId: result.installationId,
  };
}

export function getCloudEnrollmentStatus(): CloudEnrollmentStatus {
  const credentials = readEncrypted<CloudCredentials>('cloud-credentials.bin');
  if (credentials) {
    return {
      state: 'ENROLLED',
      cloudUrl: credentials.cloudUrl,
      installationId: credentials.installationId,
    };
  }
  const pending = readEncrypted<PendingEnrollment>('cloud-enrollment.bin');
  if (pending && new Date(pending.expiresAt) > new Date()) {
    return {
      state: 'PENDING',
      cloudUrl: pending.cloudUrl,
      userCode: pending.userCode,
      expiresAt: pending.expiresAt,
    };
  }
  return { state: 'UNENROLLED' };
}

export function getCloudChildEnvironment(): Record<string, string> {
  const credentials = readEncrypted<CloudCredentials>('cloud-credentials.bin');
  if (!credentials) return {};
  return {
    CLOUD_API_URL: credentials.cloudUrl,
    CLOUD_INSTALLATION_ID: credentials.installationId,
    CLOUD_INSTALLATION_SECRET: credentials.secret,
  };
}

export async function deviceRequest<T>(
  pathname: string,
  init: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  if (!pathname.startsWith('/v1/installations/me/') || pathname.includes('://')
    || pathname.includes('..') || pathname.includes('\\') || pathname.includes('#')) {
    throw new Error('Invalid device API path');
  }
  const credentials = readEncrypted<CloudCredentials>('cloud-credentials.bin');
  if (!credentials) throw new Error('Cloud installation is not enrolled');
  const response = await fetch(`${credentials.cloudUrl}${pathname}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Device ${credentials.installationId}.${credentials.secret}`,
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error((await response.text()) || `Cloud API returned ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function clearCloudEnrollment(): Promise<CloudEnrollmentStatus> {
  const credentials = readEncrypted<CloudCredentials>('cloud-credentials.bin');
  if (credentials) {
    const response = await fetch(`${credentials.cloudUrl}/v1/installations/me/revoke`, {
      method: 'POST',
      headers: {
        Authorization: `Device ${credentials.installationId}.${credentials.secret}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error((await response.text()) || `Cloud API returned ${response.status}`);
    }
  }
  removeSecureFile('cloud-enrollment.bin');
  removeSecureFile('cloud-credentials.bin');
  return { state: 'UNENROLLED' };
}
