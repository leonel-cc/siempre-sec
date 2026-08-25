const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DESKTOP_DIR = path.join(__dirname, '..');
const LOG_FILE = path.join(DESKTOP_DIR, 'dev.log');

function logStream() {
  return fs.createWriteStream(LOG_FILE, { flags: 'a' });
}

function waitPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get({ host: 'localhost', port, path: '/', timeout: 1000 }, res => {
        res.resume();
        resolve();
      });
      req.on('error', () => retry());
      req.on('timeout', () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() > deadline) reject(new Error(`port ${port} not ready after ${timeoutMs}ms`));
      else setTimeout(attempt, 500);
    };
    attempt();
  });
}

(async () => {
  const out = logStream();
  const stamp = () => new Date().toISOString();
  out.write(`\n[${stamp()}] === dev session start ===\n`);

  const workspaceRoot = path.join(DESKTOP_DIR, '..', '..');
  const viteBin = path.join(workspaceRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  const electronBin = path.join(workspaceRoot, 'node_modules', 'electron', 'dist', 'electron.exe');

  if (!fs.existsSync(viteBin)) {
    out.write(`[${stamp()}] vite binary not found at ${viteBin}\n`);
    process.exit(1);
  }
  const vite = spawn(process.execPath, [viteBin], {
    cwd: DESKTOP_DIR,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  vite.stdout.pipe(out, { end: false });
  vite.stderr.pipe(out, { end: false });

  let electron;
  try {
    await waitPort(5173, 60000);
    out.write(`[${stamp()}] vite ready\n`);
  } catch (e) {
    out.write(`[${stamp()}] vite failed to start: ${e.message}\n`);
    vite.kill();
    process.exit(1);
  }

  electron = spawn(electronBin, ['.'], {
    cwd: DESKTOP_DIR,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  electron.stdout.pipe(out, { end: false });
  electron.stderr.pipe(out, { end: false });
  out.write(`[${stamp()}] electron started (pid ${electron.pid})\n`);

  electron.on('exit', code => {
    out.write(`[${stamp()}] electron exited (${code}), stopping vite\n`);
    vite.kill();
    process.exit(0);
  });
  vite.on('exit', code => {
    out.write(`[${stamp()}] vite exited (${code}) — killing electron so no blank window remains\n`);
    try { electron.kill(); } catch {}
    process.exit(1);
  });
})();
