import time as monotonic_time
from datetime import datetime, time
from typing import List, Dict, Optional, TYPE_CHECKING
import config

if TYPE_CHECKING:
    from tracking.tracker import ObjectTracker

DEFAULT_RULES = [
    {
        "id": "weapon_detected",
        "name": "Arma detectada",
        "enabled": True,
        "severity": "CRITICAL",
        "conditions": [
            {"field": "has_weapon", "operator": "equals", "value": True},
        ],
        "actions": ["CREATE_ALERT", "SEND_NOTIFICATION"],
    },
    {
        "id": "perimeter_breach",
        "name": "Cruce de perimetro detectado",
        "enabled": True,
        "severity": "CRITICAL",
        "conditions": [
            {"field": "perimeter_breach", "operator": "equals", "value": True},
        ],
        "actions": ["CREATE_ALERT", "SEND_NOTIFICATION"],
    },
    {
        "id": "face_covered_intruder",
        "name": "Posible intruso con cara cubierta",
        "enabled": False,
        "severity": "HIGH",
        "conditions": [
            {"field": "face_covered", "operator": "equals", "value": True},
            {"field": "presence_duration", "operator": "greater_than", "value": 15},
            {"field": "zone_type", "operator": "equals", "value": "restricted"},
        ],
        "actions": ["CREATE_ALERT", "SEND_NOTIFICATION"],
    },
    {
        "id": "intruder_restricted",
        "name": "Intruso en zona restringida",
        "enabled": True,
        "severity": "HIGH",
        "conditions": [
            {"field": "identity", "operator": "equals", "value": "unknown"},
            {"field": "zone_type", "operator": "equals", "value": "restricted"},
        ],
        "actions": ["CREATE_ALERT", "SEND_NOTIFICATION"],
    },
    {
        "id": "suspicious_approach",
        "name": "Acercamiento sospechoso a perimetro",
        "enabled": True,
        "severity": "HIGH",
        "conditions": [
            {"field": "suspicious_approach", "operator": "equals", "value": True},
        ],
        "actions": ["CREATE_ALERT", "SEND_NOTIFICATION"],
    },
    {
        "id": "loitering_restricted",
        "name": "Vagabundeo en zona restringida",
        "enabled": True,
        "severity": "MEDIUM",
        "conditions": [
            {"field": "presence_duration", "operator": "greater_than", "value": config.LOITERING_THRESHOLD_SECONDS},
            {"field": "zone_type", "operator": "equals", "value": "restricted"},
        ],
        "actions": ["CREATE_ALERT", "SEND_NOTIFICATION"],
    },
    {
        "id": "running_suspect",
        "name": "Persona corriendo",
        "enabled": True,
        "severity": "MEDIUM",
        "conditions": [
            {"field": "speed_level", "operator": "equals", "value": "running"},
            {"field": "speed_duration", "operator": "greater_than", "value": config.SUSPICIOUS_BEHAVIOR_CONFIRM_SECONDS},
        ],
        "actions": ["CREATE_ALERT"],
    },
    {
        "id": "sprinting_suspect",
        "name": "Persona corriendo muy rapido",
        "enabled": True,
        "severity": "HIGH",
        "conditions": [
            {"field": "speed_level", "operator": "equals", "value": "sprinting"},
            {"field": "speed_duration", "operator": "greater_than", "value": config.SUSPICIOUS_BEHAVIOR_CONFIRM_SECONDS},
        ],
        "actions": ["CREATE_ALERT", "SEND_NOTIFICATION"],
    },
    {
        "id": "trajectory_anomaly",
        "name": "Movimiento erratico detectado",
        "enabled": False,
        "severity": "MEDIUM",
        "conditions": [
            {"field": "trajectory_anomaly", "operator": "greater_than", "value": 0.7},
        ],
        "actions": ["CREATE_ALERT"],
    },
    {
        "id": "fall_detected",
        "name": "Posible caida detectada",
        "enabled": False,
        "severity": "LOW",
        "conditions": [
            {"field": "posture", "operator": "equals", "value": "fallen"},
        ],
        "actions": ["CREATE_ALERT"],
    },
]


