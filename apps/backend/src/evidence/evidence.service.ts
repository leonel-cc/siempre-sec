import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface EvidenceFile {
  name: string;
  size: number;
  modifiedAt: Date;
}

@Injectable()
export class EvidenceService {
  private readonly evidenceDir: string;
  private readonly conversions = new Map<string, Promise<void>>();

  constructor(private readonly configService: ConfigService) {
    this.evidenceDir = path.resolve(
      this.configService.get<string>('EVIDENCE_DIR') || './evidence',
    );
    fs.mkdirSync(this.evidenceDir, { recursive: true });
  }

  list(): EvidenceFile[] {
    return fs
      .readdirSync(this.evidenceDir)
      .map((name) => {
        const filePath = path.join(this.evidenceDir, name);
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) return null;
        return {
          name,
          size: stat.size,
          modifiedAt: stat.mtime,
        };
      })
      .filter((f): f is EvidenceFile => f !== null)
      .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
  }

  resolvePath(fileName: string): string | null {
    const filePath = path.join(this.evidenceDir, fileName);
    if (
      !filePath.startsWith(this.evidenceDir + path.sep) ||
      !fs.existsSync(filePath) ||
      !fs.statSync(filePath).isFile()
    ) {
      return null;
    }
    return filePath;
  }

  async ensurePlayable(filePath: string): Promise<void> {
    if (path.extname(filePath).toLowerCase() !== '.mp4') return;

    let conversion = this.conversions.get(filePath);
    if (!conversion) {
      conversion = this.convertLegacyVideo(filePath).finally(() => {
        this.conversions.delete(filePath);
      });
      this.conversions.set(filePath, conversion);
    }
    await conversion;
  }

  private async convertLegacyVideo(filePath: string): Promise<void> {
    const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
    const ffprobe = process.platform === 'win32'
      ? path.join(path.dirname(ffmpeg), 'ffprobe.exe')
      : 'ffprobe';
    const temporaryPath = `${filePath}.h264.tmp.mp4`;

    try {
      const { stdout } = await execFileAsync(ffprobe, [
        '-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=codec_name',
        '-of', 'default=noprint_wrappers=1:nokey=1', filePath,
      ]);
      if (stdout.trim() === 'h264') return;

      await execFileAsync(ffmpeg, [
        '-y', '-loglevel', 'error', '-i', filePath,
        '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', temporaryPath,
      ]);
      fs.renameSync(temporaryPath, filePath);
    } catch (error) {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
      console.error(`Failed to convert legacy evidence video ${filePath}:`, error);
    }
  }

  delete(fileName: string): boolean {
    const filePath = this.resolvePath(fileName);
    if (!filePath) return false;
    fs.unlinkSync(filePath);
    return true;
  }
}
