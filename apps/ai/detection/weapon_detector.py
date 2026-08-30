import os
import shutil
import threading
import time
from typing import Dict, List, Optional

import numpy as np

import config
from runtime import InferenceRuntime, LatencyTracker


class WeaponDetector:
    def __init__(self, runtime: InferenceRuntime = None):
        self.model = None
        self.verifier_model = None
        self.model_path = None
        self.verifier_model_path = None
        self.load_error = None
        self._lock = threading.Lock()
        self.runtime = runtime or InferenceRuntime()
        self.device = self.runtime.device
        self.latency = LatencyTracker()

    def load_model(self):
        if not config.WEAPON_ENABLED:
            print("Weapon detection disabled via config")
            return True
        try:
            from huggingface_hub import hf_hub_download
            from ultralytics import YOLO

            model_path = os.path.abspath(config.WEAPON_MODEL_PATH)
            if not os.path.exists(model_path):
                downloaded = hf_hub_download(
                    repo_id=config.WEAPON_MODEL,
                    filename="best.pt",
                )
                os.makedirs(os.path.dirname(model_path), exist_ok=True)
                shutil.copyfile(downloaded, model_path)

            verifier_path = os.path.abspath(config.WEAPON_VERIFIER_MODEL_PATH)
            if not os.path.exists(verifier_path):
                downloaded = hf_hub_download(
                    repo_id=config.WEAPON_VERIFIER_MODEL,
                    filename="weights/best.pt",
                )
                os.makedirs(os.path.dirname(verifier_path), exist_ok=True)
                shutil.copyfile(downloaded, verifier_path)

            self.model = YOLO(model_path)
            self.verifier_model = YOLO(verifier_path)
            try:
                self.model.to(self.device)
                self.verifier_model.to(self.device)
            except Exception as exc:
                if self.device == "cpu":
                    raise
                self._fallback_to_cpu(exc)

            self.model_path = model_path
            self.verifier_model_path = verifier_path
            self.load_error = None
            self.runtime.report_component("weapons", self.device)
            print(
                f"Weapon models loaded on {self.device}: "
                f"{config.WEAPON_MODEL} + {config.WEAPON_VERIFIER_MODEL}"
            )
            return True
        except Exception as exc:
            print(f"Failed to load weapon model: {exc}")
            self.model = None
            self.verifier_model = None
            self.model_path = None
            self.verifier_model_path = None
            self.load_error = str(exc)
            self.runtime.report_component("weapons", "unavailable", str(exc))
            return False

    @staticmethod
    def normalize_label(label: str) -> Optional[str]:
        normalized = label.strip().lower().replace('_', ' ')
        if normalized in {'gun', 'pistol', 'handgun', 'firearm', 'rifle'}:
            return 'gun'
        if normalized in {'knife', 'dagger', 'blade'}:
            return 'knife'
        return None

    def detect(self, frame, confidence: float = None) -> List[Dict]:
        if self.model is None or self.verifier_model is None:
            return []
        if confidence is None:
            confidence = config.WEAPON_CONFIDENCE_THRESHOLD

        started = time.perf_counter()
        try:
            with self._lock:
                try:
                    detections = self._detect_verified(frame, confidence)
                except Exception as exc:
                    if self.device == "cpu":
                        raise
                    self._fallback_to_cpu(exc)
                    detections = self._detect_verified(frame, confidence)
        finally:
            self.latency.record((time.perf_counter() - started) * 1000)
        self.runtime.report_component("weapons", self.device)
        return detections

    def _detect_verified(self, frame, confidence: float) -> List[Dict]:
        candidates = self._model_detections(
            self.model, frame, confidence, apply_primary_filters=True)
        if not candidates:
            return []
        verifier_detections = self._model_detections(
            self.verifier_model,
            frame,
            config.WEAPON_VERIFIER_CONFIDENCE,
            apply_primary_filters=False,
        )
        return [
            candidate for candidate in candidates
            if self._has_verifier_support(candidate, verifier_detections)
        ]

    def _model_detections(self, model, frame, confidence: float,
                          apply_primary_filters: bool) -> List[Dict]:
        results = model.predict(
            source=frame,
            verbose=False,
            imgsz=config.WEAPON_INFERENCE_SIZE,
            conf=confidence,
            device=self.device,
        )
        detections = []
        for result in results:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                if conf < confidence:
                    continue
                xyxy = box.xyxy[0].tolist()
                class_name = model.names.get(cls_id, f"class_{cls_id}")
                canonical_class = self.normalize_label(class_name)
                if canonical_class is None:
                    continue
                if (
                    apply_primary_filters
                    and canonical_class == 'knife'
                    and conf < config.KNIFE_CONFIDENCE_THRESHOLD
                ):
                    continue
                width = int(xyxy[2] - xyxy[0])
                height = int(xyxy[3] - xyxy[1])
                if (
                    apply_primary_filters
                    and canonical_class == 'gun'
                    and not self._is_plausible_gun_shape(width, height)
                ):
                    continue
                detections.append({
                    "class": canonical_class,
                    "source_class": class_name,
                    "confidence": conf,
                    "bbox": {
                        "x": int(xyxy[0]),
                        "y": int(xyxy[1]),
                        "width": width,
                        "height": height,
                    },
                })
        return detections

    def _fallback_to_cpu(self, exc: Exception):
        self.runtime.fallback_to_cpu("weapons", exc)
        self.device = "cpu"
        self.model.to("cpu")
        self.verifier_model.to("cpu")

    @staticmethod
    def _is_plausible_gun_shape(width: int, height: int) -> bool:
        return height < 40 or width / max(height, 1) >= 0.95

    @staticmethod
    def _overlaps(first: Dict, second: Dict) -> bool:
        x1 = max(first['x'], second['x'])
        y1 = max(first['y'], second['y'])
        x2 = min(first['x'] + first['width'], second['x'] + second['width'])
        y2 = min(first['y'] + first['height'], second['y'] + second['height'])
        intersection = max(0, x2 - x1) * max(0, y2 - y1)
        smaller_area = min(
            first['width'] * first['height'],
            second['width'] * second['height'],
        )
        return smaller_area > 0 and intersection / smaller_area >= 0.30

    @classmethod
    def _has_verifier_support(cls, candidate: Dict,
                              verifier_detections: List[Dict]) -> bool:
        return any(
            verifier['class'] == candidate['class']
            and cls._overlaps(candidate['bbox'], verifier['bbox'])
            for verifier in verifier_detections
        )

    def get_status(self) -> Dict:
        return {
            "enabled": config.WEAPON_ENABLED,
            "loaded": self.model is not None and self.verifier_model is not None,
            "model": config.WEAPON_MODEL,
            "model_path": self.model_path,
            "verifier_model": config.WEAPON_VERIFIER_MODEL,
            "verifier_model_path": self.verifier_model_path,
            "classes": ["gun", "knife"],
            "error": self.load_error,
            "device": self.runtime.get_component_device("weapons"),
            "latency": self.latency.snapshot(),
        }

    def warmup(self):
        if self.model is None or self.verifier_model is None:
            return
        self.detect(np.zeros(
            (config.WARMUP_FRAME_HEIGHT, config.WARMUP_FRAME_WIDTH, 3),
            dtype=np.uint8,
        ))
        self.latency.clear()
        print(f"Weapon detector warmup complete on {self.device}")
