"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const net = require("net");
const isDev = !electron.app.isPackaged;
let mainWindow = null;
let backendProcess = null;
let aiProcess = null;
let mediamtxProcess = null;
const BACKEND_PORT = 3e3;
const AI_PORT = 5e3;
const MEDIAMTX_PORT = 8554;
function getBackendDir() {
  if (isDev) {
    return path.join(__dirname, "..", "..", "backend");
  }
  const asarUnpacked = path.join(process.resourcesPath, "app.asar.unpacked");
  const backendDir = path.join(asarUnpacked, "backend");
  if (fs.existsSync(backendDir)) return backendDir;
  return path.join(process.resourcesPath, "backend");
}
function getAiDir() {
  if (isDev) {
    return path.join(__dirname, "..", "..", "ai");
  }
  const asarUnpacked = path.join(process.resourcesPath, "app.asar.unpacked");
  const aiDir = path.join(asarUnpacked, "ai");
  if (fs.existsSync(aiDir)) return aiDir;
  return path.join(process.resourcesPath, "ai");
}
function getDataDir() {
  const dir = path.join(electron.app.getPath("userData"), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function getEvidenceDir() {
  const dir = path.join(electron.app.getPath("userData"), "evidence");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function getMediaMTXDir() {
  if (isDev) {
    return path.join(__dirname, "..", "mediamtx");
  }
  return path.join(process.resourcesPath, "mediamtx");
}
function getBinDir() {
  if (isDev) {
    return path.join(__dirname, "..", "..", "..", "bin");
  }
  return path.join(process.resourcesPath, "bin");
}
function buildChildEnv(extra = {}) {
  const binDir = getBinDir();
  const pathSep = process.platform === "win32" ? ";" : ":";
  const existingPath = process.env.PATH || process.env.Path || "";
  return {
    ...process.env,
    PATH: `${binDir}${pathSep}${existingPath}`,
    FFMPEG_PATH: path.join(binDir, "ffmpeg.exe"),
    MEDIAMTX_PATH: path.join(getMediaMTXDir(), "mediamtx.exe"),
    ...extra
  };
}
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port, "127.0.0.1");
  });
}
async function startBackend() {
  var _a, _b;
  if (!await isPortAvailable(BACKEND_PORT)) {
    console.log(`Backend already running on port ${BACKEND_PORT}`);
    return;
  }
  const backendDir = getBackendDir();
  const scriptPath = path.join(backendDir, "dist", "main.js");
  if (!fs.existsSync(scriptPath)) {
    console.error(`Backend script not found: ${scriptPath}`);
    return;
  }
  console.log(`Starting backend: ${scriptPath}`);
  backendProcess = child_process.spawn(process.execPath, [scriptPath], {
    cwd: backendDir,
    env: buildChildEnv({
      ELECTRON_RUN_AS_NODE: "1",
      DATABASE_PATH: path.join(getDataDir(), "security-ai.db"),
      EVIDENCE_DIR: getEvidenceDir(),
      BACKEND_PORT: String(BACKEND_PORT),
      AI_SERVICE_HOST: "127.0.0.1",
      AI_SERVICE_PORT: String(AI_PORT)
    }),
    stdio: "pipe"
  });
  (_a = backendProcess.stdout) == null ? void 0 : _a.on("data", (data) => {
    console.log(`[Backend] ${data.toString().trim()}`);
  });
  (_b = backendProcess.stderr) == null ? void 0 : _b.on("data", (data) => {
    console.error(`[Backend] ${data.toString().trim()}`);
  });
  backendProcess.on("exit", (code) => {
    console.log(`Backend exited with code ${code}`);
    backendProcess = null;
  });
}
function resolvePython(aiDir) {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const venvPython = process.platform === "win32" ? path.join(aiDir, ".venv", "Scripts", "python.exe") : path.join(aiDir, ".venv", "bin", "python");
  if (fs.existsSync(venvPython)) return venvPython;
  return "python";
}
async function startAiService() {
  var _a, _b;
  if (!await isPortAvailable(AI_PORT)) {
    console.log(`AI Service already running on port ${AI_PORT}`);
    return;
  }
  const aiDir = getAiDir();
  if (isDev) {
    const scriptPath = path.join(aiDir, "main.py");
    const pythonBin = resolvePython(aiDir);
    console.log(`Starting AI service (dev): ${scriptPath} with ${pythonBin}`);
    aiProcess = child_process.spawn(pythonBin, [
      "-m",
      "uvicorn",
      "main:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(AI_PORT)
    ], {
      cwd: aiDir,
      env: buildChildEnv({
        AI_SERVICE_PORT: String(AI_PORT),
        AI_SERVICE_HOST: "127.0.0.1",
        BACKEND_URL: `http://127.0.0.1:${BACKEND_PORT}`,
        EVIDENCE_DIR: getEvidenceDir()
      }),
      stdio: "pipe"
    });
  } else {
    const exePath = path.join(aiDir, "security-ai-service.exe");
    if (!fs.existsSync(exePath)) {
      console.error(`AI service executable not found: ${exePath}`);
      return;
    }
    console.log(`Starting AI service (production): ${exePath}`);
    aiProcess = child_process.spawn(exePath, [], {
      cwd: aiDir,
      env: buildChildEnv({
        AI_SERVICE_PORT: String(AI_PORT),
        AI_SERVICE_HOST: "127.0.0.1",
        BACKEND_URL: `http://127.0.0.1:${BACKEND_PORT}`,
        EVIDENCE_DIR: getEvidenceDir()
      }),
      stdio: "pipe"
    });
  }
  (_a = aiProcess.stdout) == null ? void 0 : _a.on("data", (data) => {
    console.log(`[AI] ${data.toString().trim()}`);
  });
  (_b = aiProcess.stderr) == null ? void 0 : _b.on("data", (data) => {
    console.error(`[AI] ${data.toString().trim()}`);
  });
  aiProcess.on("exit", (code) => {
    console.log(`AI Service exited with code ${code}`);
    aiProcess = null;
  });
}
async function startMediaMTX() {
  var _a, _b;
  if (!await isPortAvailable(MEDIAMTX_PORT)) {
    console.log(`MediaMTX already running on port ${MEDIAMTX_PORT}`);
    return;
  }
  const mediaDir = getMediaMTXDir();
  const exePath = path.join(mediaDir, "mediamtx.exe");
  const configPath = path.join(mediaDir, "mediamtx.yml");
  if (!fs.existsSync(exePath)) {
    console.error(`MediaMTX not found: ${exePath}`);
    return;
  }
  if (!fs.existsSync(configPath)) {
    console.error(`MediaMTX config not found: ${configPath}`);
    return;
  }
  console.log(`Starting MediaMTX: ${exePath}`);
  mediamtxProcess = child_process.spawn(exePath, [configPath], {
    cwd: mediaDir,
    env: { ...process.env },
    stdio: "pipe"
  });
  (_a = mediamtxProcess.stdout) == null ? void 0 : _a.on("data", (data) => {
    console.log(`[MediaMTX] ${data.toString().trim()}`);
  });
  (_b = mediamtxProcess.stderr) == null ? void 0 : _b.on("data", (data) => {
    console.error(`[MediaMTX] ${data.toString().trim()}`);
  });
  mediamtxProcess.on("exit", (code) => {
    console.log(`MediaMTX exited with code ${code}`);
    mediamtxProcess = null;
  });
}
function waitForService(port, timeoutMs = 3e4) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const client = net.createConnection(port, "127.0.0.1");
      client.once("connect", () => {
        client.end();
        resolve(true);
      });
      client.once("error", () => {
        client.destroy();
        if (Date.now() - start > timeoutMs) {
          resolve(false);
        } else {
          setTimeout(check, 1e3);
        }
      });
    };
    check();
  });
}
const gotTheLock = electron.app.requestSingleInstanceLock();
if (!gotTheLock) {
  electron.app.quit();
}
electron.app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Security AI",
    backgroundColor: "#030712",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
