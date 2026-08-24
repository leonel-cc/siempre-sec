import numpy as np
from typing import List, Dict, Optional
from ultralytics import YOLO
import config


class YoloDetector:
    def __init__(self, model_path: str = None):
        self.model_path = model_path or config.YOLO_MODEL
        self.confidence_threshold = config.YOLO_CONFIDENCE_THRESHOLD
        self.enabled_classes = config.DETECTION_CLASSES
        self.model: Optional[YOLO] = None

    def load_model(self):
        self.model = YOLO(self.model_path)
        print(f"YOLO model loaded: {self.model_path}")

    def detect(self, frame: np.ndarray) -> List[Dict]:
        if self.model is None:
            self.load_model()

        results = self.model(frame, verbose=False)
        detections = []

        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue

            for box in boxes:
                cls_id = int(box.cls[0])
                class_name = self.model.names[cls_id]

                if class_name not in self.enabled_classes:
                    continue

                confidence = float(box.conf[0])
                if confidence < self.confidence_threshold:
                    continue

                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append({
                    "class": class_name,
                    "confidence": confidence,
                    "bbox": {
                        "x": int(x1),
                        "y": int(y1),
                        "width": int(x2 - x1),
                        "height": int(y2 - y1),
                    },
                })

        return detections

    def detect_and_annotate(self, frame: np.ndarray) -> tuple:
        detections = self.detect(frame)
        annotated = frame.copy()

        for det in detections:
            bbox = det["bbox"]
            x, y, w, h = bbox["x"], bbox["y"], bbox["width"], bbox["height"]

            color = (0, 255, 0) if det["class"] == "person" else (255, 165, 0)
            cv2_import = __import__("cv2")
            cv2_import.rectangle(annotated, (x, y), (x + w, y + h), color, 2)

            label = f"{det['class']} {det['confidence']:.2f}"
            cv2_import.putText(
                annotated, label, (x, y - 10),
                cv2_import.FONT_HERSHEY_SIMPLEX, 0.5, color, 2,
            )

        return detections, annotated
