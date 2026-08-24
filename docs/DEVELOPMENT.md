# Development Guide

## Prerequisites

- **Node.js** 20+ (recommended: latest LTS)
- **Python** 3.11+
- **FFmpeg** (must be in PATH)
- **Git**
- **Windows**: Visual C++ Build Tools (for native modules)

## Initial Setup

### 1. Clone and install

```bash
git clone <repo-url> security-ai
cd security-ai

# Install Node.js dependencies
npm install

# Install Python dependencies
cd apps/ai
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
cd ../..
```

### 2. Environment Configuration

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Build shared types

```bash
npm run build:shared
```

## Development Workflow

### Running Services Separately

**Terminal 1 - Backend:**
```bash
npm run dev:backend
```
Backend runs on http://localhost:3000

**Terminal 2 - AI Service:**
```bash
cd apps/ai
uvicorn api.routes:router --reload --port 5000
```
AI service runs on http://localhost:5000

**Terminal 3 - Desktop App:**
```bash
npm run dev:desktop
```
Electron app opens with hot reload

### Camera Simulator

Test without a real camera:

```bash
# Stream an MP4 file as RTSP
ffmpeg -re -i test_video.mp4 -c copy -f rtsp rtsp://localhost:8554/camera_sim
```

Then add this camera in the app:
- Name: Test Camera
- Host: localhost
- Port: 8554
- RTSP URL: rtsp://localhost:8554/camera_sim

## Available Scripts

| Script | Description |
|--------|------------|
| `npm run dev:desktop` | Start Electron app with Vite dev server |
| `npm run dev:backend` | Start NestJS backend with hot reload |
| `npm run build:desktop` | Build Electron app for production |
| `npm run build:backend` | Build NestJS backend |
| `npm run build:shared` | Build shared types package |
| `npm run lint` | Run linting across all packages |
| `npm run test` | Run tests across all packages |

## Database Migrations

The backend uses TypeORM with `synchronize: false`. Migrations run automatically on startup.

To create a new migration:

```bash
cd apps/backend
npx typeorm migration:generate src/database/migrations/MigrationName -d src/database/data-source.ts
```

## Testing

### Backend Tests

```bash
cd apps/backend
npm run test
```

### Python Tests

```bash
cd apps/ai
python -m pytest tests/ -v
```

## Code Style

### TypeScript

- Strict mode enabled
- Use interfaces for all DTOs
- Follow NestJS conventions (modules, controllers, services)
- Use TypeORM entities for database models

### Python

- Type hints on all functions
- Use dataclasses or Pydantic for data structures
- Follow PEP 8

## Debugging

### Backend

The NestJS backend uses `nest start --watch` which provides:
- Automatic restart on file changes
- Detailed error messages in terminal

### AI Service

Use `--reload` flag with uvicorn for auto-reload:
```bash
uvicorn api.routes:router --reload --port 5000
```

### Electron

DevTools are automatically opened in development mode. Use:
- `Ctrl+Shift+I` for renderer DevTools
- Main process logs appear in the terminal

## Common Issues

### FFmpeg not found
Ensure FFmpeg is installed and in your system PATH.

### SQLite locked
Make sure only one instance of the backend is running.

### YOLO model download
First run will download the YOLO model (~6MB for yolov8n). Ensure internet access on first run.

### InsightFace model
First run downloads the buffalo_l model (~300MB). Subsequent runs use the cached model.