electron.app.whenReady().then(async () => {
  if (!gotTheLock) return;
  console.log("Security AI starting...");
  console.log(`Mode: ${isDev ? "development" : "production"}`);
  electron.ipcMain.handle("open-file-dialog", async (_event, options) => {
    const result = await electron.dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: (options == null ? void 0 : options.filters) || [
        { name: "Videos", extensions: ["mp4", "avi", "mkv", "webm"] },
        { name: "Todos", extensions: ["*"] }
      ]
    });
    return result.canceled ? null : result.filePaths[0];
  });
  electron.ipcMain.handle("list-usb-devices", async () => {
    const { listUsbDevices } = await Promise.resolve().then(() => require("./usb-devices-CNFU4E-w.js"));
    return listUsbDevices();
  });
  createWindow();
  startBackend().catch((e) => console.error("Backend start error:", e));
  startAiService().catch((e) => console.error("AI start error:", e));
  startMediaMTX().catch((e) => console.error("MediaMTX start error:", e));
  const backendReady = await waitForService(BACKEND_PORT, 15e3);
  console.log(`Backend: ${backendReady ? "READY" : "TIMEOUT"}`);
  const aiReady = await waitForService(AI_PORT, 6e4);
  console.log(`AI Service: ${aiReady ? "READY" : "TIMEOUT"}`);
  const mediaReady = await waitForService(MEDIAMTX_PORT, 1e4);
  console.log(`MediaMTX: ${mediaReady ? "READY" : "TIMEOUT"}`);
});
function killProcess(proc, name) {
  if (!proc) return null;
  if (process.platform === "win32" && proc.pid) {
    try {
      child_process.spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      proc.kill();
    }
  } else {
    proc.kill();
  }
  console.log(`${name} stopped`);
  return null;
}
function killProcesses() {
  mediamtxProcess = killProcess(mediamtxProcess, "MediaMTX");
  aiProcess = killProcess(aiProcess, "AI Service");
  backendProcess = killProcess(backendProcess, "Backend");
}
electron.app.on("window-all-closed", () => {
  killProcesses();
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
electron.app.on("before-quit", () => {
  killProcesses();
});
