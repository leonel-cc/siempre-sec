from typing import Dict, List, Optional
from dataclasses import dataclass, field
import time
import math


@dataclass
class TrackedObject:
    id: int
    class_name: str
    bbox: Dict[str, int]
    confidence: float
    first_seen: float
    last_seen: float
    positions: List[Dict] = field(default_factory=list)
    disappeared: int = 0


class ObjectTracker:
    def __init__(self, max_disappeared: int = 30):
        self.next_id = 0
        self.tracked_objects: Dict[int, TrackedObject] = {}
        self.max_disappeared = max_disappeared

    def update(self, detections: List[Dict]) -> List[Dict]:
        current_ids = set()
        assigned_ids = set()
        matched = []

        for detection in detections:
            bbox = detection["bbox"]
            now = time.time()
            center = {
                "x": bbox["x"] + bbox["width"] // 2,
                "y": bbox["y"] + bbox["height"] // 2,
                "t": now,
            }

            best_id = None
            best_distance = float("inf")

            for obj_id, obj in self.tracked_objects.items():
                if obj_id in assigned_ids:
                    continue
                if obj.class_name != detection["class"]:
                    continue
                last_pos = obj.positions[-1] if obj.positions else {"x": 0, "y": 0}
                dist = ((center["x"] - last_pos["x"]) ** 2 +
                        (center["y"] - last_pos["y"]) ** 2) ** 0.5
                if dist < best_distance and dist < 100:
                    best_distance = dist
                    best_id = obj_id

            if best_id is not None:
                obj = self.tracked_objects[best_id]
                obj.bbox = bbox
                obj.confidence = detection["confidence"]
                obj.last_seen = now
                obj.positions.append(center)
                obj.disappeared = 0
                if len(obj.positions) > 50:
                    obj.positions = obj.positions[-50:]
                detection["tracking_id"] = best_id
                current_ids.add(best_id)
                assigned_ids.add(best_id)
            else:
                new_id = self.next_id
                self.next_id += 1
                self.tracked_objects[new_id] = TrackedObject(
                    id=new_id,
                    class_name=detection["class"],
                    bbox=bbox,
                    confidence=detection["confidence"],
                    first_seen=now,
                    last_seen=now,
                    positions=[center],
                )
                detection["tracking_id"] = new_id
                current_ids.add(new_id)
                assigned_ids.add(new_id)

            matched.append(detection)

        for obj_id in list(self.tracked_objects.keys()):
            if obj_id not in current_ids:
                self.tracked_objects[obj_id].disappeared += 1
                if self.tracked_objects[obj_id].disappeared > self.max_disappeared:
                    del self.tracked_objects[obj_id]

        return matched

    def get_presence_duration(self, tracking_id: int) -> Optional[float]:
        obj = self.tracked_objects.get(tracking_id)
        if obj:
            return obj.last_seen - obj.first_seen
        return None

    def get_velocity(self, tracking_id: int) -> float:
        obj = self.tracked_objects.get(tracking_id)
        if not obj or len(obj.positions) < 2:
            return 0.0
        recent = obj.positions[-10:]
        dt = recent[-1]["t"] - recent[0]["t"]
        if dt <= 0:
            return 0.0
        distance = sum(
            ((recent[i]["x"] - recent[i - 1]["x"]) ** 2 +
             (recent[i]["y"] - recent[i - 1]["y"]) ** 2) ** 0.5
            for i in range(1, len(recent))
        )
        return distance / dt

    def get_trajectory_anomaly(self, tracking_id: int) -> float:
        obj = self.tracked_objects.get(tracking_id)
        if not obj or len(obj.positions) < 5:
            return 0.0
        recent = obj.positions[-30:]
        if len(recent) < 3:
            return 0.0
        direction_changes = 0
        for i in range(2, len(recent)):
            dx1 = recent[i - 1]["x"] - recent[i - 2]["x"]
            dy1 = recent[i - 1]["y"] - recent[i - 2]["y"]
            dx2 = recent[i]["x"] - recent[i - 1]["x"]
            dy2 = recent[i]["y"] - recent[i - 1]["y"]
            dot = dx1 * dx2 + dy1 * dy2
            mag1 = math.sqrt(dx1 * dx1 + dy1 * dy1)
            mag2 = math.sqrt(dx2 * dx2 + dy2 * dy2)
            if mag1 == 0 or mag2 == 0:
                continue
            cos_angle = max(-1.0, min(1.0, dot / (mag1 * mag2)))
            angle = math.degrees(math.acos(cos_angle))
            if angle > 90:
                direction_changes += 1
        window = len(recent) - 2
        return min(1.0, direction_changes / max(1, window))

    def get_bbox_aspect_ratio(self, tracking_id: int) -> float:
        obj = self.tracked_objects.get(tracking_id)
        if not obj:
            return 1.0
        w = obj.bbox.get("width", 1)
        h = obj.bbox.get("height", 1)
        return w / max(h, 1)

    def get_active_tracks(self) -> List[TrackedObject]:
        return list(self.tracked_objects.values())
