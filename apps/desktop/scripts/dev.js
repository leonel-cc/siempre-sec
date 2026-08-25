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

function isPortServing(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: 'localhost', port, path: '/', timeout: 1000 }, res => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

(async () => {
  const out = logStream();
  const stamp = () => new Date().toISOString();
  out.write(`\n[${stamp()}] === dev session start ===\n`);

  const workspaceRoot = path.join(DESKTOP_DIR, '..', '..');
  const viteBin = path.join(workspaceRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  const electronBin = path.join(workspaceRoot, 'node_modules', 'electron', 'dist', 'electron.exe');

  let vite = null;
  let ownsVite = false;

  if (await isPortServing(5173)) {
    out.write(`[${stamp()}] reusing existing vite on :5173\n`);
  } else {
    if (!fs.existsSync(viteBin)) {
      out.write(`[${stamp()}] vite binary not found at ${viteBin}\n`);
      process.exit(1);
    }
    vite = spawn(process.execPath, [viteBin], {
      cwd: DESKTOP_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    ownsVite = true;
    vite.stdout.pipe(out, { end: false });
    vite.stderr.pipe(out, { end: false });

    try {
      await waitPort(5173, 60000);
      out.write(`[${stamp()}] vite ready\n`);
    } catch (e) {
      out.write(`[${stamp()}] vite failed to start: ${e.message}\n`);
      vite.kill();
      process.exit(1);
    }
  }

  const electron = spawn(electronBin, ['.'], {
    cwd: DESKTOP_DIR,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  electron.stdout.pipe(out, { end: false });
  electron.stderr.pipe(out, { end: false });
  out.write(`[${stamp()}] electron started (pid ${electron.pid})\n`);

  electron.on('exit', code => {
    out.write(`[${stamp()}] electron exited (${code})${ownsVite ? ', stopping vite' : ''}\n`);
    if (ownsVite && vite) vite.kill();
    process.exit(0);
  });
  if (vite) {
    vite.on('exit', code => {
      out.write(`[${stamp()}] vite exited (${code}) — killing electron so no blank window remains\n`);
      try { electron.kill(); } catch {}
      process.exit(1);
    });
  }
})();
