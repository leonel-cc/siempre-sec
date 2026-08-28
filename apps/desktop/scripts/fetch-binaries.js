/**
 * Security AI - Fetch Portable Binaries
 * Downloads MediaMTX and FFmpeg portable builds for Windows x64.
 *
 *  - MediaMTX -> apps/desktop/mediamtx/mediamtx.exe   (latest GitHub release)
 *  - FFmpeg   -> apps/desktop/bin/ffmpeg.exe|ffprobe.exe (gyan.dev essentials)
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const MEDIAMTX_DIR = path.join(ROOT, 'apps', 'desktop', 'mediamtx');
const BIN_DIR = path.join(ROOT, 'apps', 'desktop', 'bin');
const MODELS_DIR = path.join(ROOT, 'apps', 'desktop', 'models');
const TEMP_DIR = path.join(require('os').tmpdir(), 'security-ai-binaries');
const PINNED_MEDIAMTX_VERSION = 'v1.12.0';

function log(msg) {
  console.log(`[fetch-binaries] ${msg}`);
}

function httpsGet(url, { followRedirects = true } = {}) {
  return new Promise((resolve, reject) => {
    const request = (u, redirectsLeft) => {
      https
        .get(u, { headers: { 'User-Agent': 'security-ai-build' } }, (res) => {
          if (followRedirects && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));
            return request(new URL(res.headers.location).toString(), redirectsLeft - 1);
          }
          resolve(res);
        })
        .on('error', reject);
    };
    request(url, 10);
  });
}

async function downloadFile(url, destFile) {
  const res = await httpsGet(url);
  if (res.statusCode !== 200) {
    throw new Error(`Download failed (${res.statusCode}): ${url}`);
  }
  const total = parseInt(res.headers['content-length'] || '0', 10);
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destFile);
    let received = 0;
    let lastPct = -1;
    res.on('data', (chunk) => {
      received += chunk.length;
      if (total) {
        const pct = Math.floor((received / total) * 100);
        if (pct !== lastPct && pct % 5 === 0) {
          lastPct = pct;
          log(`  ${pct}% (${(received / 1024 / 1024).toFixed(1)} MB)`);
        }
      }
      out.write(chunk);
    });
    res.on('end', () => out.end(resolve));
    res.on('error', reject);
    out.on('error', reject);
  });
}

function extractZip(zipFile, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  execFileSync('powershell.exe', [
    '-NoProfile', '-Command',
    `Expand-Archive -LiteralPath '${zipFile}' -DestinationPath '${destDir}' -Force`,
  ], { stdio: 'inherit' });
}

function findInDir(dir, fileName) {
  const queue = [dir];
  while (queue.length) {
    const current = queue.shift();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) queue.push(full);
      else if (entry.name.toLowerCase() === fileName) return full;
    }
  }
  return null;
}

async function resolveMediaMTXUrl() {
  try {
    log('Querying latest MediaMTX release...');
    const res = await httpsGet('https://api.github.com/repos/bluenviron/mediamtx/releases/latest');
    let body = '';
    for await (const chunk of res) body += chunk;
    const release = JSON.parse(body);
    const asset = (release.assets || []).find(
      (a) => a.name.includes('windows_amd64') && a.name.endsWith('.zip'),
    );
    if (asset) {
      log(`Latest release: ${release.tag_name}`);
      return asset.browser_download_url;
    }
  } catch (e) {
    log(`GitHub API failed (${e.message}), falling back to pinned version`);
  }
  return `https://github.com/bluenviron/mediamtx/releases/download/${PINNED_MEDIAMTX_VERSION}/mediamtx_${PINNED_MEDIAMTX_VERSION}_windows_amd64.zip`;
}

async function fetchMediaMTX() {
  const target = path.join(MEDIAMTX_DIR, 'mediamtx.exe');
  if (fs.existsSync(target)) {
    log('MediaMTX already present, skipping');
    return;
  }
  const url = await resolveMediaMTXUrl();
  log(`Downloading MediaMTX...`);
  const zipFile = path.join(TEMP_DIR, 'mediamtx.zip');
  await downloadFile(url, zipFile);
  extractZip(zipFile, path.join(TEMP_DIR, 'mediamtx'));
  const exe = findInDir(path.join(TEMP_DIR, 'mediamtx'), 'mediamtx.exe');
  if (!exe) throw new Error('mediamtx.exe not found inside downloaded zip');
  fs.mkdirSync(MEDIAMTX_DIR, { recursive: true });
  fs.copyFileSync(exe, target);
  log(`MediaMTX ready: ${target}`);
}

async function fetchFFmpeg() {
  const target = path.join(BIN_DIR, 'ffmpeg.exe');
  if (fs.existsSync(target)) {
    log('FFmpeg already present, skipping');
    return;
  }
  const url = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';
  log('Downloading FFmpeg (essentials)...');
  const zipFile = path.join(TEMP_DIR, 'ffmpeg.zip');
  await downloadFile(url, zipFile);
  extractZip(zipFile, path.join(TEMP_DIR, 'ffmpeg'));
  const ffmpeg = findInDir(path.join(TEMP_DIR, 'ffmpeg'), 'ffmpeg.exe');
  if (!ffmpeg) throw new Error('ffmpeg.exe not found inside downloaded zip');
  fs.mkdirSync(BIN_DIR, { recursive: true });
  fs.copyFileSync(ffmpeg, target);
  const ffprobe = findInDir(path.join(TEMP_DIR, 'ffmpeg'), 'ffprobe.exe');
  if (ffprobe) fs.copyFileSync(ffprobe, path.join(BIN_DIR, 'ffprobe.exe'));
  log(`FFmpeg ready: ${target}`);
}

async function fetchModels() {
  const models = [
    {
      name: 'weapon-best.pt',
      url: 'https://huggingface.co/Hadi959/weapon-detection-yolov8/resolve/1c7397a7f9268ed60611650cdad936e306a3dc04/best.pt',
    },
    {
      name: 'weapon-verifier.pt',
      url: 'https://huggingface.co/Subh775/Threat-Detection-YOLOv8n/resolve/c6d6fa4e6c9bfd4c4fccb46478db23609e5468fb/weights/best.pt',
    },
    {
      name: 'face-cover-best.pt',
      url: 'https://raw.githubusercontent.com/STAVAN04/face_covered_or_uncovered_detection/1791c6e7deee9c1d0092341ceff605eab196687d/best.pt',
    },
    {
      name: 'face-detection-yunet.onnx',
      url: 'https://raw.githubusercontent.com/opencv/opencv_zoo/f12e12798e8314f7c074a6656816c048dcc95b7a/models/face_detection_yunet/face_detection_yunet_2023mar.onnx',
    },
  ];
  fs.mkdirSync(MODELS_DIR, { recursive: true });
  for (const model of models) {
    const target = path.join(MODELS_DIR, model.name);
    if (fs.existsSync(target)) {
      log(`${model.name} already present, skipping`);
      continue;
    }
    log(`Downloading ${model.name}...`);
    await downloadFile(model.url, target);
  }
}

(async () => {
  try {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    await fetchMediaMTX();
    await fetchFFmpeg();
    await fetchModels();
    log('All binaries ready');
  } catch (e) {
    console.error('[fetch-binaries] FAILED:', e.message);
    process.exit(1);
  }
})();
