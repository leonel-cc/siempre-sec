from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import asyncio
import base64
import numpy as np
import cv2
import config

router = APIRouter()


class DetectionRequest(BaseModel):
    camera_id: str
    image_base64: Optional[str] = None
    rtsp_url: Optional[str] = None


class DetectionResponse(BaseModel):
    detections: list
    face_results: list
    weapon_detections: list = []
    face_cover_detections: list = []
    alerts: list = []
    alert: Optional[dict] = None
    has_motion: bool = False


class EmbeddingRequest(BaseModel):
    image_base64: str
    person_id: str


class EmbeddingResponse(BaseModel):
    embedding: List[float]
    success: bool


class AddFileSourceRequest(BaseModel):
    source_id: str
    file_path: str
    loop: bool = True
    target_fps: int = 30


class AddRTSPSourceRequest(BaseModel):
    source_id: str
    rtsp_url: str
    username: str = ""
    password: str = ""
    target_fps: int = 30


class AddUsbSourceRequest(BaseModel):
    source_id: str
    device_index: int = 0
    target_fps: int = 30


class UpdateZonesRequest(BaseModel):
    camera_id: str
    zones: List[dict]


class RulesRequest(BaseModel):
    rules: List[dict]


def _get_processor():
    from main import get_processor
    p = get_processor()
    if p is None:
        raise HTTPException(status_code=503, detail="AI Service not initialized")
    return p


@router.get("/health")
async def health():
    from main import get_processor
    p = get_processor()
    if not p:
        return JSONResponse(
            status_code=503,
            content={"status": "starting", "models_loaded": False, "models": {}},
        )
    yolo_loaded = p.yolo_detector.model is not None
    weapon_status = p.weapon_detector.get_status()
    runtime_status = p.runtime.get_status()
    weapon_loaded = p.weapon_detector.model is not None
    weapon_verifier = getattr(p.weapon_detector, "verifier_model", None)
    face_cover_loaded = p.face_cover_detector.model is not None
    visible_face_loaded = p.face_cover_detector.visible_face_detector is not None
    models_ready = (
        yolo_loaded
        and (not weapon_status["enabled"] or weapon_loaded)
        and (not config.FACE_COVER_ENABLED or face_cover_loaded)
    )
    accelerator_required = runtime_status["requested"] not in ("auto", "cpu")
    accelerator_ready = (
        runtime_status["device"] != "cpu"
        and p.yolo_detector.get_status()["device"] != "cpu"
        and (not weapon_status["enabled"] or weapon_status["device"] != "cpu")
        and p.face_recognizer.get_status()["loaded"]
        and p.face_recognizer.get_status()["device"] not in ("cpu", "unavailable")
    )
    acceleration_degraded = accelerator_required and not accelerator_ready
    required_loaded = models_ready
    content = {
        "status": "degraded" if acceleration_degraded or not models_ready else "ok",
        "models_loaded": required_loaded,
        "runtime": runtime_status,
        "models": {
            "objects": p.yolo_detector.get_status(),
            "weapons": weapon_status,
            "faces": p.face_recognizer.get_status(),
            "face_cover": {
                "enabled": config.FACE_COVER_ENABLED,
                "loaded": face_cover_loaded,
                "visible_face_verifier_loaded": visible_face_loaded,
            },
        },
        "weapon_model_loaded": weapon_loaded,
        "weapon_verifier_loaded": weapon_verifier is not None,
        "face_cover_model_loaded": face_cover_loaded,
        "visible_face_verifier_loaded": visible_face_loaded,
    }
    return JSONResponse(status_code=200 if required_loaded else 503, content=content)


