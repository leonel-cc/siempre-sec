import time
from typing import Dict
import config


class BehaviorAnalyzer:
    def __init__(self):
        self.speed_thresholds = {
            "walking": config.SPEED_WALKING_THRESHOLD,
            "running": config.SPEED_RUNNING_THRESHOLD,
            "sprinting": config.SPEED_SPRINTING_THRESHOLD,
        }
        self.aspect_ratio_fall_threshold = 1.5
        self._fast_since: Dict[str, float] = {}

    def analyze(self, camera_id: str, detection: Dict, tracker) -> Dict:
        tid = detection.get("tracking_id")
        speed_value = tracker.get_velocity(tid) if tid is not None else 0.0
        trajectory_anomaly = tracker.get_trajectory_anomaly(tid) if tid is not None else 0.0
        aspect_ratio = tracker.get_bbox_aspect_ratio(tid) if tid is not None else 1.0

        speed_level = self._classify_speed(speed_value)
        key = f"{camera_id}:{tid}"
        now = time.monotonic()
        if speed_level in ("running", "sprinting"):
            self._fast_since.setdefault(key, now)
            speed_duration = now - self._fast_since[key]
        else:
            self._fast_since.pop(key, None)
            speed_duration = 0.0

        return {
            "speed_level": speed_level,
            "speed_value": round(speed_value, 2),
            "speed_duration": round(speed_duration, 2),
            "trajectory_anomaly": round(trajectory_anomaly, 3),
            "posture": self._classify_posture(aspect_ratio),
            "face_covered": False,
        }

    def _classify_speed(self, speed: float) -> str:
        if speed >= self.speed_thresholds["sprinting"]:
            return "sprinting"
        elif speed >= self.speed_thresholds["running"]:
            return "running"
        elif speed >= self.speed_thresholds["walking"]:
            return "walking"
        return "still"

    def _classify_posture(self, aspect_ratio: float) -> str:
        if aspect_ratio > self.aspect_ratio_fall_threshold:
            return "fallen"
        return "upright"

    def clear_camera(self, camera_id: str):
        prefix = f"{camera_id}:"
        self._fast_since = {
            key: value for key, value in self._fast_since.items()
            if not key.startswith(prefix)
        }