class RuleEngine:
    def __init__(self, tracker: Optional['ObjectTracker'] = None):
        self.rules: List[Dict] = []
        self.cooldowns: Dict[str, float] = {}
        self._tracker = tracker
        self._zone_presence_started: Dict[str, float] = {}

    def load_rules(self, rules: List[Dict]):
        self.rules = rules

    def load_default_rules(self):
        self.rules = DEFAULT_RULES
        print(f"Loaded {len(DEFAULT_RULES)} default rules")

    def evaluate(
        self,
        detections: List[Dict],
        face_results: List[Dict],
        active_zone: Optional[str],
        zone_type: Optional[str],
        camera_id: str,
        weapon_detections: Optional[List[Dict]] = None,
        tracker: Optional['ObjectTracker'] = None,
    ) -> Optional[Dict]:
        now = datetime.now()
        current_time = now.time()

        person_detections = [d for d in detections if d["class"] == "person"]
        if not person_detections:
            return None

        for detection in person_detections:
            tracking_id = detection.get("tracking_id")

            face_match = None
            for face in face_results:
                if self._bbox_overlap(detection["bbox"], face["bbox"]):
                    face_match = face
                    break

            identity = "unknown"
            identity_confidence = 0.0
            if face_match and face_match["is_known"]:
                identity = face_match["person_id"]
                identity_confidence = face_match["confidence"]

            behavior = detection.get("behavior", {})
            perimeter = detection.get("perimeter", {})
            matched_weapon = self._find_weapon_for_person(detection, weapon_detections or [])
            has_weapon = matched_weapon is not None
            detection_zone = str(detection.get("zone_type") or zone_type or "").lower() or None
            context = {
                "object_class": detection["class"],
                "identity": identity,
                "identity_confidence": identity_confidence,
                "zone_type": detection_zone,
                "presence_duration": self._get_zone_presence_duration(
                    tracking_id, camera_id, detection_zone, monotonic_time.monotonic()),
                "confidence": detection["confidence"],
                "current_time": current_time,
                "has_weapon": has_weapon,
                "face_covered": behavior.get("face_covered", False),
                "speed_level": behavior.get("speed_level", "still"),
                "speed_value": behavior.get("speed_value", 0.0),
                "speed_duration": behavior.get("speed_duration", 0.0),
                "trajectory_anomaly": behavior.get("trajectory_anomaly", 0.0),
                "posture": behavior.get("posture", "upright"),
                "perimeter_breach": perimeter.get("perimeter_breach", False),
                "suspicious_approach": perimeter.get("suspicious_approach", False),
            }

            for rule in self.rules:
                if not rule.get("enabled", True):
                    continue

                if self._check_cooldown(rule["id"], camera_id, tracking_id):
                    continue

                if self._evaluate_conditions(rule.get("conditions", []), context):
                    if self._check_schedule(rule.get("schedule"), current_time, now):
                        self._set_cooldown(rule["id"], camera_id, tracking_id)
                        return {
                            "rule_id": rule["id"],
                            "rule_name": rule["name"],
                            "severity": rule.get("severity", "MEDIUM"),
                            "detection": detection,
                            "identity": identity,
                            "identity_confidence": identity_confidence,
                            "zone_type": detection_zone,
                            "actions": rule.get("actions", []),
                            "weapon": matched_weapon,
                        }

        return None

    def _check_weapon_for_person(self, detection: Dict, weapon_detections: List[Dict]) -> bool:
        return self._find_weapon_for_person(detection, weapon_detections) is not None

    def _find_weapon_for_person(self, detection: Dict, weapon_detections: List[Dict]) -> Optional[Dict]:
        if not weapon_detections:
            return None
        bbox = detection["bbox"]
        tracking_id = detection.get("tracking_id")
        for wd in weapon_detections:
            if not wd.get("confirmed", False):
                continue
            associated_id = wd.get("associated_tracking_id")
            if associated_id is not None:
                if associated_id == tracking_id:
                    return wd
                continue
            wb = wd["bbox"]
            if self._weapon_belongs_to_person(bbox, wb):
                return wd
        return None

    def _weapon_belongs_to_person(self, person_bbox: Dict, weapon_bbox: Dict) -> bool:
        px1 = person_bbox["x"] - person_bbox["width"] * 0.1
        py1 = person_bbox["y"] - person_bbox["height"] * 0.05
        px2 = person_bbox["x"] + person_bbox["width"] * 1.1
        py2 = person_bbox["y"] + person_bbox["height"] * 1.05
        wx1 = weapon_bbox["x"]
        wy1 = weapon_bbox["y"]
        wx2 = wx1 + weapon_bbox["width"]
        wy2 = wy1 + weapon_bbox["height"]
        center_inside = px1 <= (wx1 + wx2) / 2 <= px2 and py1 <= (wy1 + wy2) / 2 <= py2
        intersection = max(0, min(px2, wx2) - max(px1, wx1)) * max(0, min(py2, wy2) - max(py1, wy1))
        weapon_area = max(1, weapon_bbox["width"] * weapon_bbox["height"])
        return center_inside or intersection / weapon_area >= 0.5

    def _evaluate_conditions(self, conditions: List[Dict], context: Dict) -> bool:
        if not conditions:
            return True

        for condition in conditions:
            field_name = condition.get("field")
            operator = condition.get("operator")
            value = condition.get("value")

            actual = context.get(field_name)
            if actual is None:
                return False

            if operator == "equals" and actual != value:
                return False
            elif operator == "not_equals" and actual == value:
                return False
            elif operator == "greater_than" and actual <= value:
                return False
            elif operator == "less_than" and actual >= value:
                return False
            elif operator == "in" and actual not in value:
                return False
            elif operator == "between":
                if not (value[0] <= actual <= value[1]):
                    return False

        return True

    def _check_schedule(self, schedule: Optional[Dict], current_time, now) -> bool:
        if not schedule or not schedule.get("enabled"):
            return True

        days = schedule.get("days", [])
        day_name = now.strftime("%A").lower()
        if day_name not in days:
            return False

        start = time.fromisoformat(schedule["start_time"])
        end = time.fromisoformat(schedule["end_time"])

        if start <= end:
            return start <= current_time <= end
        else:
            return current_time >= start or current_time <= end

    def _check_cooldown(self, rule_id: str, camera_id: str, tracking_id) -> bool:
        key = f"{rule_id}:{camera_id}:{tracking_id}"
        last_trigger = self.cooldowns.get(key)
        if last_trigger:
            elapsed = datetime.now().timestamp() - last_trigger
            return elapsed < config.ALERT_COOLDOWN_SECONDS
        return False

    def _set_cooldown(self, rule_id: str, camera_id: str, tracking_id):
        key = f"{rule_id}:{camera_id}:{tracking_id}"
        self.cooldowns[key] = datetime.now().timestamp()

    def _get_zone_presence_duration(self, tracking_id, camera_id, zone_type, now: float) -> float:
        key = f"{camera_id}:{tracking_id}"
        if zone_type == "restricted" and tracking_id is not None:
            started = self._zone_presence_started.setdefault(key, now)
            return now - started
        self._zone_presence_started.pop(key, None)
        return 0.0

    def clear_camera(self, camera_id: str):
        cooldown_marker = f":{camera_id}:"
        self.cooldowns = {
            key: value for key, value in self.cooldowns.items()
            if cooldown_marker not in key
        }
        prefix = f"{camera_id}:"
        self._zone_presence_started = {
            key: value for key, value in self._zone_presence_started.items()
            if not key.startswith(prefix)
        }

    def _bbox_overlap(self, bbox1: Dict, bbox2: Dict, threshold: float = 0.3) -> bool:
        x1 = max(bbox1["x"], bbox2["x"])
        y1 = max(bbox1["y"], bbox2["y"])
        x2 = min(bbox1["x"] + bbox1["width"], bbox2["x"] + bbox2["width"])
        y2 = min(bbox1["y"] + bbox1["height"], bbox2["y"] + bbox2["height"])

        if x2 <= x1 or y2 <= y1:
            return False

        intersection = (x2 - x1) * (y2 - y1)
        area1 = bbox1["width"] * bbox1["height"]
        area2 = bbox2["width"] * bbox2["height"]
        union = area1 + area2 - intersection

        return (intersection / union) >= threshold if union > 0 else False
