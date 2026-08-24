import cv2
import time
import threading
import numpy as np
from typing import Dict, List, Optional, Callable
from detection.motion_detector import MotionDetector
from detection.yolo_detector import YoloDetector
from detection.weapon_detector import WeaponDetector
from analysis.behavior_analyzer import BehaviorAnalyzer
from analysis.perimeter_detector import PerimeterDetector
from tracking.tracker import ObjectTracker
from recognition.face_recognizer import FaceRecognizer
from rules.rule_engine import RuleEngine
from buffer.video_buffer import VideoBuffer
from sources.base import VideoSource, SourceStatus
from sources.file_source import FileVideoSource
from sources.rtsp_source import RTSPVideoSource
import config


class FrameProcessor:
    def __init__(self):
        self.motion_detector = MotionDetector(sensitivity=config.MOTION_SENSITIVITY)
        self.yolo_detector = YoloDetector()
        self.weapon_detector = WeaponDetector()
        self.tracker = ObjectTracker()
        self.face_recognizer = FaceRecognizer()
        self.rule_engine = RuleEngine(tracker=self.tracker)
        self.video_buffer = VideoBuffer()
        self.behavior_analyzer = BehaviorAnalyzer()
        self.perimeter_detector = PerimeterDetector()

        self.sources: Dict[str, VideoSource] = {}
        self._zones: Dict[str, List[Dict]] = {}
        self._processing = False
        self._detection_callback: Optional[Callable] = None
        self._alert_callback: Optional[Callable] = None
        self._frame_callback: Optional[Callable] = None
        self._lock = threading.Lock()
        self._frame_count = 0

        self._stats = {
            'total_frames_processed': 0,
            'total_detections': 0,
            'total_alerts': 0,
            'start_time': None,
        }

    def load_models(self):
        self.yolo_detector.load_model()
        self.face_recognizer.load_model()
        if config.WEAPON_ENABLED:
            self.weapon_detector.load_model()
        print("All AI models loaded")

    def set_callbacks(
        self,
        detection_callback: Optional[Callable] = None,
        alert_callback: Optional[Callable] = None,
        frame_callback: Optional[Callable] = None,
    ):
        self._detection_callback = detection_callback
        self._alert_callback = alert_callback
        self._frame_callback = frame_callback

    def update_zones(self, camera_id: str, zones: List[Dict]):
        self._zones[camera_id] = zones

    def _point_in_polygon(self, x: float, y: float, polygon: List[Dict]) -> bool:
        n = len(polygon)
        inside = False
        j = n - 1
        for i in range(n):
            xi, yi = polygon[i].get('x', 0), polygon[i].get('y', 0)
            xj, yj = polygon[j].get('x', 0), polygon[j].get('y', 0)
            if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
        return inside

    def _detect_zone(self, camera_id: str, bbox: Dict) -> Optional[str]:
        zones = self._zones.get(camera_id, [])
        cx = bbox['x'] + bbox['width'] / 2
        cy = bbox['y'] + bbox['height'] / 2
        for zone in zones:
            if not zone.get('enabled', True):
                continue
            polygon = zone.get('polygon', [])
            if len(polygon) >= 3 and self._point_in_polygon(cx, cy, polygon):
                return zone.get('type', 'MONITORED')
        return None

    def add_file_source(self, source_id: str, file_path: str,
                        loop: bool = True, target_fps: int = 25) -> dict:
        with self._lock:
            if source_id in self.sources:
                self.sources[source_id].stop()
            source = FileVideoSource(source_id, file_path, loop, target_fps)
            source.set_frame_callback(self._on_frame)
            self.sources[source_id] = source
            self.video_buffer.create_buffer(source_id)
            return source.get_info()

    def add_rtsp_source(self, source_id: str, rtsp_url: str,
                        username: str = '', password: str = '',
                        target_fps: int = 25) -> dict:
        with self._lock:
            if source_id in self.sources:
                self.sources[source_id].stop()
            source = RTSPVideoSource(source_id, rtsp_url, username, password, target_fps)
            source.set_frame_callback(self._on_frame)
            self.sources[source_id] = source
            self.video_buffer.create_buffer(source_id)
            return source.get_info()

    def remove_source(self, source_id: str):
        with self._lock:
            if source_id in self.sources:
                self.sources[source_id].stop()
                del self.sources[source_id]

    def start_source(self, source_id: str):
        with self._lock:
            if source_id in self.sources:
                self.sources[source_id].start()

    def stop_source(self, source_id: str):
        with self._lock:
            if source_id in self.sources:
                self.sources[source_id].stop()

    def start_all(self):
        with self._lock:
            for source in self.sources.values():
                source.start()

    def stop_all(self):
        with self._lock:
            for source in self.sources.values():
                source.stop()

    def _on_frame(self, source_id: str, frame: np.ndarray):
        try:
            result = self.process_frame(source_id, frame)
            if self._frame_callback:
                self._frame_callback(source_id, frame, result)
        except Exception as e:
            print(f"[{source_id}] Processing error: {e}")

    def process_frame(self, camera_id: str, frame: np.ndarray) -> dict:
        self.video_buffer.add_frame(camera_id, frame)
        self._stats['total_frames_processed'] += 1
        self._frame_count += 1

        has_motion, motion_overlay = self.motion_detector.detect(frame)

        detections = []
        if has_motion:
            detections = self.yolo_detector.detect(frame)

        weapon_detections = []
        if self.weapon_detector.model is not None and config.WEAPON_ENABLED:
            if self._frame_count % config.WEAPON_CHECK_INTERVAL == 0:
                weapon_detections = self.weapon_detector.detect(frame)

        tracked = self.tracker.update(detections)

        face_results = self.face_recognizer.recognize(frame)

        zones = self._zones.get(camera_id, [])
        for det in tracked:
            if det['class'] == 'person':
                det['zone_type'] = self._detect_zone(camera_id, det['bbox'])

        for det in tracked:
            if det['class'] == 'person':
                det['behavior'] = self.behavior_analyzer.analyze(det, self.tracker)

        for det in tracked:
            if det['class'] == 'person':
                det['perimeter'] = self.perimeter_detector.analyze(
                    camera_id, det, self.tracker, zones,
                )

        zone_type = None
        first_person = next((d for d in tracked if d['class'] == 'person'), None)
        if first_person:
            zone_type = first_person.get('zone_type')

        alert = self.rule_engine.evaluate(
            detections=tracked,
            face_results=face_results,
            active_zone=zone_type,
            zone_type=zone_type,
            camera_id=camera_id,
            weapon_detections=weapon_detections,
        )

        if weapon_detections and not alert:
            for det in tracked:
                if det['class'] == 'person':
                    has_weapon = self.rule_engine._check_weapon_for_person(det, weapon_detections)
                    if has_weapon:
                        alert = {
                            "rule_id": "weapon_detected",
                            "rule_name": "Arma detectada",
                            "severity": "CRITICAL",
                            "detection": det,
                            "identity": "unknown",
                            "identity_confidence": 0.0,
                            "zone_type": det.get('zone_type'),
                            "actions": ["CREATE_ALERT", "SEND_NOTIFICATION"],
                        }
                        break

        if alert:
            self._stats['total_alerts'] += 1
            timestamp = time.time()
            event_time = time.strftime('%Y-%m-%d_%H-%M-%S', time.localtime(timestamp))
            clip_path = f"{config.EVIDENCE_DIR}/alert_{event_time}.mp4"
            self.video_buffer.save_clip(camera_id, timestamp, clip_path)

            snapshot_path = ""
            try:
                snap_name = f"alert_{event_time}.jpg"
                snapshot_path = f"{config.EVIDENCE_DIR}/{snap_name}"
                cv2.imwrite(snapshot_path, frame)
            except Exception as e:
                print(f"[{camera_id}] Failed to save snapshot: {e}")
                snapshot_path = ""

            if self._alert_callback:
                self._alert_callback(camera_id, alert, clip_path, snapshot_path)

        if tracked:
            self._stats['total_detections'] += len(tracked)

        if self._detection_callback:
            self._detection_callback(camera_id, tracked, face_results)

        annotated = self._annotate_frame(frame, tracked, face_results, has_motion, weapon_detections)

        return {
            'detections': tracked,
            'face_results': face_results,
            'weapon_detections': weapon_detections,
            'alert': alert,
            'has_motion': has_motion,
            'annotated_frame': annotated,
        }

    def _annotate_frame(self, frame, detections, face_results, has_motion, weapon_detections=None):
        annotated = frame.copy()

        if has_motion:
            cv2.putText(annotated, "MOTION", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

        for det in detections:
            bbox = det['bbox']
            x, y, w, h = bbox['x'], bbox['y'], bbox['width'], bbox['height']
            color = (0, 255, 0) if det['class'] == 'person' else (255, 165, 0)

            behavior = det.get('behavior', {})
            if behavior.get('face_covered'):
                color = (0, 165, 255)
            speed = behavior.get('speed_level', 'still')
            if speed in ('running', 'sprinting'):
                color = (0, 0, 255)

            cv2.rectangle(annotated, (x, y), (x + w, y + h), color, 2)
            label = f"{det['class']} {det['confidence']:.2f}"
            if det.get('tracking_id') is not None:
                label += f" #{det['tracking_id']}"
            cv2.putText(annotated, label, (x, y - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

            if behavior.get('face_covered'):
                cv2.putText(annotated, "FACE COVERED", (x, y + h + 15),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 165, 255), 2)
            if speed in ('running', 'sprinting'):
                cv2.putText(annotated, f"RUNNING ({behavior.get('speed_value', 0):.0f}px/s)", (x, y + h + 15),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)

        if weapon_detections:
            for wd in weapon_detections:
                wb = wd['bbox']
                cv2.rectangle(annotated, (wb['x'], wb['y']),
                              (wb['x'] + wb['width'], wb['y'] + wb['height']),
                              (0, 0, 255), 3)
                cv2.putText(annotated, f"WEAPON: {wd['class']} {wd['confidence']:.2f}",
                            (wb['x'], wb['y'] - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

        for face in face_results:
            bbox = face['bbox']
            x, y, w, h = bbox['x'], bbox['y'], bbox['width'], bbox['height']
            color = (0, 255, 0) if face['is_known'] else (0, 0, 255)
            cv2.rectangle(annotated, (x, y), (x + w, y + h), color, 2)
            label = face.get('person_id', 'UNKNOWN')
            cv2.putText(annotated, label, (x, y - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        return annotated

    def get_source_info(self, source_id: str) -> Optional[dict]:
        with self._lock:
            if source_id in self.sources:
                return self.sources[source_id].get_info()
        return None

    def get_all_sources_info(self) -> list:
        with self._lock:
            return [s.get_info() for s in self.sources.values()]

    def get_stats(self) -> dict:
        stats = dict(self._stats)
        if stats['start_time']:
            stats['uptime_seconds'] = time.time() - stats['start_time']
        return stats

    def get_snapshot(self, source_id: str) -> Optional[np.ndarray]:
        with self._lock:
            if source_id in self.sources:
                source = self.sources[source_id]
                return source._current_frame.copy() if source._current_frame is not None else None
        return None
