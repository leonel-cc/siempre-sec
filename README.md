# Security AI

Intelligent video surveillance system with AI-powered detection, tracking, and recognition.

## Features

- **Camera Management**: ONVIF discovery, RTSP streaming, manual configuration
- **Motion Detection**: Background subtraction with configurable sensitivity
- **Object Detection**: YOLO v8 for person, vehicle, and object detection
- **Object Tracking**: Persistent tracking IDs across frames
- **Face Recognition**: Local recognition using InsightFace
- **Zone Management**: Draw monitoring and restricted zones on camera views
- **Rule Engine**: Configurable alert rules with conditions and schedules
- **Video Buffer**: Circular buffer with pre/post-event clip generation
- **Alerts**: WhatsApp Business API notifications with evidence
- **Dashboard**: Real-time monitoring with system health status
- **24/7 Service**: Background processing independent of UI

## Architecture

```
CAMERAS → RTSP → MediaMTX → FFmpeg
                ↓
          VIDEO BUFFER + PYTHON AI
                ↓
      Motion → YOLO → Tracking → Face Recognition
                ↓
        Zones + Rules → Security Event
                ↓
      Video Clip + Snapshot + Database
                ↓
        Dashboard + WhatsApp Alert
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Electron, React, TypeScript, Vite, Tailwind CSS |
| Backend | NestJS, TypeScript, TypeORM, SQLite |
| AI Service | Python, OpenCV, YOLO (Ultralytics), InsightFace |
| Streaming | MediaMTX, FFmpeg |
| Notifications | WhatsApp Business API |
| Containerization | Docker, Docker Compose |

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- FFmpeg installed and in PATH
- Git

### Development Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   cd apps/ai && pip install -r requirements.txt
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Start backend:
   ```bash
   npm run dev:backend
   ```

5. Start AI service:
   ```bash
   cd apps/ai
   uvicorn api.routes:router --reload --port 5000
   ```

6. Start desktop app:
   ```bash
   npm run dev:desktop
   ```

### Docker Setup

```bash
cd infrastructure/docker
docker-compose up -d
```

### Camera Simulator (Development)

Stream a video file as RTSP for testing without a real camera:

```bash
ffmpeg -re -i video.mp4 -c copy -f rtsp rtsp://localhost:8554/camera_sim
```

## Project Structure

```
security-ai/
├── apps/
│   ├── desktop/          # Electron + React UI
│   ├── backend/          # NestJS API server
│   └── ai/               # Python AI service
├── packages/
│   └── shared/           # Shared TypeScript types
├── services/
│   └── media/            # MediaMTX configuration
├── infrastructure/
│   └── docker/           # Docker files
├── docs/                 # Documentation
└── tests/                # Test suites
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Camera Setup](docs/CAMERAS.md)
- [AI Pipeline](docs/AI.md)
- [WhatsApp Integration](docs/WHATSAPP.md)
- [API Reference](docs/API.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Security](docs/SECURITY.md)
- [Testing](docs/TESTING.md)

## License

Private - All rights reserved.
