import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  powerMonitor,
  powerSaveBlocker,
  Tray,
} from 'electron';
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
let tray: Tray | null = null;
let isQuitting = false;
let powerSaveBlockerId: number | null = null;
let backendRestartTimer: ReturnType<typeof setTimeout> | null = null;
let aiRestartTimer: ReturnType<typeof setTimeout> | null = null;
let mediamtxRestartTimer: ReturnType<typeof setTimeout> | null = null;

const BACKEND_PORT = 3000;
const AI_PORT = 5000;
const MEDIAMTX_PORT = 8554;

interface DesktopPreferences {
  startWithWindows: boolean;
  keepRunningInBackground: boolean;
  preventSleep: boolean;
}

const defaultDesktopPreferences: DesktopPreferences = {
  startWithWindows: true,
  keepRunningInBackground: true,
  preventSleep: true,
};

let desktopPreferences = { ...defaultDesktopPreferences };

function getPreferencesPath(): string {
  return path.join(app.getPath('userData'), 'desktop-preferences.json');
}

function loadDesktopPreferences(): DesktopPreferences {
  try {
    const saved = JSON.parse(fs.readFileSync(getPreferencesPath(), 'utf8'));
    return { ...defaultDesktopPreferences, ...saved };
  } catch {
    return { ...defaultDesktopPreferences };
  }
}

function saveDesktopPreferences(): void {
  fs.writeFileSync(getPreferencesPath(), JSON.stringify(desktopPreferences, null, 2));
}

function applyLoginItemSetting(): void {
  if (process.platform !== 'win32' || isDev) return;
  app.setLoginItemSettings({
    openAtLogin: desktopPreferences.startWithWindows,
    path: process.execPath,
    args: ['--background'],
    name: 'Security AI',
  });
}

function applyPowerSetting(): void {
  if (desktopPreferences.preventSleep && powerSaveBlockerId === null) {
    powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
  } else if (!desktopPreferences.preventSleep && powerSaveBlockerId !== null) {
    if (powerSaveBlocker.isStarted(powerSaveBlockerId)) {
      powerSaveBlocker.stop(powerSaveBlockerId);
    }
    powerSaveBlockerId = null;
  }
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow(true);
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function rebuildTrayMenu(): void {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir Security AI', click: showMainWindow },
    { type: 'separator' },
    {
      label: 'Iniciar con Windows',
      type: 'checkbox',
      checked: desktopPreferences.startWithWindows,
      click: (item) => {
        desktopPreferences.startWithWindows = item.checked;
        saveDesktopPreferences();
        applyLoginItemSetting();
      },
    },
    { type: 'separator' },
    {
      label: 'Salir completamente',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]));
}

function createTray(): void {
  if (tray) return;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#2563eb"/><path d="M16 5 26 9v7c0 6.3-4.2 10-10 12-5.8-2-10-5.7-10-12V9l10-4Z" fill="#fff"/><circle cx="16" cy="15" r="4" fill="#2563eb"/><path d="M10 23c1.4-3 3.4-4 6-4s4.6 1 6 4" fill="#2563eb"/></svg>';
  tray = new Tray(nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`));
  tray.setToolTip('Security AI - monitoreo activo');
  tray.on('double-click', showMainWindow);
  rebuildTrayMenu();
}

function ensureServicesRunning(): void {
  if (!backendProcess) void startBackend().catch(error => console.error('Backend start error:', error));
  if (!aiProcess) void startAiService().catch(error => console.error('AI start error:', error));
  if (!mediamtxProcess) void startMediaMTX().catch(error => console.error('MediaMTX start error:', error));
}

function scheduleBackendRestart(): void {
  if (isQuitting || backendRestartTimer) return;
  backendRestartTimer = setTimeout(() => {
    backendRestartTimer = null;
    if (!isQuitting) void startBackend().catch(error => console.error('Backend restart error:', error));
  }, 5000);
}

function scheduleAiRestart(): void {
  if (isQuitting || aiRestartTimer) return;
  aiRestartTimer = setTimeout(() => {
    aiRestartTimer = null;
    if (!isQuitting) void startAiService().catch(error => console.error('AI restart error:', error));
  }, 5000);
}

function scheduleMediaMTXRestart(): void {
  if (isQuitting || mediamtxRestartTimer) return;
  mediamtxRestartTimer = setTimeout(() => {
    mediamtxRestartTimer = null;
    if (!isQuitting) void startMediaMTX().catch(error => console.error('MediaMTX restart error:', error));
  }, 5000);
}

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

  child.on('error', (error) => {
    console.error('Backend process error:', error);
    if (backendProcess === child) {
      backendProcess = null;
      scheduleBackendRestart();
    }
  });

  child.on('exit', (code) => {
    console.log(`Backend exited with code ${code}`);
    if (backendProcess === child) {
      backendProcess = null;
      scheduleBackendRestart();
    }
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

  aiProcess.on('error', (error) => {
    console.error('AI process error:', error);
    aiProcess = null;
    scheduleAiRestart();
  });

  aiProcess.on('exit', (code) => {
    console.log(`AI Service exited with code ${code}`);
    aiProcess = null;
    scheduleAiRestart();
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

  mediamtxProcess.on('error', (error) => {
    console.error('MediaMTX process error:', error);
    mediamtxProcess = null;
    scheduleMediaMTXRestart();
  });

  mediamtxProcess.on('exit', (code) => {
    console.log(`MediaMTX exited with code ${code}`);
    mediamtxProcess = null;
    scheduleMediaMTXRestart();
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
  showMainWindow();
});

function createWindow(showOnReady = true) {
  mainWindow = new BrowserWindow({
    show: false,
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

  if (showOnReady) mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.on('close', (event) => {
    if (!isQuitting && desktopPreferences.keepRunningInBackground) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  if (!gotTheLock) return;
  desktopPreferences = loadDesktopPreferences();
  applyLoginItemSetting();
  applyPowerSetting();
  createTray();
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

  ipcMain.handle('desktop-preferences:get', () => ({ ...desktopPreferences }));
  ipcMain.handle('desktop-preferences:set', (_event, updates: Partial<DesktopPreferences>) => {
    desktopPreferences = { ...desktopPreferences, ...updates };
    saveDesktopPreferences();
    applyLoginItemSetting();
    applyPowerSetting();
    rebuildTrayMenu();
    return { ...desktopPreferences };
  });

  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window-close', () => mainWindow?.close());

  const startInBackground = !isDev && process.argv.includes('--background');
  if (!startInBackground) createWindow(true);

  ensureServicesRunning();

  powerMonitor.on('resume', () => {
    console.log('Windows resumed; checking Security AI services');
    ensureServicesRunning();
  });

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
  if (!desktopPreferences.keepRunningInBackground && process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  showMainWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
  if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
    powerSaveBlocker.stop(powerSaveBlockerId);
  }
  killProcesses();
});
