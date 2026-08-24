from typing import Dict, Optional
import config


class BehaviorAnalyzer:
    def __init__(self):
        self.speed_thresholds = {
            "walking": config.SPEED_WALKING_THRESHOLD,
            "running": config.SPEED_RUNNING_THRESHOLD,
            "sprinting": config.SPEED_SPRINTING_THRESHOLD,
        }
        self.aspect_ratio_fall_threshold = 1.5

    def analyze(self, detection: Dict, tracker) -> Dict:
        tid = detection.get("tracking_id")
        speed_value = tracker.get_velocity(tid) if tid is not None else 0.0
        trajectory_anomaly = tracker.get_trajectory_anomaly(tid) if tid is not None else 0.0
        aspect_ratio = tracker.get_bbox_aspect_ratio(tid) if tid is not None else 1.0

        return {
            "speed_level": self._classify_speed(speed_value),
            "speed_value": round(speed_value, 2),
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
