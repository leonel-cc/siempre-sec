# AI Pipeline

## Overview

The AI pipeline processes video frames through multiple stages:

```
Frame → Motion Detection → YOLO Detection → Tracking → Face Recognition → Rule Engine
```

## Motion Detection

**Technology**: OpenCV Background Subtraction (MOG2)

Purpose: Reduce unnecessary YOLO inference by only running detection when motion is present.

**Parameters:**
- `sensitivity`: 0.0 - 1.0 (default: 0.5)
- `min_area`: Minimum contour area in pixels (default: 500)

## Object Detection

**Technology**: YOLO v8 (Ultralytics)

**Default model**: `yolov8n.pt` (nano, ~6MB, fastest)

**Supported classes:**
- person, car, motorcycle, bicycle, dog, cat

**Parameters:**
- `confidence_threshold`: 0.0 - 1.0 (default: 0.5)
- `inference_fps`: Frames per second to run inference (default: 5)

**Each detection includes:**
```json
{
  "class": "person",
  "confidence": 0.94,
  "bbox": { "x": 100, "y": 200, "width": 120, "height": 300 },
  "tracking_id": 12
}
```

## Object Tracking

**Technology**: Custom centroid-based tracker

Maintains persistent IDs across frames:
- Person #12 appears at 02:14:20
- Person #12 still tracked at 02:14:25
- Person #12 leaves at 02:14:40

This enables:
- Presence duration calculation
- Reducing duplicate alerts
- Path tracking

## Face Recognition

**Technology**: InsightFace (buffalo_l model)

**Process:**
1. Detect face in frame
2. Generate 512-dimensional embedding
3. Compare against registered embeddings
4. Return match with confidence score

**Parameters:**
- `face_threshold`: Minimum similarity score (default: 0.6)

**Identity states:**
- `KNOWN_PERSON`: Match found above threshold
- `UNKNOWN_PERSON`: Face detected but no match
- `UNRECOGNIZED`: No face detected or recognition unavailable

## Rule Engine

Evaluates conditions against detections:

```python
IF:
  detected_object == "person"
AND:
  identity == "unknown"
AND:
  zone_type == "restricted"
AND:
  time between 23:00 and 07:00
AND:
  presence_duration >= 5 seconds
THEN:
  CREATE_ALERT
```

## Video Buffer

Circular buffer maintaining the last 30 seconds of video per camera.

When an alert triggers:
- Pre-event: 15 seconds before
- Post-event: 15 seconds after
- Total clip: ~30 seconds

The pre-event footage is already in the buffer - no need to start recording at detection time.

## Performance

### CPU Mode (Default)
- YOLO nano: ~30ms per frame
- Motion detection: ~5ms per frame
- Face recognition: ~100ms per face

### GPU Mode (NVIDIA)
- Automatic detection on startup
- ~3x faster inference with CUDA
- Requires `onnxruntime-gpu` or `ultralytics[gpu]`

## Configuration

All parameters can be configured via:
1. Environment variables
2. Settings screen in the dashboard
3. REST API
