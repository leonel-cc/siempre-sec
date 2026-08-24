from pydantic import BaseModel
from typing import List, Optional, Dict


class BoundingBox(BaseModel):
    x: int
    y: int
    width: int
    height: int


class Detection(BaseModel):
    class_name: str
    confidence: float
    bbox: BoundingBox
    tracking_id: Optional[int] = None


class FaceResult(BaseModel):
    person_id: Optional[str]
    confidence: float
    bbox: BoundingBox
    is_known: bool


class AlertResult(BaseModel):
    rule_id: str
    rule_name: str
    detection: Detection
    identity: str
    zone_type: Optional[str]
    actions: List[str]


class ProcessResult(BaseModel):
    detections: List[Detection]
    face_results: List[FaceResult]
    alert: Optional[AlertResult] = None
    annotated_frame_b64: Optional[str] = None
