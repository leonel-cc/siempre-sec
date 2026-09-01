import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import net from 'net';
import {
  clearCloudEnrollment,
  exchangeCloudEnrollment,
  getCloudChildEnvironment,
  getCloudEnrollmentStatus,
  requestCloudEnrollment,
} from './cloud-enrollment';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let aiProcess: ChildProcess | null = null;
let mediamtxProcess: ChildProcess | null = null;

const BACKEND_PORT = 3000;
const AI_PORT = 5000;
const MEDIAMTX_PORT = 8554;

function getBackendDir(): string {
  if (isDev) {
    return path.join(__dirname, '..', '..', 'backend');
  }
  const asarUnpacked = path.join(process.resourcesPath, 'app.asar.unpacked');
  const backendDir = path.join(asarUnpacked, 'backend');
  if (fs.existsSync(backendDir)) return backendDir;
  return path.join(process.resourcesPath, 'backend');
}

function getAiDir(): string {
  if (isDev) {
    return path.join(__dirname, '..', '..', 'ai');
  }
  const asarUnpacked = path.join(process.resourcesPath, 'app.asar.unpacked');
  const aiDir = path.join(asarUnpacked, 'ai');
  if (fs.existsSync(aiDir)) return aiDir;
  return path.join(process.resourcesPath, 'ai');
}

function getDataDir(): string {
  const dir = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getEvidenceDir(): string {
  const dir = path.join(app.getPath('userData'), 'evidence');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getModelDir(): string {
  if (isDev) return path.join(__dirname, '..', 'models');
  return path.join(process.resourcesPath, 'models');
}

function getMediaMTXDir(): string {
  if (isDev) {
    return path.join(__dirname, '..', 'mediamtx');
  }
  return path.join(process.resourcesPath, 'mediamtx');
}

function getBinDir(): string {
  if (isDev) {
    return path.join(__dirname, '..', 'bin');
  }
  return path.join(process.resourcesPath, 'bin');
}

function buildChildEnv(extra: Record<string, string> = {}): Record<string, string | undefined> {
  const binDir = getBinDir();
  const pathSep = process.platform === 'win32' ? ';' : ':';
  const existingPath = process.env.PATH || process.env.Path || '';
  return {
    ...process.env,
    PATH: `${binDir}${pathSep}${existingPath}`,
    FFMPEG_PATH: path.join(binDir, 'ffmpeg.exe'),
    MEDIAMTX_PATH: path.join(getMediaMTXDir(), 'mediamtx.exe'),
    MODEL_DIR: getModelDir(),
    ...extra,
  };
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

async function startBackend(): Promise<void> {
  if (!await isPortAvailable(BACKEND_PORT)) {
    console.log(`Backend already running on port ${BACKEND_PORT}`);
    return;
  }

  const backendDir = getBackendDir();
  const scriptPath = path.join(backendDir, 'dist', 'main.js');

  if (!fs.existsSync(scriptPath)) {
    console.error(`Backend script not found: ${scriptPath}`);
    return;
  }

  console.log(`Starting backend: ${scriptPath}`);

  const child = spawn(process.execPath, [scriptPath], {
    cwd: backendDir,
    env: buildChildEnv({
      ELECTRON_RUN_AS_NODE: '1',
      DATABASE_PATH: path.join(getDataDir(), 'security-ai.db'),
      EVIDENCE_DIR: getEvidenceDir(),
      BACKEND_PORT: String(BACKEND_PORT),
      AI_SERVICE_HOST: '127.0.0.1',
      AI_SERVICE_PORT: String(AI_PORT),
      ...getCloudChildEnvironment(),
    }),
    stdio: 'pipe',
  });
  backendProcess = child;

  child.stdout?.on('data', (data) => {
    console.log(`[Backend] ${data.toString().trim()}`);
  });

  child.stderr?.on('data', (data) => {
    console.error(`[Backend] ${data.toString().trim()}`);
  });

  child.on('exit', (code) => {
    console.log(`Backend exited with code ${code}`);
    if (backendProcess === child) backendProcess = null;
  });
}

function resolvePython(aiDir: string): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const venvPython = process.platform === 'win32'
    ? path.join(aiDir, '.venv', 'Scripts', 'python.exe')
    : path.join(aiDir, '.venv', 'bin', 'python');
  if (fs.existsSync(venvPython)) return venvPython;
  return 'python';
}

async function startAiService(): Promise<void> {
  if (!await isPortAvailable(AI_PORT)) {
    console.log(`AI Service already running on port ${AI_PORT}`);
    return;
  }

  const aiDir = getAiDir();

  if (isDev) {
    const scriptPath = path.join(aiDir, 'main.py');
    const pythonBin = resolvePython(aiDir);
    console.log(`Starting AI service (dev): ${scriptPath} with ${pythonBin}`);

    aiProcess = spawn(pythonBin, [
      '-m', 'uvicorn', 'main:app',
      '--host', '127.0.0.1',
      '--port', String(AI_PORT),
    ], {
      cwd: aiDir,
      env: buildChildEnv({
        AI_SERVICE_PORT: String(AI_PORT),
        AI_SERVICE_HOST: '127.0.0.1',
        BACKEND_URL: `http://127.0.0.1:${BACKEND_PORT}`,
        EVIDENCE_DIR: getEvidenceDir(),
      }),
      stdio: 'pipe',
    });
  } else {
    const exePath = path.join(aiDir, 'security-ai-service.exe');
    if (!fs.existsSync(exePath)) {
      console.error(`AI service executable not found: ${exePath}`);
      return;
    }

    console.log(`Starting AI service (production): ${exePath}`);

    aiProcess = spawn(exePath, [], {
      cwd: aiDir,
      env: buildChildEnv({
        AI_SERVICE_PORT: String(AI_PORT),
        AI_SERVICE_HOST: '127.0.0.1',
        BACKEND_URL: `http://127.0.0.1:${BACKEND_PORT}`,
        EVIDENCE_DIR: getEvidenceDir(),
      }),
      stdio: 'pipe',
    });
  }

  aiProcess.stdout?.on('data', (data) => {
    console.log(`[AI] ${data.toString().trim()}`);
  });

  aiProcess.stderr?.on('data', (data) => {
    console.error(`[AI] ${data.toString().trim()}`);
  });

  aiProcess.on('exit', (code) => {
    console.log(`AI Service exited with code ${code}`);
    aiProcess = null;
  });
}

async function startMediaMTX(): Promise<void> {
  if (!await isPortAvailable(MEDIAMTX_PORT)) {
    console.log(`MediaMTX already running on port ${MEDIAMTX_PORT}`);
    return;
  }

  const mediaDir = getMediaMTXDir();
  const exePath = path.join(mediaDir, 'mediamtx.exe');
  const configPath = path.join(mediaDir, 'mediamtx.yml');

  if (!fs.existsSync(exePath)) {
    console.error(`MediaMTX not found: ${exePath}`);
    return;
  }

  if (!fs.existsSync(configPath)) {
    console.error(`MediaMTX config not found: ${configPath}`);
    return;
  }

  console.log(`Starting MediaMTX: ${exePath}`);

  mediamtxProcess = spawn(exePath, [configPath], {
    cwd: mediaDir,
    env: { ...process.env },
    stdio: 'pipe',
  });

  mediamtxProcess.stdout?.on('data', (data) => {
    console.log(`[MediaMTX] ${data.toString().trim()}`);
  });

  mediamtxProcess.stderr?.on('data', (data) => {
    console.error(`[MediaMTX] ${data.toString().trim()}`);
  });

  mediamtxProcess.on('exit', (code) => {
    console.log(`MediaMTX exited with code ${code}`);
    mediamtxProcess = null;
  });
}

function waitForService(port: number, timeoutMs: number = 30000): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const client = net.createConnection(port, '127.0.0.1');
      client.once('connect', () => {
        client.end();
        resolve(true);
      });
      client.once('error', () => {
        client.destroy();
        if (Date.now() - start > timeoutMs) {
          resolve(false);
        } else {
          setTimeout(check, 1000);
        }
      });
    };
    check();
  });
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Security AI',
    backgroundColor: '#030712',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  if (!gotTheLock) return;
  console.log('Security AI starting...');
  console.log(`Mode: ${isDev ? 'development' : 'production'}`);

  ipcMain.handle('open-file-dialog', async (_event, options: { filters?: { name: string; extensions: string[] }[] }) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: options?.filters || [
        { name: 'Videos', extensions: ['mp4', 'avi', 'mkv', 'webm'] },
        { name: 'Todos', extensions: ['*'] },
      ],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('list-usb-devices', async () => {
    const { listUsbDevices } = await import('./usb-devices');
    return listUsbDevices();
  });

  ipcMain.handle('cloud-enrollment-status', () => getCloudEnrollmentStatus());
  ipcMain.handle('cloud-enrollment-request', (_event, cloudUrl: string, installationName: string) =>
    requestCloudEnrollment(cloudUrl, installationName));
  ipcMain.handle('cloud-enrollment-exchange', async () => {
    const status = await exchangeCloudEnrollment();
    await restartBackend();
    return status;
  });
  ipcMain.handle('cloud-enrollment-clear', async () => {
    const status = await clearCloudEnrollment();
    await restartBackend();
    return status;
  });

  createWindow();

  startBackend().catch(e => console.error('Backend start error:', e));
  startAiService().catch(e => console.error('AI start error:', e));
  startMediaMTX().catch(e => console.error('MediaMTX start error:', e));

  const backendReady = await waitForService(BACKEND_PORT, 15000);
  console.log(`Backend: ${backendReady ? 'READY' : 'TIMEOUT'}`);

  const aiReady = await waitForService(AI_PORT, 60000);
  console.log(`AI Service: ${aiReady ? 'READY' : 'TIMEOUT'}`);

  const mediaReady = await waitForService(MEDIAMTX_PORT, 10000);
  console.log(`MediaMTX: ${mediaReady ? 'READY' : 'TIMEOUT'}`);
});

