# API Reference

Base URL: `http://localhost:3000/api`

## Cameras

### List cameras
```
GET /cameras
```

### Get camera
```
GET /cameras/:id
```

### Create camera
```
POST /cameras
Body: {
  "name": "Front Door",
  "host": "192.168.1.100",
  "port": 554,
  "username": "admin",
  "password": "secret",
  "connection_type": "RTSP"
}
```

### Update camera
```
PUT /cameras/:id
Body: { partial fields }
```

### Delete camera
```
DELETE /cameras/:id
```

### Discover cameras (ONVIF)
```
POST /cameras/discover
```

## Events

### List events
```
GET /events?limit=50&offset=0
```

### Get event
```
GET /events/:id
```

### Update event status
```
PUT /events/:id/status
Body: { "status": "REVIEWED" }
```

### Delete event
```
DELETE /events/:id
```

## People

### List people
```
GET /people
```

### Get person
```
GET /people/:id
```

### Create person
```
POST /people
Body: { "name": "Leonel" }
```

### Update person
```
PUT /people/:id
Body: { "name": "Leo", "enabled": true }
```

### Delete person
```
DELETE /people/:id
```

### Add face embedding
```
POST /people/:id/embeddings
Body: { "embedding": [0.1, 0.2, ...] }
```

## Zones

### List zones
```
GET /zones?camera_id=optional
```

### Get zone
```
GET /zones/:id
```

### Create zone
```
POST /zones
Body: {
  "camera_id": "uuid",
  "name": "Restricted Area",
  "polygon": [{"x": 0, "y": 0}, {"x": 100, "y": 0}, {"x": 100, "y": 100}],
  "type": "RESTRICTED"
}
```

### Update zone
```
PUT /zones/:id
Body: { partial fields }
```

### Delete zone
```
DELETE /zones/:id
```

## Rules

### List rules
```
GET /rules
```

### Get rule
```
GET /rules/:id
```

### Create rule
```
POST /rules
Body: {
  "name": "Night restricted zone alert",
  "conditions": [
    { "field": "object_class", "operator": "equals", "value": "person" },
    { "field": "identity", "operator": "equals", "value": "unknown" },
    { "field": "zone_type", "operator": "equals", "value": "restricted" }
  ],
  "actions": ["CREATE_ALERT", "SEND_NOTIFICATION"],
  "schedule": {
    "enabled": true,
    "start_time": "23:00",
    "end_time": "07:00",
    "days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
  },
  "cooldown_seconds": 60
}
```

### Update rule
```
PUT /rules/:id
Body: { partial fields }
```

### Delete rule
```
DELETE /rules/:id
```

## System

### Health check
```
GET /system/health
Response: {
  "backend": { "status": "ONLINE", "last_check": "..." },
  "ai_service": { "status": "ONLINE", "last_check": "..." },
  "mediamtx": { "status": "ONLINE", "last_check": "..." },
  "database": { "status": "ONLINE", "last_check": "..." },
  "system": { "cpu_usage_percent": 25.5, "memory_usage_percent": 60.2, ... }
}
```

## WebSocket Events

Connect to `ws://localhost:3000`:

| Event | Description |
|-------|------------|
| `camera.status_changed` | Camera went online/offline |
| `detection.created` | New object detected |
| `tracking.updated` | Tracking state changed |
| `face.recognized` | Face matched/unknown |
| `security.alert` | Alert triggered |
| `event.created` | New event in database |
| `notification.sent` | WhatsApp sent successfully |
| `notification.failed` | WhatsApp send failed |
| `system.metrics` | System resource metrics |

## AI Service API

Base URL: `http://localhost:5000`

### Health check
```
GET /health
```

### Detect objects in image
```
POST /detect
Body: {
  "camera_id": "camera1",
  "image_base64": "base64_encoded_image"
}
```

### Generate face embedding
```
POST /embedding
Body: {
  "image_base64": "base64_encoded_face",
  "person_id": "person-uuid"
}
```

### Register face embeddings
```
POST /register-face?person_id=person-uuid
Body: [[0.1, 0.2, ...], [0.3, 0.4, ...]]
```
