# Testing

## Overview

Security AI includes tests for backend, AI pipeline, and frontend.

## Backend Tests (Jest)

```bash
cd apps/backend
npm run test          # Unit tests
npm run test:e2e      # Integration tests
```

### Test Structure

```
apps/backend/test/
├── cameras.e2e-spec.ts
├── events.e2e-spec.ts
├── people.e2e-spec.ts
└── jest-e2e.json
```

## AI Service Tests (Pytest)

```bash
cd apps/ai
pip install pytest
python -m pytest tests/ -v
```

### Test Structure

```
apps/ai/tests/
├── test_motion_detector.py
├── test_yolo_detector.py
├── test_tracker.py
├── test_rule_engine.py
├── test_face_recognizer.py
└── test_video_buffer.py
```

### Test Categories

1. **Unit Tests**: Individual component testing
2. **Integration Tests**: Pipeline end-to-end
3. **Performance Tests**: FPS and latency benchmarks

## Frontend Tests

```bash
cd apps/desktop
npm run test
```

## Test Data

### Sample Video Files

Place test videos in `tests/fixtures/`:
- `test_motion.mp4`: Video with motion events
- `test_person.mp4`: Video with people walking
- `test_vehicle.mp4`: Video with vehicles
- `test_face.mp4`: Video with clear faces

### Generating Test Videos

```bash
# Create a simple test video with FFmpeg
ffmpeg -f lavfi -i testsrc=duration=30:size=1280x720:rate=25 -c:v libx264 tests/fixtures/test_motion.mp4
```

### Mock Data

Backend tests use SQLite in-memory database.
AI tests use mock frames generated with OpenCV.

## CI/CD

### Running All Tests

```bash
npm run test
cd apps/ai && python -m pytest tests/ -v
```

## Writing New Tests

### Backend

```typescript
describe('CamerasService', () => {
  it('should create a camera', async () => {
    const camera = await service.create({
      name: 'Test Camera',
      host: '192.168.1.100',
    });
    expect(camera.id).toBeDefined();
    expect(camera.name).toBe('Test Camera');
  });
});
```

### Python

```python
def test_motion_detection():
    detector = MotionDetector()
    frame = np.zeros((720, 1280, 3), dtype=np.uint8)
    has_motion, _ = detector.detect(frame)
    assert isinstance(has_motion, bool)
```
