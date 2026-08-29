import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

@Controller('evidence')
export class EvidenceController {
  private readonly evidenceDir: string;

  constructor() {
    this.evidenceDir = process.env.EVIDENCE_DIR || path.join(process.cwd(), 'evidence');
  }

  @Get(':filename')
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    const evidenceDir = path.resolve(this.evidenceDir);
    const filePath = path.resolve(evidenceDir, filename);
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
    };

    if (path.dirname(filePath) !== evidenceDir || !mimeTypes[ext] || !fs.existsSync(filePath)) {
      throw new NotFoundException(`Evidence not found: ${filename}`);
    }

    res.setHeader('Content-Type', mimeTypes[ext]);
    res.setHeader('Cache-Control', 'public, max-age=300');
    fs.createReadStream(filePath).pipe(res);
  }
}
