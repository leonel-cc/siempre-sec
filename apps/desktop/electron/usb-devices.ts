import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface UsbDevice {
  index: number;
  name: string;
}

function resolveFfmpeg(): string | null {
  const candidates: string[] = [];

  const envPath = process.env.FFMPEG_PATH;
  if (envPath) {
    candidates.push(envPath);
    candidates.push(path.join(envPath, 'ffmpeg.exe'));
  }
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'bin', 'ffmpeg.exe'));
  }
  candidates.push(path.join(__dirname, '..', 'bin', 'ffmpeg.exe'));

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        const stat = fs.statSync(c);
        if (stat.isDirectory()) {
          const inner = path.join(c, 'ffmpeg.exe');
          if (fs.existsSync(inner)) return inner;
        } else {
          return c;
        }
      }
    } catch {
      // ignore and try next candidate
    }
  }
  return 'ffmpeg';
}

export function listUsbDevices(): Promise<{ devices: UsbDevice[]; count: number }> {
  return new Promise((resolve) => {
    const ffmpeg = resolveFfmpeg();

    execFile(
      ffmpeg,
      ['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'],
      { timeout: 15000, windowsHide: true },
      (err, _stdout, stderr) => {
        const output = String(stderr || '');
        if (!output && err) {
          console.error(`USB enumeration failed (${ffmpeg}):`, err.message);
          return resolve({ devices: [], count: 0 });
        }

        const devices: UsbDevice[] = [];
        let section: 'video' | 'audio' | null = null;

        for (const line of output.split(/\r?\n/)) {
          if (/DirectShow video devices/i.test(line)) {
            section = 'video';
            continue;
          }
          if (/DirectShow audio devices/i.test(line)) {
            section = 'audio';
            continue;
          }
          if (/Alternative name/i.test(line)) continue;

          let name: string | undefined;
          let type: string | null = null;

          const typed = line.match(/"([^"]+)"\s*\((video|audio)\)/);
          if (typed) {
            name = typed[1];
            type = typed[2];
          } else {
            const plain = line.match(/"([^"]+)"/);
            if (plain && section === 'video') {
              name = plain[1];
              type = 'video';
            }
          }

          if (name && type === 'video' && name.trim()) {
            devices.push({ index: devices.length, name: name.trim() });
          }
        }

        resolve({ devices, count: devices.length });
      },
    );
  });
}
