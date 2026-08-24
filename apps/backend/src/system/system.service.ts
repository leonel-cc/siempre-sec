import { Injectable, Logger } from '@nestjs/common';
import { AiClientService } from '../ai/ai-client.service';
import * as os from 'os';
import * as net from 'net';

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);

  constructor(private readonly aiClient: AiClientService) {}

  async getHealth() {
    const [cpuUsage, memUsage, diskUsage, aiHealth] = await Promise.all([
      this.getCpuUsage(),
      this.getMemoryUsage(),
      this.getDiskUsage(),
      this.aiClient.getHealth(),
    ]);

    const mediamtxHost = process.env.MEDIAMTX_HOST || '127.0.0.1';
    const mediamtxPort = parseInt(process.env.MEDIAMTX_PORT || '', 10) || 8554;
    const mediamtxOnline = await this.checkPort(mediamtxPort, mediamtxHost);

    return {
      backend: { status: 'ONLINE', last_check: new Date().toISOString() },
      ai_service: {
        status: aiHealth ? 'ONLINE' : 'OFFLINE',
        models_loaded: aiHealth?.models_loaded ?? false,
        last_check: new Date().toISOString(),
      },
      mediamtx: {
        status: mediamtxOnline ? 'ONLINE' : 'OFFLINE',
        last_check: new Date().toISOString(),
      },
      database: { status: 'ONLINE', last_check: new Date().toISOString() },
      system: {
        cpu_usage_percent: cpuUsage,
        memory_usage_percent: memUsage,
        disk_usage_percent: diskUsage,
        gpu_available: false,
      },
    };
  }

  private checkPort(port: number, host: string = '127.0.0.1'): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(2000);
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('timeout', () => { socket.destroy(); resolve(false); });
      socket.once('error', () => { socket.destroy(); resolve(false); });
      socket.connect(port, host);
    });
  }

  private async getCpuUsage(): Promise<number> {
    try {
      const cpus = os.cpus();
      const totalIdle = cpus.reduce((sum, cpu) => sum + cpu.times.idle, 0);
      const totalTick = cpus.reduce(
        (sum, cpu) =>
          sum + cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle,
        0,
      );
      return Math.round((1 - totalIdle / totalTick) * 100 * 100) / 100;
    } catch {
      return 0;
    }
  }

  private getMemoryUsage(): number {
    const total = os.totalmem();
    const free = os.freemem();
    return Math.round(((total - free) / total) * 100 * 100) / 100;
  }

  private async getDiskUsage(): Promise<number> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      const platform = os.platform();
      if (platform === 'win32') {
        const { stdout } = await execAsync(
          'wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace,Size /format:csv',
        );
        const lines = stdout.trim().split('\n').filter(Boolean);
        if (lines.length >= 2) {
          const parts = lines[lines.length - 1].split(',');
          const free = parseInt(parts[1]) || 0;
          const total = parseInt(parts[2]) || 1;
          return Math.round(((total - free) / total) * 100 * 100) / 100;
        }
      } else {
        const { stdout } = await execAsync("df -h / | tail -1 | awk '{print $5}'");
        return parseInt(stdout.replace('%', '').trim()) || 0;
      }
    } catch {
      this.logger.warn('Could not get disk usage');
    }
    return 0;
  }
}
