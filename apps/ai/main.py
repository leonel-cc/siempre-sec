import sys
import os
import time
import json
import urllib.request
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router as api_router
from processor import FrameProcessor
import config


app = FastAPI(
    title="Security AI - AI Service",
    description="Computer Vision Pipeline for Security AI",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

_processor: FrameProcessor = None
_backend_url: str = os.environ.get('BACKEND_URL', 'http://127.0.0.1:3000')


def get_processor() -> FrameProcessor:
    return _processor


@app.on_event("startup")
async def startup():
    global _processor
    print("Starting Security AI Service...")
    print(f"YOLO model: {config.YOLO_MODEL}")
    print(f"Confidence threshold: {config.YOLO_CONFIDENCE_THRESHOLD}")
    print(f"Inference FPS: {config.INFERENCE_FPS}")
    print(f"Face threshold: {config.FACE_RECOGNITION_THRESHOLD}")
    print(f"Weapon detection: {'enabled' if config.WEAPON_ENABLED else 'disabled'}")

    _processor = FrameProcessor()
    _processor.load_models()
    _processor.rule_engine.load_default_rules()
    _processor._stats['start_time'] = time.time()
    _processor.set_callbacks(
        detection_callback=_on_detection,
        alert_callback=_on_alert,
    )
    print("AI Service ready")


@app.on_event("shutdown")
async def shutdown():
    global _processor
    if _processor:
        _processor.stop_all()
    print("AI Service stopped")


def _on_detection(camera_id, detections, face_results):
    count = len(detections)
    if count > 0:
        classes = set(d['class'] for d in detections)
        print(f"[{camera_id}] Detected: {', '.join(classes)} ({count} objects)")


def _on_alert(camera_id, alert, clip_path, snapshot_path=""):
    print(f"[{camera_id}] ALERT [{alert.get('severity', 'MEDIUM')}]: {alert.get('rule_name', 'Unknown')} -> {clip_path}")

    event_data = {
        'camera_id': camera_id,
        'event_type': 'SECURITY_ALERT',
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'confidence': alert.get('detection', {}).get('confidence', 0.0),
        'video_path': clip_path,
        'snapshot_path': snapshot_path,
        'metadata': {
            'rule_id': alert.get('rule_id'),
            'rule_name': alert.get('rule_name'),
            'severity': alert.get('severity'),
            'identity': alert.get('identity'),
            'zone_type': alert.get('zone_type'),
            'actions': alert.get('actions', []),
        },
    }

    try:
        req = urllib.request.Request(
            f'{_backend_url}/api/events',
            data=json.dumps(event_data).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"[{camera_id}] Event posted to backend: {resp.status}")
    except Exception as e:
        print(f"[{camera_id}] Failed to post event to backend: {e}")


if __name__ == "__main__":
    is_frozen = getattr(sys, 'frozen', False)
    uvicorn.run(
        "main:app",
        host=config.AI_SERVICE_HOST,
        port=config.AI_SERVICE_PORT,
        reload=False,
    )
