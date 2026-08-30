import numpy as np
import threading
import time
from typing import List, Dict, Optional
from ultralytics import YOLO
import config
from runtime import InferenceRuntime, LatencyTracker


class YoloDetector:
    def __init__(self, model_path: str = None, runtime: InferenceRuntime = None):
        self.model_path = model_path or config.YOLO_MODEL
        self.confidence_threshold = config.YOLO_CONFIDENCE_THRESHOLD
        self.enabled_classes = config.DETECTION_CLASSES
        self.model: Optional[YOLO] = None
        self._lock = threading.Lock()
        self.runtime = runtime or InferenceRuntime()
        self.device = self.runtime.device
        self.latency = LatencyTracker()

    def load_model(self):
        self.model = YOLO(self.model_path)
        try:
            self.model.to(self.device)
        except Exception as exc:
            if self.device == "cpu":
                raise
            self.runtime.fallback_to_cpu("objects", exc)
            self.device = "cpu"
            self.model.to("cpu")
        self.runtime.report_component("objects", self.device)
        print(f"YOLO model loaded on {self.device}: {self.model_path}")

    def detect(self, frame: np.ndarray) -> List[Dict]:
        if self.model is None:
            self.load_model()

        started = time.perf_counter()
        try:
            with self._lock:
                try:
                    results = self.model.predict(
                        source=frame,
                        verbose=False,
                        conf=min(
                            self.confidence_threshold,
                            config.WEAPON_VETO_CONFIDENCE,
                        ),
                        device=self.device,
                    )
                except Exception as exc:
                    if self.device == "cpu":
                        raise
                    self.runtime.fallback_to_cpu("objects", exc)
                    self.device = "cpu"
                    self.model.to("cpu")
                    results = self.model.predict(
                        source=frame,
                        verbose=False,
                        conf=min(
                            self.confidence_threshold,
                            config.WEAPON_VETO_CONFIDENCE,
                        ),
                        device="cpu",
                    )
        finally:
            self.latency.record((time.perf_counter() - started) * 1000)
        self.runtime.report_component("objects", self.device)
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
                threshold = (
                    config.WEAPON_VETO_CONFIDENCE
                    if class_name in config.WEAPON_VETO_CLASSES
                    else self.confidence_threshold
                )
                if confidence < threshold:
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

    def get_status(self) -> Dict:
        return {
            "loaded": self.model is not None,
            "model": self.model_path,
            "device": self.runtime.get_component_device("objects"),
            "latency": self.latency.snapshot(),
        }

    def warmup(self):
        self.detect(np.zeros(
            (config.WARMUP_FRAME_HEIGHT, config.WARMUP_FRAME_WIDTH, 3),
            dtype=np.uint8,
        ))
        self.latency.clear()
        print(f"YOLO warmup complete on {self.device}")

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
