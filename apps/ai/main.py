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
from runtime import InferenceRuntime
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
    print(f"AI device preference: {config.AI_DEVICE}")
    print(f"Face threshold: {config.FACE_RECOGNITION_THRESHOLD}")
    print(f"Weapon detection: {'enabled' if config.WEAPON_ENABLED else 'disabled'}")

    _processor = FrameProcessor()
    print(f"Selected AI device: {_processor.runtime.device}")
    print(f"Object inference FPS: {_processor.runtime.get_object_fps()}")
    print(f"Weapon inference FPS: {_processor.runtime.get_weapon_fps()}")
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
        'event_type': alert.get('event_type'),
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'confidence': alert.get('evidence', {}).get(
            'confidence', alert.get('weapon', {}).get(
                'confidence', alert.get('detection', {}).get('confidence', 0.0))),
        'tracking_id': alert.get('tracking_id'),
        'video_path': clip_path,
        'snapshot_path': snapshot_path,
        'metadata': {
            'rule_id': alert.get('rule_id'),
            'rule_name': alert.get('rule_name'),
            'severity': alert.get('severity'),
            'threat_class': alert.get('evidence', {}).get('class'),
            'confirmation_count': alert.get('confirmation_count'),
            'confirmation_window': alert.get('confirmation_window'),
            'actions': alert.get('actions', []),
            'identity': alert.get('identity'),
            'zone_type': alert.get('zone_type'),
            'weapon': alert.get('weapon'),
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


if __name__ == "__main__" and os.getenv("AI_SMOKE_TEST") == "1":
    runtime = InferenceRuntime()
    import onnxruntime
    onnx_providers = onnxruntime.get_available_providers()
    print(json.dumps({
        "runtime": runtime.get_status(),
        "onnx_providers": onnx_providers,
    }))
elif __name__ == "__main__":
    uvicorn.run(
        app,
        host=config.AI_SERVICE_HOST,
        port=config.AI_SERVICE_PORT,
        reload=False,
    )