function killProcess(proc: ChildProcess | null, name: string): ChildProcess | null {
  if (!proc) return null;
  if (process.platform === 'win32' && proc.pid) {
    try {
      spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      proc.kill();
    }
  } else {
    proc.kill();
  }
  console.log(`${name} stopped`);
  return null;
}

async function stopProcess(proc: ChildProcess | null, name: string): Promise<void> {
  if (!proc || proc.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 5_000);
    const done = () => {
      clearTimeout(timeout);
      resolve();
    };
    proc.once('exit', done);
    if (process.platform === 'win32' && proc.pid) {
      const killer = spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.once('error', () => proc.kill());
    } else {
      proc.kill();
    }
  });
  console.log(`${name} stopped`);
}

async function restartBackend(): Promise<void> {
  const previous = backendProcess;
  if (backendProcess === previous) backendProcess = null;
  await stopProcess(previous, 'Backend');
  if (previous?.exitCode === null && previous.signalCode === null) {
    backendProcess = previous;
    throw new Error('Backend did not stop; restart the application to apply cloud settings');
  }
  await startBackend();
}

function killProcesses() {
  mediamtxProcess = killProcess(mediamtxProcess, 'MediaMTX');
  aiProcess = killProcess(aiProcess, 'AI Service');
  backendProcess = killProcess(backendProcess, 'Backend');
}

app.on('window-all-closed', () => {
  killProcesses();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  killProcesses();
});
