import { app, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';

function secureFile(name: string): string {
  const dir = path.join(app.getPath('userData'), 'secure');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, name);
}

export function writeEncrypted(name: string, value: unknown): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Windows secure storage is unavailable');
  }
  const file = secureFile(name);
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  const encrypted = safeStorage.encryptString(JSON.stringify(value));
  try {
    fs.writeFileSync(temporary, encrypted, { mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

export function readEncrypted<T>(name: string): T | null {
  const file = secureFile(name);
  let encrypted: Buffer;
  try {
    encrypted = fs.readFileSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Windows secure storage is unavailable');
  }
  return JSON.parse(safeStorage.decryptString(encrypted)) as T;
}

export function removeSecureFile(name: string): void {
  fs.rmSync(secureFile(name), { force: true });
}
