# Camera Setup

## Supported Connection Types

### 1. RTSP (Primary)

Most IP cameras support RTSP streaming.

**Adding a camera manually:**
- Host: Camera IP address
- Port: 554 (default)
- Username: Camera username
- Password: Camera password
- RTSP URL: Full RTSP path

**Common RTSP URL patterns:**
```
rtsp://user:pass@192.168.1.100:554/stream1
rtsp://user:pass@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0
rtsp://user:pass@192.168.1.100:554/live
```

### 2. ONVIF Discovery

Automatically find cameras on the local network:

1. Click "Buscar Cámaras" in the Cameras screen
2. The system sends WS-Discovery probes on the local network
3. Found devices are listed with manufacturer and model info
4. Enter credentials to connect

**Requirements:**
- Camera must support ONVIF
- Camera must be on the same local network
- No firewall blocking UDP multicast

### 3. Camera Simulator (Development)

For testing without a real camera:

```bash
# Using FFmpeg
ffmpeg -re -i video.mp4 -c copy -f rtsp rtsp://localhost:8554/camera_sim

# Loop the video
ffmpeg -re -stream_loop -1 -i video.mp4 -c copy -f rtsp rtsp://localhost:8554/camera_sim
```

## Camera Entity

| Field | Description |
|-------|------------|
| name | Display name |
| host | IP address or hostname |
| port | RTSP port (default 554) |
| username | Authentication username |
| rtsp_url | Full RTSP stream URL |
| onvif_enabled | Whether ONVIF is available |
| enabled | Whether camera is active |
| connection_type | RTSP, ONVIF, FILE, WEBCAM |
| status | ONLINE, OFFLINE, CONNECTING, ERROR, DISABLED |

## Reconnection

The system automatically reconnects to cameras that go offline:
- Initial retry: 5 seconds
- Exponential backoff up to 60 seconds
- Reset backoff on successful reconnection

## Security

- Camera passwords are stored securely (never in plaintext in logs)
- RTSP streams are NOT exposed to the internet
- All camera communication stays within the local network
- WhatsApp notifications only send when explicitly triggered by alert rules