@router.post("/detect", response_model=DetectionResponse)
async def detect(request: DetectionRequest):
    processor = _get_processor()

    if request.image_base64:
        img_data = base64.b64decode(request.image_base64)
        nparr = np.frombuffer(img_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    elif request.rtsp_url:
        cap = cv2.VideoCapture(request.rtsp_url)
        ret, frame = cap.read()
        cap.release()
        if not ret:
            raise HTTPException(status_code=400, detail="Failed to capture frame")
    else:
        raise HTTPException(status_code=400, detail="No image source provided")

    result = processor.process_frame(request.camera_id, frame)

    detections_serializable = []
    for d in result['detections']:
        detections_serializable.append({
            'class': d['class'],
            'confidence': d['confidence'],
            'bbox': d['bbox'],
            'tracking_id': d.get('tracking_id'),
            'behavior': d.get('behavior'),
            'perimeter': d.get('perimeter'),
            'zone_type': d.get('zone_type'),
            'weapon': d.get('weapon'),
            'face_cover': d.get('face_cover'),
            'confirmed_threats': d.get('confirmed_threats', {}),
        })

    face_serializable = []
    for f in result['face_results']:
        face_serializable.append({
            'person_id': f.get('person_id'),
            'confidence': f['confidence'],
            'bbox': f['bbox'],
            'is_known': f['is_known'],
        })

    weapon_serializable = []
    for w in result.get('weapon_detections', []):
        weapon_serializable.append({
            'class': w['class'],
            'confidence': w['confidence'],
            'bbox': w['bbox'],
            'confirmed': w.get('confirmed', False),
            'confirmation_hits': w.get('confirmation_hits', 0),
            'confirmation_window': w.get('confirmation_window', 0),
            'associated_tracking_id': w.get('associated_tracking_id'),
        })

    face_cover_serializable = []
    for cover in result.get('face_cover_detections', []):
        face_cover_serializable.append({
            'class': cover['class'],
            'confidence': cover['confidence'],
            'bbox': cover['bbox'],
        })

    return DetectionResponse(
        detections=detections_serializable,
        face_results=face_serializable,
        weapon_detections=weapon_serializable,
        face_cover_detections=face_cover_serializable,
        alerts=result.get('alerts', []),
        alert=result.get('alert'),
        has_motion=result.get('has_motion', False),
    )


@router.post("/sources/file")
async def add_file_source(request: AddFileSourceRequest):
    processor = _get_processor()
    info = processor.add_file_source(
        request.source_id, request.file_path,
        loop=request.loop, target_fps=request.target_fps,
    )
    processor.start_source(request.source_id)
    return info


@router.post("/sources/rtsp")
async def add_rtsp_source(request: AddRTSPSourceRequest):
    processor = _get_processor()
    info = processor.add_rtsp_source(
        request.source_id, request.rtsp_url,
        username=request.username, password=request.password,
        target_fps=request.target_fps,
    )
    processor.start_source(request.source_id)
    return info


@router.get("/devices/usb")
async def list_usb_devices():
    from discovery.usb_discovery import list_usb_cameras
    devices = list_usb_cameras()
    return {"devices": devices, "count": len(devices)}


@router.post("/sources/usb")
async def add_usb_source(request: AddUsbSourceRequest):
    processor = _get_processor()
    info = processor.add_usb_source(
        request.source_id, request.device_index,
        target_fps=request.target_fps,
    )
    processor.start_source(request.source_id)
    return info


@router.delete("/sources/{source_id}")
async def remove_source(source_id: str):
    processor = _get_processor()
    processor.remove_source(source_id)
    return {"status": "removed", "source_id": source_id}


@router.get("/sources")
async def list_sources():
    processor = _get_processor()
    return processor.get_all_sources_info()


@router.get("/sources/{source_id}")
async def get_source(source_id: str):
    processor = _get_processor()
    info = processor.get_source_info(source_id)
    if info is None:
        raise HTTPException(status_code=404, detail=f"Source {source_id} not found")
    return info


@router.post("/sources/{source_id}/start")
async def start_source(source_id: str):
    processor = _get_processor()
    processor.start_source(source_id)
    return {"status": "started", "source_id": source_id}


@router.post("/sources/{source_id}/stop")
async def stop_source(source_id: str):
    processor = _get_processor()
    processor.stop_source(source_id)
    return {"status": "stopped", "source_id": source_id}


@router.get("/sources/{source_id}/snapshot")
async def get_snapshot(source_id: str, view: str = 'raw', show_people: bool = False):
    processor = _get_processor()
    if view not in ('raw', 'annotated'):
        raise HTTPException(status_code=400, detail="view must be raw or annotated")
    frame = processor.get_snapshot(
        source_id, view=view, show_people=show_people)
    if frame is None:
        raise HTTPException(status_code=404, detail="No frame available")
    _, buffer = cv2.imencode('.jpg', frame)
    return {"image": base64.b64encode(buffer).decode('utf-8')}


@router.get("/sources/{source_id}/stream")
async def stream_source(source_id: str, fps: int = 30, view: str = 'raw',
                        show_people: bool = False):
    processor = _get_processor()
    if view not in ('raw', 'annotated'):
        raise HTTPException(status_code=400, detail="view must be raw or annotated")
    interval = 1.0 / max(1, min(fps, 30))

    async def generate():
        while True:
            frame = processor.get_snapshot(
                source_id, view=view, show_people=show_people)
            if frame is not None:
                ok, buffer = cv2.imencode(
                    '.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
                if ok:
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' +
                           buffer.tobytes() + b'\r\n')
            await asyncio.sleep(interval)

    return StreamingResponse(
        generate(),
        media_type='multipart/x-mixed-replace; boundary=frame',
    )


@router.get("/stats")
async def get_stats():
    processor = _get_processor()
    return processor.get_stats()


@router.post("/embedding", response_model=EmbeddingResponse)
async def generate_embedding(request: EmbeddingRequest):
    processor = _get_processor()
    if processor.face_recognizer is None:
        raise HTTPException(status_code=503, detail="Face recognition not available")

    img_data = base64.b64decode(request.image_base64)
    nparr = np.frombuffer(img_data, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    embedding = processor.face_recognizer.generate_embedding(frame)
    if embedding is None:
        raise HTTPException(status_code=400, detail="No face detected in image")

    return EmbeddingResponse(embedding=embedding.tolist(), success=True)


@router.post("/register-face")
async def register_face(person_id: str, embeddings: List[List[float]]):
    processor = _get_processor()
    if processor.face_recognizer is None:
        raise HTTPException(status_code=503, detail="Face recognition not available")

    np_embeddings = [np.array(e) for e in embeddings]
    processor.face_recognizer.register_person(person_id, np_embeddings)

    return {"status": "ok", "person_id": person_id, "embeddings_count": len(embeddings)}


@router.get("/rules")
async def get_rules():
    processor = _get_processor()
    return {"rules": processor.rule_engine.rules}


@router.post("/rules")
async def set_rules(request: RulesRequest):
    processor = _get_processor()
    processor.rule_engine.load_rules(request.rules)
    return {"status": "ok", "count": len(request.rules)}


@router.post("/rules/load-defaults")
async def load_default_rules():
    processor = _get_processor()
    processor.rule_engine.load_default_rules()
    return {"status": "ok", "count": len(processor.rule_engine.rules)}


@router.post("/discover")
async def discover_cameras(timeout: float = 5.0):
    from discovery.onvif_discovery import OnvifDiscovery
    discovery = OnvifDiscovery(timeout=min(timeout, 15.0))
    devices = discovery.discover()
    return {"devices": devices, "count": len(devices)}


@router.get("/media/check")
async def check_media():
    from media.ffmpeg_helper import check_ffmpeg, check_mediamtx
    return {
        "ffmpeg": check_ffmpeg(),
        "mediamtx": check_mediamtx(),
    }


@router.post("/zones")
async def update_zones(request: UpdateZonesRequest):
    processor = _get_processor()
    processor.update_zones(request.camera_id, request.zones)
    return {"status": "ok", "camera_id": request.camera_id, "zones_count": len(request.zones)}
