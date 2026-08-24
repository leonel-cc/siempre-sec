# Deployment

## Local Development

See [DEVELOPMENT.md](DEVELOPMENT.md)

## Docker Deployment

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+

### Steps

1. Clone the repository
2. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. Start all services:
   ```bash
   cd infrastructure/docker
   docker-compose up -d
   ```

4. Check status:
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

### Services

| Service | Port | Description |
|---------|------|------------|
| backend | 3000 | NestJS API |
| ai-service | 5000 | Python AI pipeline |
| mediamtx | 8554 | RTSP streaming |

## Windows Service (Future)

The architecture supports running as a Windows service:

1. Backend runs as a Node.js process
2. AI service runs as a Python process
3. MediaMTX runs as a background service
4. Electron UI connects to the backend

### Auto-start

Configure Windows Task Scheduler or NSSM to start services on boot:
- Backend: `node dist/main.js`
- AI: `uvicorn api.routes:router --host 0.0.0.0 --port 5000`
- MediaMTX: `mediamtx.exe mediamtx.yml`

## Hardware Requirements

### Minimum (CPU only)
- CPU: 4 cores
- RAM: 8GB
- Storage: 50GB SSD
- Network: 100Mbps

### Recommended
- CPU: 8 cores
- RAM: 16GB
- GPU: NVIDIA GTX 1650+ (optional, for faster inference)
- Storage: 256GB SSD
- Network: 1Gbps

### Camera Limits (CPU only)
- 1080p: 4-6 cameras
- 720p: 8-10 cameras

### Camera Limits (with GPU)
- 1080p: 10-15 cameras
- 720p: 15-20 cameras

## Monitoring

### System Health

```bash
curl http://localhost:3000/api/system/health
```

### Logs

Backend logs: Check terminal output or configure log files
AI service logs: Check uvicorn output
MediaMTX logs: stdout

## Backup

### Database
```bash
cp data/security-ai.db data/security-ai.db.backup
```

### Evidence
```bash
tar -czf evidence-backup.tar.gz evidence/
```

## Security Checklist

- [ ] .env file not committed to git
- [ ] Camera credentials encrypted
- [ ] RTSP not exposed to internet
- [ ] WhatsApp token secured
- [ ] Firewall configured
- [ ] Regular backups scheduled
- [ ] Log rotation configured
