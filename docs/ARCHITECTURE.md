# Architecture

## System Overview

Security AI is designed as a modular system with clear separation of concerns:

```
┌─────────────────────────────────────────────────┐
│                  ELECTRON / REACT                │
│    Dashboard │ Cameras │ Events │ Configuration  │
└─────────────────────┬───────────────────────────┘
                      │ HTTP + WebSocket
┌─────────────────────┴───────────────────────────┐
│                 NESTJS BACKEND                   │
│  API │ Database │ Rules │ Events │ Notifications │
└──────────┬──────────────────┬───────────────────┘
           │                  │
┌──────────┴──────┐  ┌───────┴──────────────────┐
│   PYTHON AI     │  │      MEDIA PIPELINE       │
│ YOLO │ OpenCV   │  │  MediaMTX │ FFmpeg │ RTSP │
│ Tracking │ Face  │  │  Video Buffer │ Recording │
└─────────────────┘  └──────────────────────────┘
```

## Components

### 1. Desktop Application (Electron + React)

**Responsibility**: User interface only

- Live camera views
- Dashboard with metrics
- Configuration panels
- Event viewer
- People management
- Zone editor

**Does NOT contain**: Business logic, AI processing, data persistence

### 2. Backend API (NestJS)

**Responsibility**: Business logic and data management

- REST API for all CRUD operations
- WebSocket server for real-time events
- Camera management and status tracking
- Event storage and retrieval
- Rule management
- Notification dispatching
- System health monitoring

**Database**: SQLite via TypeORM (migratable to PostgreSQL)

### 3. AI Service (Python)

**Responsibility**: Computer vision pipeline

- Motion detection (background subtraction)
- Object detection (YOLO v8)
- Object tracking (custom tracker)
- Face recognition (InsightFace)
- Rule evaluation

**Runs independently**: Can process frames from any source

### 4. Media Pipeline

**Responsibility**: Video stream management

- MediaMTX for RTSP stream routing
- FFmpeg for transcoding and recording
- Video buffer for pre/post-event clips

## Data Flow

### Detection Pipeline

```
Frame Input
    ↓
Motion Detection
    ↓ (if motion)
YOLO Detection
    ↓
Object Tracking
    ↓
Face Recognition
    ↓
Rule Engine Evaluation
    ↓ (if rule matches)
Security Event
    ↓
Video Clip Generation
    ↓
Database Storage
    ↓
WebSocket Broadcast → Dashboard
    ↓
Notification → WhatsApp
```

### Camera Stream Flow

```
IP Camera (RTSP)
    ↓
MediaMTX (stream routing)
    ↓
FFmpeg (decode + buffer)
    ↓
Frame extraction
    ↓
AI Pipeline
```

## Communication

- **Desktop ↔ Backend**: REST API + WebSocket
- **Backend ↔ AI Service**: HTTP API
- **Backend ↔ MediaMTX**: RTSP + HTTP API
- **Backend ↔ WhatsApp**: HTTPS (Graph API)

## Scalability Path

### Phase 1: Single PC
- All services on one machine
- SQLite database
- Local processing

### Phase 2: Mini Server
- Docker deployment
- Systemd service management
- Health checks and auto-restart

### Phase 3: Multi-camera
- Multiple AI workers
- PostgreSQL migration
- Remote access via Tailscale

## Security Boundaries

- ONVIF discovery restricted to local network
- RTSP streams not exposed to internet
- Credentials encrypted at rest
- No external AI inference (all local)
- WhatsApp images sent only on user-configured alerts
