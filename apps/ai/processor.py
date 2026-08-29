import cv2
import os
import time
import threading
import uuid
import numpy as np
from collections import deque
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
from sources.usb_source import UsbVideoSource
from runtime import InferenceRuntime, LatencyTracker
import config


class FrameProcessor:
    def __init__(self):
        self.runtime = InferenceRuntime()
        self.motion_detector = MotionDetector(sensitivity=config.MOTION_SENSITIVITY)
        self.yolo_detector = YoloDetector(runtime=self.runtime)
        self.weapon_detector = WeaponDetector(runtime=self.runtime)
        self.tracker = ObjectTracker()
        self.face_recognizer = FaceRecognizer(runtime=self.runtime)
        self.rule_engine = RuleEngine(tracker=self.tracker)
        self.video_buffer = VideoBuffer()
        self.behavior_analyzer = BehaviorAnalyzer()
        self.perimeter_detector = PerimeterDetector()

        self.sources: Dict[str, VideoSource] = {}
        self._zones: Dict[str, List[Dict]] = {}
        self._motion_detectors: Dict[str, MotionDetector] = {}
        self._trackers: Dict[str, ObjectTracker] = {}
        self._camera_locks: Dict[str, threading.Lock] = {}
        self._last_object_inference: Dict[str, float] = {}
        self._last_weapon_inference: Dict[str, float] = {}
        self._latest_detections: Dict[str, List[Dict]] = {}
        self._latest_face_results: Dict[str, List[Dict]] = {}
        self._latest_weapon_detections: Dict[str, List[Dict]] = {}
        self._latest_annotated_frames: Dict[str, np.ndarray] = {}
        self._weapon_history: Dict[str, deque] = {}
        self._source_generations: Dict[str, int] = {}
        self._pipeline_latency = LatencyTracker()
        self._stats_lock = threading.Lock()
        self._processing = False
        self._detection_callback: Optional[Callable] = None
        self._alert_callback: Optional[Callable] = None
        self._frame_callback: Optional[Callable] = None
        self._lock = threading.Lock()

        self._stats = {
            'total_frames_processed': 0,
            'total_detections': 0,
            'total_alerts': 0,
            'object_inferences': 0,
            'weapon_inferences': 0,
            'start_time': None,
        }

    def load_models(self):
        self.yolo_detector.load_model()
        self.yolo_detector.warmup()
        face_loaded = self.face_recognizer.load_model()
        if face_loaded:
            self.face_recognizer.warmup()
        weapon_loaded = not config.WEAPON_ENABLED
        if config.WEAPON_ENABLED:
            weapon_loaded = self.weapon_detector.load_model()
            if weapon_loaded:
                self.weapon_detector.warmup()
        if weapon_loaded:
            print("Required AI models loaded")
        else:
            print("AI service started in degraded mode: weapon model unavailable")

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
        normalized = []
        for zone in zones:
            normalized_zone = dict(zone)
            normalized_zone['type'] = str(zone.get('type', 'MONITORED')).upper()
            normalized.append(normalized_zone)
        self._zones[camera_id] = normalized

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
        cy = bbox['y'] + bbox['height']
        for zone in zones:
            if not zone.get('enabled', True):
                continue
            polygon = zone.get('polygon', [])
            if len(polygon) >= 3 and self._point_in_polygon(cx, cy, polygon):
                return zone.get('type', 'MONITORED')
        return None

    def _get_camera_state(self, camera_id: str):
        with self._lock:
            if camera_id not in self._motion_detectors:
                self._motion_detectors[camera_id] = MotionDetector(
                    sensitivity=config.MOTION_SENSITIVITY)
            if camera_id not in self._trackers:
                self._trackers[camera_id] = ObjectTracker()
            if camera_id not in self._camera_locks:
                self._camera_locks[camera_id] = threading.Lock()
            motion_detector = self._motion_detectors[camera_id]
            tracker = self._trackers[camera_id]
            camera_lock = self._camera_locks[camera_id]
        return motion_detector, tracker, camera_lock

    def add_file_source(self, source_id: str, file_path: str,
                        loop: bool = True, target_fps: int = 25) -> dict:
        source = FileVideoSource(source_id, file_path, loop, target_fps)
        return self._replace_source(source_id, source)

    def add_rtsp_source(self, source_id: str, rtsp_url: str,
                        username: str = '', password: str = '',
                        target_fps: int = 25) -> dict:
        source = RTSPVideoSource(source_id, rtsp_url, username, password, target_fps)
        return self._replace_source(source_id, source)

    def add_usb_source(self, source_id: str, device_index: int = 0,
                       target_fps: int = 25) -> dict:
        source = UsbVideoSource(source_id, device_index, target_fps)
        return self._replace_source(source_id, source)

    def _replace_source(self, source_id: str, source: VideoSource) -> dict:
        with self._lock:
            previous = self.sources.pop(source_id, None)
            generation = self._source_generations.get(source_id, 0) + 1
            self._source_generations[source_id] = generation
        if previous:
            previous.stop()
        self._clear_camera_state(source_id)
        source.set_frame_callback(
            lambda sid, frame, gen=generation: self._on_frame(sid, frame, gen))
        with self._lock:
            self.sources[source_id] = source
        self.video_buffer.create_buffer(source_id)
        return source.get_info()

    def remove_source(self, source_id: str):
        with self._lock:
            source = self.sources.pop(source_id, None)
            self._source_generations[source_id] = self._source_generations.get(source_id, 0) + 1
        if source:
            source.stop()
        self._clear_camera_state(source_id)

    def _clear_camera_state(self, source_id: str):
        with self._lock:
            camera_lock = self._camera_locks.get(source_id)
        if camera_lock:
            camera_lock.acquire()
        try:
            self._clear_camera_state_locked(source_id)
        finally:
            if camera_lock:
                camera_lock.release()

    def _clear_camera_state_locked(self, source_id: str):
        with self._lock:
            self._motion_detectors.pop(source_id, None)
            self._trackers.pop(source_id, None)
            self._last_object_inference.pop(source_id, None)
            self._last_weapon_inference.pop(source_id, None)
            self._latest_detections.pop(source_id, None)
            self._latest_face_results.pop(source_id, None)
            self._latest_weapon_detections.pop(source_id, None)
            self._latest_annotated_frames.pop(source_id, None)
            prefix = f"{source_id}:"
            self._weapon_history = {
                key: value for key, value in self._weapon_history.items()
                if not key.startswith(prefix)
            }
        self.behavior_analyzer.clear_camera(source_id)
        self.perimeter_detector.clear_camera(source_id)
        self.rule_engine.clear_camera(source_id)
        self.video_buffer.clear_buffer(source_id)

    def start_source(self, source_id: str):
        with self._lock:
            source = self.sources.get(source_id)
        if source:
            source.start()

    def stop_source(self, source_id: str):
        with self._lock:
            source = self.sources.get(source_id)
        if source:
            source.stop()
            self._clear_camera_state(source_id)

    def start_all(self):
        with self._lock:
            sources = list(self.sources.values())
        for source in sources:
            source.start()

    def stop_all(self):
        with self._lock:
            sources = list(self.sources.items())
        for source_id, source in sources:
            source.stop()
            self._clear_camera_state(source_id)

    def _generation_is_current(self, source_id: str, generation: Optional[int]) -> bool:
        if generation is None:
            return True
        with self._lock:
            return self._source_generations.get(source_id) == generation

    def _on_frame(self, source_id: str, frame: np.ndarray, generation: Optional[int] = None):
        if not self._generation_is_current(source_id, generation):
            return
        try:
            result = self.process_frame(source_id, frame, generation)
            if self._frame_callback and self._generation_is_current(source_id, generation):
                self._frame_callback(source_id, frame, result)
        except Exception as e:
            print(f"[{source_id}] Processing error: {e}")

    def process_frame(self, camera_id: str, frame: np.ndarray,
                      generation: Optional[int] = None) -> dict:
        motion_detector, tracker, camera_lock = self._get_camera_state(camera_id)
        with camera_lock:
            if not self._generation_is_current(camera_id, generation):
                return self._empty_result(frame)
            return self._process_frame(
                camera_id, frame, motion_detector, tracker, generation)

    def _empty_result(self, frame: np.ndarray) -> dict:
        return {
            'detections': [],
            'face_results': [],
            'weapon_detections': [],
            'alert': None,
            'has_motion': False,
            'annotated_frame': frame.copy(),
        }

    def _process_frame(self, camera_id: str, frame: np.ndarray,
                       motion_detector: MotionDetector, tracker: ObjectTracker,
                       generation: Optional[int] = None) -> dict:
        pipeline_started = time.perf_counter()
        self.video_buffer.add_frame(camera_id, frame)
        self._increment_stat('total_frames_processed')
        now = time.monotonic()

        has_motion, _ = motion_detector.detect(frame)

        object_interval = 1.0 / max(0.1, self.runtime.get_object_fps())
        should_detect_objects = now - self._last_object_inference.get(camera_id, 0.0) >= object_interval
        if should_detect_objects:
            detections = self.yolo_detector.detect(frame)
            self._increment_stat('object_inferences')
            tracked = tracker.update(detections)
            face_results = self.face_recognizer.recognize(frame)
            self._latest_detections[camera_id] = tracked
            self._latest_face_results[camera_id] = face_results
            self._last_object_inference[camera_id] = time.monotonic()
        else:
            tracked = self._latest_detections.get(camera_id, [])
            face_results = self._latest_face_results.get(camera_id, [])

        weapon_detections = self._latest_weapon_detections.get(camera_id, [])
        if self.weapon_detector.model is not None and config.WEAPON_ENABLED:
            weapon_interval = 1.0 / max(0.1, self.runtime.get_weapon_fps())
            if now - self._last_weapon_inference.get(camera_id, 0.0) >= weapon_interval:
                raw_weapon_detections = self.weapon_detector.detect(frame)
                self._increment_stat('weapon_inferences')
                weapon_detections = self._confirm_weapon_detections(
                    camera_id, tracked, raw_weapon_detections)
                self._latest_weapon_detections[camera_id] = weapon_detections
                self._last_weapon_inference[camera_id] = time.monotonic()

        zones = self._zones.get(camera_id, [])
        for det in tracked:
            if det['class'] == 'person':
                det['zone_type'] = self._detect_zone(camera_id, det['bbox'])

        for det in tracked:
            if det['class'] == 'person':
                det['behavior'] = self.behavior_analyzer.analyze(camera_id, det, tracker)

        for det in tracked:
            if det['class'] == 'person':
                det['perimeter'] = self.perimeter_detector.analyze(
                    camera_id, det, tracker, zones,
                )

        if not self._generation_is_current(camera_id, generation):
            return self._empty_result(frame)

        alert = self.rule_engine.evaluate(
            detections=tracked,
            face_results=face_results,
            active_zone=None,
            zone_type=None,
            camera_id=camera_id,
            weapon_detections=weapon_detections,
            tracker=tracker,
        )

        annotated = self._annotate_frame(frame, tracked, face_results, has_motion, weapon_detections)
        self._latest_annotated_frames[camera_id] = annotated
        self._pipeline_latency.record((time.perf_counter() - pipeline_started) * 1000)

        if alert:
            self._increment_stat('total_alerts')
            timestamp = time.time()
            event_time = time.strftime('%Y-%m-%d_%H-%M-%S', time.localtime(timestamp))
            event_id = f"{event_time}_{int(timestamp * 1000) % 1000:03d}_{uuid.uuid4().hex[:8]}"
            clip_path = os.path.join(config.EVIDENCE_DIR, f"alert_{event_id}.mp4")
            if not self.video_buffer.save_clip(camera_id, timestamp, clip_path):
                clip_path = ""

            snapshot_path = ""
            try:
                snap_name = f"alert_{event_id}.jpg"
                snapshot_path = os.path.join(config.EVIDENCE_DIR, snap_name)
                if not cv2.imwrite(snapshot_path, annotated):
                    raise RuntimeError("OpenCV could not write the snapshot")
            except Exception as e:
                print(f"[{camera_id}] Failed to save snapshot: {e}")
                snapshot_path = ""

            if (self._alert_callback
                    and self._generation_is_current(camera_id, generation)):
                self._alert_callback(camera_id, alert, clip_path, snapshot_path)

        if should_detect_objects and tracked:
            self._increment_stat('total_detections', len(tracked))

        if (self._detection_callback
                and self._generation_is_current(camera_id, generation)):
            self._detection_callback(camera_id, tracked, face_results)

        return {
            'detections': tracked,
            'face_results': face_results,
            'weapon_detections': weapon_detections,
            'alert': alert,
            'has_motion': has_motion,
            'annotated_frame': annotated,
        }

    def _confirm_weapon_detections(self, camera_id: str, detections: List[Dict],
                                   weapon_detections: List[Dict]) -> List[Dict]:
        persons = [d for d in detections if d.get('class') == 'person']
        hits = set()

        for weapon in weapon_detections:
            best_person = None
            best_score = 0.0
            for person in persons:
                score = self._weapon_person_score(person['bbox'], weapon['bbox'])
                if score > best_score:
                    best_score = score
                    best_person = person
            if best_person is not None and best_score >= 0.5:
                tracking_id = best_person.get('tracking_id')
                weapon['associated_tracking_id'] = tracking_id
                key = f"{camera_id}:{tracking_id}:{weapon['class'].lower()}"
                hits.add(key)

        camera_prefix = f"{camera_id}:"
        active_keys = {key for key in self._weapon_history if key.startswith(camera_prefix)} | hits
        for key in active_keys:
            history = self._weapon_history.setdefault(
                key, deque(maxlen=max(1, config.WEAPON_CONFIRM_WINDOW)))
            history.append(key in hits)
            if not any(history):
                self._weapon_history.pop(key, None)

        for weapon in weapon_detections:
            tracking_id = weapon.get('associated_tracking_id')
            if tracking_id is None:
                weapon['confirmed'] = False
                continue
            key = f"{camera_id}:{tracking_id}:{weapon['class'].lower()}"
            history = self._weapon_history.get(key, ())
            weapon['confirmation_hits'] = sum(history)
            weapon['confirmation_window'] = len(history)
            weapon['confirmed'] = sum(history) >= max(1, config.WEAPON_CONFIRM_HITS)

        return weapon_detections

    def _weapon_person_score(self, person_bbox: Dict, weapon_bbox: Dict) -> float:
        px1 = person_bbox['x'] - person_bbox['width'] * 0.1
        py1 = person_bbox['y'] - person_bbox['height'] * 0.05
        px2 = person_bbox['x'] + person_bbox['width'] * 1.1
        py2 = person_bbox['y'] + person_bbox['height'] * 1.05
        wx1, wy1 = weapon_bbox['x'], weapon_bbox['y']
        wx2 = wx1 + weapon_bbox['width']
        wy2 = wy1 + weapon_bbox['height']
        intersection = max(0, min(px2, wx2) - max(px1, wx1)) * max(0, min(py2, wy2) - max(py1, wy1))
        weapon_area = max(1, weapon_bbox['width'] * weapon_bbox['height'])
        center_inside = px1 <= (wx1 + wx2) / 2 <= px2 and py1 <= (wy1 + wy2) / 2 <= py2
        return max(intersection / weapon_area, 1.0 if center_inside else 0.0)

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
                state = "CONFIRMED" if wd.get('confirmed') else "VERIFYING"
                cv2.putText(annotated, f"{state}: {wd['class']} {wd['confidence']:.2f}",
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
        with self._stats_lock:
            stats = dict(self._stats)
        if stats['start_time']:
            stats['uptime_seconds'] = time.time() - stats['start_time']
        stats['runtime'] = self.runtime.get_status()
        stats['latency'] = {
            'pipeline': self._pipeline_latency.snapshot(),
            'objects': self.yolo_detector.latency.snapshot(),
            'weapons': self.weapon_detector.latency.snapshot(),
            'faces': self.face_recognizer.latency.snapshot(),
        }
        return stats

    def _increment_stat(self, name: str, amount: int = 1):
        with self._stats_lock:
            self._stats[name] += amount

    def get_snapshot(self, source_id: str) -> Optional[np.ndarray]:
        with self._lock:
            annotated = self._latest_annotated_frames.get(source_id)
            if annotated is not None:
                return annotated.copy()
            if source_id in self.sources:
                source = self.sources[source_id]
                return source._current_frame.copy() if source._current_frame is not None else None
        return None
