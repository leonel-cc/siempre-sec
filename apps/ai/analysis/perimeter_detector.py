from typing import Dict, List, Optional
import config


class PerimeterDetector:
    def __init__(self):
        self._inside_history: Dict[str, bool] = {}

    def analyze(
        self,
        camera_id: str,
        detection: Dict,
        tracker,
        zones: List[Dict],
    ) -> Dict:
        tid = detection.get("tracking_id")
        bbox = detection.get("bbox", {})
        cx = bbox.get("x", 0) + bbox.get("width", 0) / 2
        cy = bbox.get("y", 0) + bbox.get("height", 0) / 2

        perimeter_zones = [z for z in zones if z.get("type") in ("restricted", "perimeter") and z.get("enabled", True)]

        was_inside = self._was_inside(camera_id, tid)
        is_inside = self._is_inside_any(cx, cy, perimeter_zones)
        nearest_distance = self._nearest_perimeter_distance(cx, cy, perimeter_zones)

        breach = False
        suspicious_approach = False

        if not was_inside and is_inside:
            breach = True

        if not was_inside and not is_inside:
            speed = tracker.get_velocity(tid) if tid is not None else 0.0
            if speed > config.SPEED_WALKING_THRESHOLD and nearest_distance < config.PERIMETER_APPROACH_DISTANCE:
                suspicious_approach = True

        self._update_history(camera_id, tid, is_inside)

        return {
            "perimeter_breach": breach,
            "suspicious_approach": suspicious_approach,
            "distance_to_perimeter": round(nearest_distance, 1),
        }

    def _was_inside(self, camera_id: str, tracking_id) -> bool:
        key = f"{camera_id}:{tracking_id}"
        return self._inside_history.get(key, False)

    def _update_history(self, camera_id: str, tracking_id, is_inside: bool):
        key = f"{camera_id}:{tracking_id}"
        self._inside_history[key] = is_inside

    def _is_inside_any(self, cx: float, cy: float, zones: List[Dict]) -> bool:
        for zone in zones:
            polygon = zone.get("polygon", [])
            if len(polygon) >= 3 and self._point_in_polygon(cx, cy, polygon):
                return True
        return False

    def _nearest_perimeter_distance(self, cx: float, cy: float, zones: List[Dict]) -> float:
        min_dist = float("inf")
        for zone in zones:
            polygon = zone.get("polygon", [])
            for i, point in enumerate(polygon):
                j = (i + 1) % len(polygon)
                dist = self._point_to_segment_distance(
                    cx, cy,
                    polygon[i].get("x", 0), polygon[i].get("y", 0),
                    polygon[j].get("x", 0), polygon[j].get("y", 0),
                )
                if dist < min_dist:
                    min_dist = dist
        return min_dist if min_dist != float("inf") else 9999.0

    def _point_in_polygon(self, x: float, y: float, polygon: List[Dict]) -> bool:
        n = len(polygon)
        inside = False
        j = n - 1
        for i in range(n):
            xi, yi = polygon[i].get("x", 0), polygon[i].get("y", 0)
            xj, yj = polygon[j].get("x", 0), polygon[j].get("y", 0)
            if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
        return inside

    def _point_to_segment_distance(self, px, py, x1, y1, x2, y2) -> float:
        dx = x2 - x1
        dy = y2 - y1
        if dx == 0 and dy == 0:
            return ((px - x1) ** 2 + (py - y1) ** 2) ** 0.5
        t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
        proj_x = x1 + t * dx
        proj_y = y1 + t * dy
        return ((px - proj_x) ** 2 + (py - proj_y) ** 2) ** 0.5
