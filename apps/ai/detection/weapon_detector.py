import os
import threading
import time
import numpy as np
from typing import List, Dict
import config
from runtime import InferenceRuntime, LatencyTracker


class WeaponDetector:
    def __init__(self, runtime: InferenceRuntime = None):
        self.model = None
        self.model_path = None
        self.load_error = None
        self._lock = threading.Lock()
        self.runtime = runtime or InferenceRuntime()
        self.device = self.runtime.device
        self.latency = LatencyTracker()

    def load_model(self):
        if not config.WEAPON_ENABLED:
            print("Weapon detection disabled via config")
            return
        try:
            from ultralytics import YOLO
            if config.WEAPON_MODEL_PATH:
                model_path = os.path.abspath(config.WEAPON_MODEL_PATH)
                if not os.path.isfile(model_path):
                    raise FileNotFoundError(f"Weapon model not found: {model_path}")
            else:
                from huggingface_hub import hf_hub_download
                download_args = {
                    "repo_id": config.WEAPON_MODEL,
                    "filename": config.WEAPON_MODEL_FILENAME,
                }
                if config.WEAPON_MODEL_REVISION:
                    download_args["revision"] = config.WEAPON_MODEL_REVISION
                model_path = hf_hub_download(**download_args)

            self.model = YOLO(model_path)
            try:
                self.model.to(self.device)
            except Exception as exc:
                if self.device == "cpu":
                    raise
                self.runtime.fallback_to_cpu("weapons", exc)
                self.device = "cpu"
                self.model.to("cpu")
            self.model_path = model_path
            self.load_error = None
            self.runtime.report_component("weapons", self.device)
            print(f"Weapon model loaded on {self.device}: {model_path}")
            return True
        except Exception as e:
            print(f"Failed to load weapon model: {e}")
            self.model = None
            self.model_path = None
            self.load_error = str(e)
            return False

    def detect(self, frame, confidence: float = None) -> List[Dict]:
        if self.model is None:
            return []
        if confidence is None:
            confidence = config.WEAPON_CONFIDENCE_THRESHOLD
        predict_args = {
            "source": frame,
            "verbose": False,
            "conf": confidence,
            "iou": config.WEAPON_IOU_THRESHOLD,
            "imgsz": config.WEAPON_IMAGE_SIZE,
            "device": self.device,
        }
        enabled_class_ids = [
            class_id for class_id, class_name in self.model.names.items()
            if class_name.lower() in config.WEAPON_CLASSES
        ]
        if enabled_class_ids:
            predict_args["classes"] = enabled_class_ids
        started = time.perf_counter()
        try:
            with self._lock:
                try:
                    results = self.model.predict(**predict_args)
                except Exception as exc:
                    if self.device == "cpu":
                        raise
                    self.runtime.fallback_to_cpu("weapons", exc)
                    self.device = "cpu"
                    predict_args["device"] = "cpu"
                    self.model.to("cpu")
                    results = self.model.predict(**predict_args)
        finally:
            self.latency.record((time.perf_counter() - started) * 1000)
        self.runtime.report_component("weapons", self.device)
        detections = []
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                if conf < confidence:
                    continue
                xyxy = box.xyxy[0].tolist()
                class_name = self.model.names.get(cls_id, f"class_{cls_id}")
                if config.WEAPON_CLASSES and class_name.lower() not in config.WEAPON_CLASSES:
                    continue
                detections.append({
                    "class": class_name,
                    "confidence": conf,
                    "bbox": {
                        "x": int(xyxy[0]),
                        "y": int(xyxy[1]),
                        "width": int(xyxy[2] - xyxy[0]),
                        "height": int(xyxy[3] - xyxy[1]),
                    },
                })
        return detections

    def get_status(self) -> Dict:
        return {
            "enabled": config.WEAPON_ENABLED,
            "loaded": self.model is not None,
            "model": config.WEAPON_MODEL,
            "model_path": self.model_path,
            "classes": sorted(config.WEAPON_CLASSES),
            "error": self.load_error,
            "device": self.runtime.get_component_device("weapons"),
            "latency": self.latency.snapshot(),
        }

    def warmup(self):
        if self.model is None:
            return
        self.detect(np.zeros(
            (config.WARMUP_FRAME_HEIGHT, config.WARMUP_FRAME_WIDTH, 3),
            dtype=np.uint8,
        ))
        self.latency.clear()
        print(f"Weapon detector warmup complete on {self.device}")
