# Security

## Principles

1. **Local Processing First**: All AI inference happens locally. No video data is sent to external services for analysis.
2. **Minimal Data Exposure**: Only alert notifications (with user consent) leave the device.
3. **Defense in Depth**: Multiple security layers for credentials, network, and data.

## Credential Management

### Storage
- Camera passwords: Stored in database (encrypted in future versions)
- WhatsApp API tokens: Environment variables only
- Never hardcoded in source code
- Never logged or written to debug output

### Environment Variables
```env
# NEVER commit these values
WHATSAPP_API_TOKEN=<your_token>
JWT_SECRET=<random_secret>
```

### .gitignore
The following are always excluded:
- `.env` files
- Database files (`*.db`)
- Evidence recordings
- Face embeddings cache
- YOLO model weights

## Network Security

### Camera Communication
- RTSP streams stay within the local network
- No port forwarding for camera streams
- ONVIF discovery limited to local subnet

### API Security
- Backend listens on localhost by default
- CORS restricted to known origins
- Input validation on all endpoints
- SQL injection prevented by TypeORM parameterized queries

### Remote Access
- Use Tailscale or WireGuard for secure remote access
- Never expose RTSP or API directly to the internet
- Consider authentication for remote dashboard access

## Data Privacy

### Facial Recognition
- All face processing is local
- Embeddings stored locally, never transmitted
- User can delete all facial data at any time
- No cloud-based face recognition

### Video Evidence
- Stored locally in designated directory
- Only sent via WhatsApp when user triggers an alert
- Auto-deleted based on retention policy

### WhatsApp Notifications
- Disabled by default
- User explicitly configures recipient number
- Only alert-triggering events generate notifications
- User can disable at any time

## Input Validation

- All API inputs validated with class-validator
- File paths sanitized to prevent directory traversal
- Camera URLs validated before connection
- User inputs escaped in all contexts

## Logging Security

- Passwords and tokens NEVER appear in logs
- Sensitive fields are redacted
- Log files stored locally only

## Dependencies

- Regularly audit npm and pip dependencies
- Use known, maintained packages
- Lock dependency versions
