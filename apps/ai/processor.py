import cv2
import time
import threading
import numpy as np
from typing import Callable, Dict, List, Optional

import config
from buffer.video_buffer import VideoBuffer
from detection.face_cover_detector import FaceCoverDetector
from detection.weapon_detector import WeaponDetector
from detection.yolo_detector import YoloDetector
from recognition.face_recognizer import FaceRecognizer
from rules.rule_engine import RuleEngine
from sources.base import VideoSource
from sources.file_source import FileVideoSource
from sources.rtsp_source import RTSPVideoSource
from sources.usb_source import UsbVideoSource
from tracking.tracker import ObjectTracker


class FrameProcessor:
    def __init__(self):
        self.yolo_detector = YoloDetector()
        self.weapon_detector = WeaponDetector()
        self.face_cover_detector = FaceCoverDetector()
        self.face_recognizer = FaceRecognizer()
        self.rule_engine = RuleEngine()
        self.video_buffer = VideoBuffer()

        self.sources: Dict[str, VideoSource] = {}
        self._zones: Dict[str, List[Dict]] = {}
        self._trackers: Dict[str, ObjectTracker] = {}
        self._last_inference: Dict[str, float] = {}
        self._latest_results: Dict[str, Dict] = {}
        self._pending_frames: Dict[str, np.ndarray] = {}
        self._processing_events: Dict[str, threading.Event] = {}
        self._processing_threads: Dict[str, threading.Thread] = {}
        self._detection_callback: Optional[Callable] = None
        self._alert_callback: Optional[Callable] = None
        self._frame_callback: Optional[Callable] = None
        self._lock = threading.RLock()
        self._frame_lock = threading.Lock()

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
        if config.FACE_COVER_ENABLED:
            self.face_cover_detector.load_model()
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

    def _create_source(self, source_id: str, source: VideoSource) -> dict:
        with self._lock:
            if source_id in self.sources:
                self.sources[source_id].stop()
                self._stop_processing_worker(source_id)
            source.set_frame_callback(self._on_frame)
            self.sources[source_id] = source
            self._trackers[source_id] = ObjectTracker()
            self.video_buffer.create_buffer(source_id)
            self._start_processing_worker(source_id)
            return source.get_info()

    def _start_processing_worker(self, source_id: str):
        event = threading.Event()
        self._processing_events[source_id] = event
        thread = threading.Thread(
            target=self._processing_loop, args=(source_id,), daemon=True)
        self._processing_threads[source_id] = thread
        thread.start()

    def _processing_loop(self, source_id: str):
        while source_id in self._processing_events:
            event = self._processing_events[source_id]
            event.wait(timeout=1.0)
            if source_id not in self._processing_events:
                break
            with self._frame_lock:
                frame = self._pending_frames.pop(source_id, None)
                event.clear()
            if frame is not None:
                try:
                    self.process_frame(source_id, frame)
                except Exception as exc:
                    print(f"[{source_id}] Processing error: {exc}")

    def _stop_processing_worker(self, source_id: str):
        event = self._processing_events.pop(source_id, None)
        if event:
            event.set()
        thread = self._processing_threads.pop(source_id, None)
        if thread and thread is not threading.current_thread():
            thread.join(timeout=2)
        self._pending_frames.pop(source_id, None)

    def add_file_source(self, source_id: str, file_path: str,
                        loop: bool = True, target_fps: int = 25) -> dict:
        return self._create_source(
            source_id, FileVideoSource(source_id, file_path, loop, target_fps))

    def add_rtsp_source(self, source_id: str, rtsp_url: str,
                        username: str = '', password: str = '',
                        target_fps: int = 25) -> dict:
        return self._create_source(
            source_id,
            RTSPVideoSource(source_id, rtsp_url, username, password, target_fps),
        )

    def add_usb_source(self, source_id: str, device_index: int = 0,
                       target_fps: int = 25) -> dict:
        return self._create_source(
            source_id, UsbVideoSource(source_id, device_index, target_fps))

    def remove_source(self, source_id: str):
        with self._lock:
            source = self.sources.pop(source_id, None)
            if source:
                source.stop()
            self._trackers.pop(source_id, None)
            self._last_inference.pop(source_id, None)
            self._latest_results.pop(source_id, None)
            self._stop_processing_worker(source_id)
            self.rule_engine.clear_camera(source_id)

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
        self.video_buffer.add_frame(source_id, frame)
        self._stats['total_frames_processed'] += 1
        with self._frame_lock:
            self._pending_frames[source_id] = frame
            event = self._processing_events.get(source_id)
            if event:
                event.set()

    def process_frame(self, camera_id: str, frame: np.ndarray) -> dict:
        now = time.monotonic()
        interval = 1.0 / max(config.INFERENCE_FPS, 1)
        should_infer = now - self._last_inference.get(camera_id, 0.0) >= interval

        if should_infer:
            self._last_inference[camera_id] = now
            result = self._run_inference(camera_id, frame)
            with self._frame_lock:
                self._latest_results[camera_id] = result
        else:
            with self._frame_lock:
                result = self._latest_results.get(camera_id, self._empty_result())

        annotated = self._annotate_frame(frame, result['detections'])

        if should_infer:
            for alert in result['alerts']:
                self._emit_alert(camera_id, alert, annotated)
            if self._detection_callback:
                self._detection_callback(camera_id, result['detections'], [])
            if self._frame_callback:
                self._frame_callback(camera_id, frame, result)

        response = dict(result)
        response['annotated_frame'] = annotated
        response['alert'] = result['alerts'][0] if result['alerts'] else None
        return response

    def _run_inference(self, camera_id: str, frame: np.ndarray) -> Dict:
        detections = self.yolo_detector.detect(frame)
        tracker = self._trackers.setdefault(camera_id, ObjectTracker())
        tracked = tracker.update(detections)
        people = [d for d in tracked if d['class'] == 'person']
        weapon_vetoes = [
            d for d in tracked if d['class'] in config.WEAPON_VETO_CLASSES]

        weapon_detections = [
            weapon for weapon in self.weapon_detector.detect(frame)
            if not any(
                self._is_near_veto(weapon['bbox'], veto['bbox'])
                for veto in weapon_vetoes
            )
        ]
        face_cover_detections = []
        if people:
            face_cover_detections = self.face_cover_detector.detect(frame)
            self._associate_weapons(people, weapon_detections)
            self._associate_face_covers(people, face_cover_detections)

        standalone_weapons = self._standalone_weapons(people, weapon_detections)
        evaluated_detections = people + standalone_weapons
        alerts = self.rule_engine.evaluate(camera_id, evaluated_detections)
        visible_detections = tracked + standalone_weapons
        self._stats['total_detections'] += len(tracked)
        self._stats['total_alerts'] += len(alerts)
        return {
            'detections': visible_detections,
            'face_results': [],
            'weapon_detections': weapon_detections,
            'face_cover_detections': face_cover_detections,
            'alerts': alerts,
            'has_motion': False,
        }

    @staticmethod
    def _empty_result() -> Dict:
        return {
            'detections': [],
            'face_results': [],
            'weapon_detections': [],
            'face_cover_detections': [],
            'alerts': [],
            'has_motion': False,
        }

    @staticmethod
    def _bbox_center(bbox: Dict) -> tuple:
        return (
            bbox['x'] + bbox['width'] / 2,
            bbox['y'] + bbox['height'] / 2,
        )

    @classmethod
    def _is_near_veto(cls, weapon_bbox: Dict, veto_bbox: Dict) -> bool:
        center_x, center_y = cls._bbox_center(weapon_bbox)
        return (
            veto_bbox['x'] - veto_bbox['width'] <= center_x
            <= veto_bbox['x'] + veto_bbox['width'] * 2
            and veto_bbox['y'] - veto_bbox['height'] <= center_y
            <= veto_bbox['y'] + veto_bbox['height'] * 2
        )

    @staticmethod
    def _inside_expanded_person(point: tuple, person_bbox: Dict) -> bool:
        px, py = point
        margin_x = person_bbox['width'] * 0.08
        margin_y = person_bbox['height'] * 0.08
        return (
            person_bbox['x'] - margin_x <= px <= person_bbox['x'] + person_bbox['width'] + margin_x
            and person_bbox['y'] - margin_y <= py <= person_bbox['y'] + person_bbox['height'] + margin_y
        )

    def _associate_weapons(self, people: List[Dict], weapons: List[Dict]):
        for weapon in weapons:
            center = self._bbox_center(weapon['bbox'])
            candidates = [
                person for person in people
                if self._inside_expanded_person(center, person['bbox'])
                and self._weapon_fits_person(weapon, person['bbox'])
            ]
            if not candidates:
                continue
            person = min(candidates, key=lambda item: self._center_distance(center, item['bbox']))
            current = person.get('weapon')
            if current is None or weapon['confidence'] > current['confidence']:
                person['weapon'] = weapon

    @staticmethod
    def _standalone_weapons(people: List[Dict], weapons: List[Dict]) -> List[Dict]:
        associated = {id(person['weapon']) for person in people if person.get('weapon')}
        return [
            {
                'class': 'weapon',
                'confidence': weapon['confidence'],
                'bbox': dict(weapon['bbox']),
                'weapon': weapon,
                'standalone_weapon': True,
            }
            for weapon in weapons
            if id(weapon) not in associated
        ]

    @staticmethod
    def _weapon_fits_person(weapon: Dict, person_bbox: Dict) -> bool:
        weapon_bbox = weapon['bbox']
        weapon_area = weapon_bbox['width'] * weapon_bbox['height']
        person_area = person_bbox['width'] * person_bbox['height']
        aspect_ratio = weapon_bbox['width'] / max(weapon_bbox['height'], 1)
        if weapon.get('confidence', 0) >= 0.65:
            return (
                person_area > 0
                and weapon_bbox['width'] <= person_bbox['width'] * 1.20
                and weapon_bbox['height'] <= person_bbox['height'] * 1.25
                and weapon_area <= person_area * 1.25
                and (weapon.get('class') != 'gun' or aspect_ratio >= 0.50)
            )
        return (
            person_area > 0
            and weapon_bbox['width'] <= person_bbox['width'] * 0.90
            and weapon_bbox['height'] <= person_bbox['height'] * 0.60
            and weapon_area <= person_area * 0.40
            and (
                weapon.get('class') != 'gun'
                or weapon_bbox['height'] < 40
                or aspect_ratio >= 0.50
            )
        )

    def _associate_face_covers(self, people: List[Dict], covers: List[Dict]):
        for cover in covers:
            center_x, center_y = self._bbox_center(cover['bbox'])
            candidates = []
            for person in people:
                bbox = person['bbox']
                in_head = (
                    bbox['x'] - bbox['width'] * 0.1 <= center_x <= bbox['x'] + bbox['width'] * 1.1
                    and bbox['y'] - bbox['height'] * 0.1 <= center_y <= bbox['y'] + bbox['height'] * 0.55
                )
                if in_head and self._face_cover_fits_person(cover['bbox'], bbox):
                    candidates.append(person)
            if not candidates:
                continue
            person = min(candidates, key=lambda item: self._center_distance((center_x, center_y), item['bbox']))
            current = person.get('face_cover')
            if current is None or cover['confidence'] > current['confidence']:
                person['face_cover'] = cover

    @staticmethod
    def _face_cover_fits_person(cover_bbox: Dict, person_bbox: Dict) -> bool:
        return (
            person_bbox['width'] > 0
            and person_bbox['height'] > 0
            and cover_bbox['width'] <= person_bbox['width'] * 0.70
            and cover_bbox['height'] <= person_bbox['height']
        )

    @staticmethod
    def _center_distance(point: tuple, bbox: Dict) -> float:
        cx = bbox['x'] + bbox['width'] / 2
        cy = bbox['y'] + bbox['height'] / 2
        return (point[0] - cx) ** 2 + (point[1] - cy) ** 2

    def _emit_alert(self, camera_id: str, alert: Dict,
                    annotated_frame: np.ndarray):
        timestamp = time.time()
        event_time = time.strftime('%Y-%m-%d_%H-%M-%S', time.localtime(timestamp))
        rule_id = alert['rule_id']
        clip_path = f"{config.EVIDENCE_DIR}/alert_{rule_id}_{event_time}.mp4"
        snapshot_path = f"{config.EVIDENCE_DIR}/alert_{rule_id}_{event_time}.jpg"
        try:
            cv2.imwrite(snapshot_path, annotated_frame)
        except Exception as exc:
            print(f"[{camera_id}] Failed to save snapshot: {exc}")
            snapshot_path = ''
        threading.Thread(
            target=self._save_alert_evidence,
            args=(camera_id, alert, timestamp, clip_path, snapshot_path),
            daemon=True,
        ).start()

    def _save_alert_evidence(self, camera_id: str, alert: Dict,
                             timestamp: float, clip_path: str,
                             snapshot_path: str):
        clip_saved = self.video_buffer.save_clip(
            camera_id, timestamp, clip_path, post_seconds=0)
        if self._alert_callback:
            self._alert_callback(
                camera_id, alert, clip_path if clip_saved else '', snapshot_path)
        if clip_saved and config.POST_EVENT_SECONDS > 0:
            time.sleep(config.POST_EVENT_SECONDS)
            if not self.video_buffer.save_clip(camera_id, timestamp, clip_path):
                print(f"[{camera_id}] Failed to extend evidence clip: {clip_path}")

    @staticmethod
    def _annotate_frame(frame: np.ndarray, detections: List[Dict],
                        show_people: bool = False) -> np.ndarray:
        annotated = frame.copy()
        for detection in detections:
            confirmed = detection.get('confirmed_threats', {})
            weapon = confirmed.get('weapon_detected') or detection.get('weapon')
            face_cover = confirmed.get('face_covered') or detection.get('face_cover')
            if not weapon and not face_cover:
                if show_people and detection.get('class') == 'person':
                    bbox = detection['bbox']
                    x, y = bbox['x'], bbox['y']
                    width, height = bbox['width'], bbox['height']
                    label = 'PERSONA'
                    if detection.get('tracking_id') is not None:
                        label += f" #{detection['tracking_id']}"
                    cv2.rectangle(
                        annotated, (x, y), (x + width, y + height),
                        (0, 255, 0), 3)
                    cv2.putText(
                        annotated, label, (x, max(25, y - 10)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 0), 2)
                continue

            bbox = detection['bbox']
            x, y, w, h = bbox['x'], bbox['y'], bbox['width'], bbox['height']
            has_weapon = weapon is not None
            color = (0, 0, 255) if has_weapon else (0, 165, 255)
            person_label = 'PERSONA ARMADA' if has_weapon else 'ROSTRO CUBIERTO'
            if not detection.get('standalone_weapon'):
                cv2.rectangle(annotated, (x, y), (x + w, y + h), color, 4)
                cv2.putText(annotated, person_label, (x, max(25, y - 10)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

            if weapon:
                wb = weapon['bbox']
                cv2.rectangle(
                    annotated,
                    (wb['x'], wb['y']),
                    (wb['x'] + wb['width'], wb['y'] + wb['height']),
                    (0, 0, 255), 4,
                )
                weapon_name = 'ARMA' if weapon['class'] == 'gun' else 'CUCHILLO'
                cv2.putText(
                    annotated,
                    f"{weapon_name} {weapon['confidence']:.0%}",
                    (wb['x'], max(25, wb['y'] - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 0, 255), 2,
                )

            if face_cover:
                fb = face_cover['bbox']
                cv2.rectangle(
                    annotated,
                    (fb['x'], fb['y']),
                    (fb['x'] + fb['width'], fb['y'] + fb['height']),
                    (0, 165, 255), 3,
                )
                cv2.putText(
                    annotated,
                    f"CARA TAPADA {face_cover['confidence']:.0%}",
                    (fb['x'], max(25, fb['y'] - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2,
                )
        return annotated

    def get_source_info(self, source_id: str) -> Optional[dict]:
        with self._lock:
            if source_id in self.sources:
                return self.sources[source_id].get_info()
        return None

    def get_all_sources_info(self) -> list:
        with self._lock:
            return [source.get_info() for source in self.sources.values()]

    def get_stats(self) -> dict:
        stats = dict(self._stats)
        if stats['start_time']:
            stats['uptime_seconds'] = time.time() - stats['start_time']
        return stats

    def get_snapshot(self, source_id: str, view: str = 'raw',
                     show_people: bool = False) -> Optional[np.ndarray]:
        with self._lock:
            source = self.sources.get(source_id)
            if source and source._current_frame is not None:
                frame = source._current_frame.copy()
            else:
                return None
        if view == 'annotated':
            with self._frame_lock:
                result = self._latest_results.get(source_id, self._empty_result())
            return self._annotate_frame(
                frame, result['detections'], show_people=show_people)
        return frame
