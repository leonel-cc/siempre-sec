/**
 * Security AI - Build Bundle Script
 * Builds shared types, backend, AI service (frozen), and desktop app
 * before running electron-builder.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const BACKEND_DIR = path.join(ROOT, 'apps', 'backend');
const AI_DIR = path.join(ROOT, 'apps', 'ai');
const DESKTOP_DIR = path.join(ROOT, 'apps', 'desktop');

function run(cmd, cwd) {
  console.log(`\n> ${cmd}`);
  console.log(`  in ${cwd || ROOT}`);
  execSync(cmd, { cwd: cwd || ROOT, stdio: 'inherit', env: process.env });
}

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function resolvePythonLauncher() {
  const candidates = [
    { cmd: 'py', args: ['-3.12'] },
    { cmd: 'py', args: ['-3.11'] },
    { cmd: 'python', args: [] },
  ];
  if (process.env.PYTHON312) {
    return { cmd: `"${process.env.PYTHON312}"`, args: [] };
  }
  for (const candidate of candidates) {
    try {
      execFileSync(candidate.cmd, [...candidate.args, '--version'], { stdio: 'pipe' });
      return candidate;
    } catch (e) {
      // try next
    }
  }
  throw new Error('No Python found. Install Python 3.11+ and ensure it is on PATH.');
}

try {
  console.log('=== Building Security AI Bundle ===\n');

  // Clean old artifacts
  rmrf(path.join(DESKTOP_DIR, 'backend'));
  rmrf(path.join(DESKTOP_DIR, 'ai'));

  // 0. Fetch portable binaries (MediaMTX + FFmpeg)
  console.log('[0/6] Fetching portable binaries...');
  run('node scripts/fetch-binaries.js', DESKTOP_DIR);

  // 1. Build shared types
  console.log('[1/6] Building shared types...');
  run('npm run build:shared');

  // 2. Clean and build backend
  console.log('\n[2/6] Building backend...');
  const tsbuildinfoFiles = ['tsconfig.tsbuildinfo', 'tsconfig.build.tsbuildinfo'];
  tsbuildinfoFiles.forEach(f => {
    const fp = path.join(BACKEND_DIR, f);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  });
  run('npm run build:backend');

  const backendMain = path.join(BACKEND_DIR, 'dist', 'main.js');
  if (!fs.existsSync(backendMain)) {
    throw new Error(`Backend build failed: ${backendMain} not found`);
  }
  console.log('  Backend dist verified');

  // 3. Prepare standalone backend with its own node_modules
  console.log('\n[3/6] Preparing standalone backend for packaging...');
  const tempDir = path.join(os.tmpdir(), 'security-ai-build');
  rmrf(tempDir);
  fs.mkdirSync(tempDir, { recursive: true });

  const backendTemp = path.join(tempDir, 'backend');
  fs.mkdirSync(backendTemp, { recursive: true });

  // The workspace package @security-ai/shared is not published to any registry,
  // so strip it from the standalone package.json and vendor the compiled output
  // directly into node_modules.
  const backendPkg = JSON.parse(fs.readFileSync(path.join(BACKEND_DIR, 'package.json'), 'utf8'));
  delete backendPkg.dependencies['@security-ai/shared'];
  delete backendPkg.devDependencies;
  fs.writeFileSync(
    path.join(backendTemp, 'package.json'),
    JSON.stringify(backendPkg, null, 2),
  );
  fs.cpSync(path.join(BACKEND_DIR, 'dist'), path.join(backendTemp, 'dist'), { recursive: true });

  run('npm install --omit=dev --ignore-scripts', backendTemp);

  const sharedVendor = path.join(backendTemp, 'node_modules', '@security-ai', 'shared');
  fs.mkdirSync(sharedVendor, { recursive: true });
  fs.cpSync(path.join(ROOT, 'packages', 'shared', 'dist'), path.join(sharedVendor, 'dist'), { recursive: true });
  fs.copyFileSync(
    path.join(ROOT, 'packages', 'shared', 'package.json'),
    path.join(sharedVendor, 'package.json'),
  );
  console.log('  Backend staging ready with node_modules + vendored shared package');

  const backendTarget = path.join(DESKTOP_DIR, 'backend');
  fs.cpSync(backendTemp, backendTarget, { recursive: true });
  rmrf(tempDir);

  // 4. Freeze AI service with PyInstaller
  console.log('\n[4/6] Freezing AI service with PyInstaller...');
  const aiDist = path.join(AI_DIR, 'dist', 'security-ai-service');
  const aiTarget = path.join(DESKTOP_DIR, 'ai');

  if (fs.existsSync(path.join(aiDist, 'security-ai-service.exe'))) {
    console.log('  Frozen AI service found, copying...');
  } else {
    const py = resolvePythonLauncher();
    console.log(`  Using Python launcher: ${py.cmd} ${py.args.join(' ')}`);
    console.log('  Running PyInstaller...');
    run(`${py.cmd} ${py.args.join(' ')} -m pip install --quiet -r requirements.txt -r requirements-build.txt`, AI_DIR);
    run(`${py.cmd} ${py.args.join(' ')} -m PyInstaller --name security-ai-service --onedir --console --add-data "api;api" --add-data "detection;detection" --add-data "tracking;tracking" --add-data "recognition;recognition" --add-data "rules;rules" --add-data "buffer;buffer" --add-data "sources;sources" --add-data "discovery;discovery" --add-data "media;media" --collect-all ultralytics --hidden-import uvicorn --hidden-import uvicorn.logging --hidden-import uvicorn.loops --hidden-import uvicorn.loops.auto --hidden-import uvicorn.protocols --hidden-import uvicorn.protocols.http --hidden-import uvicorn.protocols.http.auto --hidden-import uvicorn.protocols.websockets --hidden-import uvicorn.protocols.websockets.auto --hidden-import uvicorn.lifespan --hidden-import uvicorn.lifespan.on --hidden-import uvicorn.lifespan.off --hidden-import config --hidden-import processor --hidden-import api.routes --hidden-import detection.motion_detector --hidden-import detection.yolo_detector --hidden-import detection.weapon_detector --hidden-import detection.face_cover_detector --hidden-import tracking.tracker --hidden-import recognition.face_recognizer --hidden-import rules.rule_engine --hidden-import buffer.video_buffer --hidden-import sources.file_source --hidden-import sources.rtsp_source --hidden-import discovery.onvif_discovery --hidden-import media.ffmpeg_helper main.py --noconfirm`, AI_DIR);
  }

  // Copy frozen AI to desktop + bundle YOLO weights
  fs.cpSync(aiDist, aiTarget, { recursive: true });
  const yoloSource = path.join(ROOT, 'yolov8n.pt');
  if (fs.existsSync(yoloSource)) {
    fs.copyFileSync(yoloSource, path.join(aiTarget, 'yolov8n.pt'));
    console.log('  yolov8n.pt bundled with AI service');
  } else {
    throw new Error(`YOLO weights not found: ${yoloSource}`);
  }
  console.log(`  AI service frozen to desktop/ai`);

  // Clean AI build artifacts
  rmrf(path.join(AI_DIR, 'build'));
  rmrf(path.join(AI_DIR, 'security-ai-service.spec'));

  // 5. Build desktop app
  console.log('\n[5/6] Building desktop app...');
  run('npm run build', DESKTOP_DIR);

  // 6. Clean staging dirs from desktop (keep them for electron-builder)
  console.log('\n[6/6] Finalizing bundle...');

  const backendSize = getDirSize(backendTarget);
  const aiSize = getDirSize(aiTarget);
  console.log(`  Backend: ${(backendSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  AI Service: ${(aiSize / 1024 / 1024).toFixed(1)} MB`);

  console.log('\n=== Bundle Ready for electron-builder ===');
  console.log('Run: cd apps/desktop && npx electron-builder --win --x64');

} catch (error) {
  console.error('\nBUILD FAILED:', error.message);
  process.exit(1);
}

function getDirSize(dir) {
  let size = 0;
  try {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fp = path.join(dir, file.name);
      if (file.isDirectory()) {
        size += getDirSize(fp);
      } else {
        size += fs.statSync(fp).size;
      }
    }
  } catch (e) {}
  return size;
}
