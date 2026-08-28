import os
import threading
import urllib.request
from typing import Dict, List

import cv2
import config


class FaceCoverDetector:
    def __init__(self):
        self.model = None
        self.visible_face_detector = None
        self._visible_face_lock = threading.Lock()

    def load_model(self):
        if not config.FACE_COVER_ENABLED:
            print("Face-cover detection disabled via config")
            return
        try:
            from ultralytics import YOLO

            model_path = config.FACE_COVER_MODEL_PATH
            if not os.path.exists(model_path):
                os.makedirs(os.path.dirname(model_path), exist_ok=True)
                print("Downloading face-cover model...")
                urllib.request.urlretrieve(config.FACE_COVER_MODEL_URL, model_path)
            self.model = YOLO(model_path)
            visible_face_path = config.VISIBLE_FACE_MODEL_PATH
            if not os.path.exists(visible_face_path):
                urllib.request.urlretrieve(
                    config.VISIBLE_FACE_MODEL_URL, visible_face_path)
            self.visible_face_detector = cv2.FaceDetectorYN.create(
                visible_face_path, '', (320, 320), 0.55, 0.3, 5000)
            print(f"Face-cover model loaded: {model_path}")
        except Exception as exc:
            print(f"Failed to load face-cover model: {exc}")
            self.model = None
            self.visible_face_detector = None

    def detect(self, frame, confidence: float = None) -> List[Dict]:
        if self.model is None or self.visible_face_detector is None:
            return []
        threshold = confidence or config.FACE_COVER_CONFIDENCE_THRESHOLD
        results = self.model(frame, verbose=False)
        covered = []
        for result in results:
            for box in result.boxes:
                conf = float(box.conf[0])
                class_id = int(box.cls[0])
                class_name = str(self.model.names.get(class_id, class_id)).lower()
                if class_name == 'covered' and conf < threshold:
                    continue
                if class_name != 'covered':
                    continue
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detection = {
                    'class': class_name,
                    'confidence': conf,
                    'bbox': {
                        'x': int(x1),
                        'y': int(y1),
                        'width': int(x2 - x1),
                        'height': int(y2 - y1),
                    },
                }
                covered.append(detection)
        visible_faces = self._detect_visible_faces(frame)
        return [
            detection for detection in covered
            if not self._contains_visible_face(
                detection['bbox'], visible_faces)
        ]

    def _detect_visible_faces(self, frame) -> List[Dict]:
        height, width = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        with self._visible_face_lock:
            self.visible_face_detector.setInputSize((width, height))
            _, faces = self.visible_face_detector.detect(frame)
        visible = []
        if faces is None:
            return visible
        for face in faces:
            eye_brightness = (
                self._patch_mean(gray, face[4], face[5], face[2])
                + self._patch_mean(gray, face[6], face[7], face[2])
            ) / 2
            nose_brightness = self._patch_mean(
                gray, face[8], face[9], face[2])
            mouth_brightness = (
                self._patch_mean(gray, face[10], face[11], face[2])
                + self._patch_mean(gray, face[12], face[13], face[2])
            ) / 2
            if (
                eye_brightness > 0
                and nose_brightness / eye_brightness >= 0.70
                and mouth_brightness / eye_brightness >= 0.40
            ):
                visible.append({
                    'x': int(face[0]),
                    'y': int(face[1]),
                    'width': int(face[2]),
                    'height': int(face[3]),
                })
        return visible

    @staticmethod
    def _patch_mean(gray, x: float, y: float, face_width: float) -> float:
        radius = max(3, int(face_width * 0.05))
        center_x, center_y = int(x), int(y)
        patch = gray[
            max(0, center_y - radius):min(gray.shape[0], center_y + radius),
            max(0, center_x - radius):min(gray.shape[1], center_x + radius),
        ]
        return float(patch.mean()) if patch.size else 0.0

    @staticmethod
    def _contains_visible_face(cover_bbox: Dict,
                               visible_faces: List[Dict]) -> bool:
        for face in visible_faces:
            center_x = face['x'] + face['width'] / 2
            center_y = face['y'] + face['height'] / 2
            if (
                cover_bbox['x'] <= center_x
                <= cover_bbox['x'] + cover_bbox['width']
                and cover_bbox['y'] <= center_y
                <= cover_bbox['y'] + cover_bbox['height']
            ):
                return True
        return False
