import os
import sys
import unittest

import numpy as np

AI_DIR = os.path.dirname(os.path.dirname(__file__))
if AI_DIR not in sys.path:
    sys.path.insert(0, AI_DIR)

import config
from detection.weapon_detector import WeaponDetector
from detection.face_cover_detector import FaceCoverDetector
from processor import FrameProcessor
from rules.rule_engine import RuleEngine
from tracking.tracker import ObjectTracker


def person(weapon=None, face_cover=None, tracking_id=1):
    detection = {
        'class': 'person',
        'confidence': 0.95,
        'tracking_id': tracking_id,
        'bbox': {'x': 20, 'y': 20, 'width': 100, 'height': 180},
    }
    if weapon:
        detection['weapon'] = {
            'class': weapon,
            'confidence': 0.91,
            'bbox': {'x': 80, 'y': 100, 'width': 30, 'height': 20},
        }
    if face_cover:
        detection['face_cover'] = {
            'class': 'covered',
            'confidence': 0.88,
            'bbox': {'x': 45, 'y': 30, 'width': 45, 'height': 45},
        }
    return detection


class ThreatRuleTests(unittest.TestCase):
    def setUp(self):
        self.engine = RuleEngine()
        self.engine.load_default_rules()

    def test_normal_person_never_alerts(self):
        for _ in range(20):
            self.assertEqual(self.engine.evaluate('cam', [person()]), [])

    def test_weapon_requires_confirmation_and_emits_once(self):
        for _ in range(config.WEAPON_CONFIRMATIONS - 1):
            self.assertEqual(self.engine.evaluate('cam', [person(weapon='gun')]), [])
        alerts = self.engine.evaluate('cam', [person(weapon='gun')])
        self.assertEqual([alert['event_type'] for alert in alerts], ['WEAPON_DETECTED'])
        self.assertEqual(self.engine.evaluate('cam', [person(weapon='gun')]), [])

    def test_face_cover_requires_confirmation(self):
        for _ in range(config.FACE_COVER_CONFIRMATIONS - 1):
            self.assertEqual(self.engine.evaluate('cam', [person(face_cover=True)]), [])
        alerts = self.engine.evaluate('cam', [person(face_cover=True)])
        self.assertEqual([alert['event_type'] for alert in alerts], ['FACE_COVERED'])

    def test_alert_types_are_independent(self):
        alerts = []
        for _ in range(max(config.WEAPON_CONFIRMATIONS, config.FACE_COVER_CONFIRMATIONS)):
            alerts.extend(self.engine.evaluate('cam', [person(weapon='knife', face_cover=True)]))
        self.assertEqual(
            {alert['event_type'] for alert in alerts},
            {'WEAPON_DETECTED', 'FACE_COVERED'},
        )

    def test_disabled_rule_never_alerts(self):
        self.engine.load_rules([
            {'id': 'weapon_detected', 'enabled': False},
            {'id': 'face_covered', 'enabled': True},
        ])
        for _ in range(10):
            self.assertEqual(self.engine.evaluate('cam', [person(weapon='gun')]), [])

    def test_incident_rearms_only_after_continuous_absence(self):
        for _ in range(config.WEAPON_CONFIRMATIONS):
            alerts = self.engine.evaluate('cam', [person(weapon='knife')])
        self.assertEqual(len(alerts), 1)

        for _ in range(config.THREAT_CLEAR_OBSERVATIONS - 1):
            self.engine.evaluate('cam', [person()])
        for _ in range(config.WEAPON_CONFIRMATIONS):
            self.assertEqual(self.engine.evaluate('cam', [person(weapon='knife')]), [])

        for _ in range(config.THREAT_CLEAR_OBSERVATIONS):
            self.engine.evaluate('cam', [person()])
        alerts = []
        for _ in range(config.WEAPON_CONFIRMATIONS):
            alerts.extend(self.engine.evaluate('cam', [person(weapon='knife')]))
        self.assertEqual(alerts, [])

        for _ in range(config.THREAT_CLEAR_OBSERVATIONS):
            self.engine.evaluate('cam', [person()])
        state = self.engine._states['cam:weapon_detected:knife']
        state['last_alert_at'] -= config.THREAT_MIN_REARM_SECONDS + 1
        alerts = []
        for _ in range(config.WEAPON_CONFIRMATIONS):
            alerts.extend(self.engine.evaluate('cam', [person(weapon='knife')]))
        self.assertEqual(len(alerts), 1)


class DetectorAndTrackerTests(unittest.TestCase):
    def test_only_guns_and_knives_are_allowed(self):
        self.assertEqual(WeaponDetector.normalize_label('Gun'), 'gun')
        self.assertEqual(WeaponDetector.normalize_label('pistol'), 'gun')
        self.assertEqual(WeaponDetector.normalize_label('Knife'), 'knife')
        self.assertIsNone(WeaponDetector.normalize_label('grenade'))
        self.assertIsNone(WeaponDetector.normalize_label('Explosive'))
        self.assertIsNone(WeaponDetector.normalize_label('phone'))

    def test_weapon_requires_matching_verifier_detection(self):
        candidate = {
            'class': 'gun',
            'bbox': {'x': 100, 'y': 100, 'width': 80, 'height': 40},
        }
        wrong_class = {
            'class': 'knife',
            'bbox': {'x': 100, 'y': 100, 'width': 80, 'height': 40},
        }
        distant_gun = {
            'class': 'gun',
            'bbox': {'x': 300, 'y': 300, 'width': 80, 'height': 40},
        }
        self.assertFalse(WeaponDetector._has_verifier_support(
            candidate, [wrong_class, distant_gun]))

    def test_overlapping_weapon_verifier_is_accepted(self):
        candidate = {
            'class': 'gun',
            'bbox': {'x': 100, 'y': 100, 'width': 80, 'height': 40},
        }
        verifier = {
            'class': 'gun',
            'bbox': {'x': 110, 'y': 90, 'width': 100, 'height': 70},
        }
        self.assertTrue(WeaponDetector._has_verifier_support(
            candidate, [verifier]))

    def test_person_hand_shape_is_not_a_gun(self):
        self.assertFalse(WeaponDetector._is_plausible_gun_shape(104, 130))
        self.assertTrue(WeaponDetector._is_plausible_gun_shape(136, 126))

    def test_tracker_assigns_each_detection_once(self):
        tracker = ObjectTracker()
        detections = [
            {'class': 'person', 'confidence': 0.9, 'bbox': {'x': 0, 'y': 0, 'width': 40, 'height': 80}},
            {'class': 'person', 'confidence': 0.9, 'bbox': {'x': 60, 'y': 0, 'width': 40, 'height': 80}},
        ]
        tracked = tracker.update(detections)
        self.assertEqual(len({item['tracking_id'] for item in tracked}), 2)

    def test_normal_frame_has_no_overlay(self):
        frame = np.zeros((240, 320, 3), dtype=np.uint8)
        annotated = FrameProcessor._annotate_frame(frame, [person()])
        self.assertTrue(np.array_equal(frame, annotated))

    def test_people_overlay_can_be_enabled(self):
        frame = np.zeros((240, 320, 3), dtype=np.uint8)
        annotated = FrameProcessor._annotate_frame(
            frame, [person()], show_people=True)
        self.assertFalse(np.array_equal(frame, annotated))

    def test_confirmed_weapon_is_annotated(self):
        frame = np.zeros((240, 320, 3), dtype=np.uint8)
        detection = person(weapon='gun')
        detection['confirmed_threats'] = {'weapon_detected': detection['weapon']}
        annotated = FrameProcessor._annotate_frame(frame, [detection])
        self.assertFalse(np.array_equal(frame, annotated))

    def test_weapon_candidate_is_annotated_before_alert_confirmation(self):
        frame = np.zeros((240, 320, 3), dtype=np.uint8)
        annotated = FrameProcessor._annotate_frame(frame, [person(weapon='gun')])
        self.assertFalse(np.array_equal(frame, annotated))

    def test_large_background_object_is_not_associated_as_weapon(self):
        processor = FrameProcessor()
        detected_person = person()
        weapon = {
            'class': 'gun',
            'confidence': 0.95,
            'bbox': {'x': 90, 'y': 30, 'width': 80, 'height': 150},
        }
        processor._associate_weapons([detected_person], [weapon])
        self.assertNotIn('weapon', detected_person)

    def test_plausibly_sized_weapon_is_associated(self):
        processor = FrameProcessor()
        detected_person = person()
        weapon = {
            'class': 'knife',
            'confidence': 0.95,
            'bbox': {'x': 75, 'y': 90, 'width': 12, 'height': 45},
        }
        processor._associate_weapons([detected_person], [weapon])
        self.assertEqual(detected_person['weapon'], weapon)

    def test_close_horizontal_gun_is_associated(self):
        processor = FrameProcessor()
        detected_person = person()
        weapon = {
            'class': 'gun',
            'confidence': 0.63,
            'bbox': {'x': 35, 'y': 100, 'width': 75, 'height': 25},
        }
        processor._associate_weapons([detected_person], [weapon])
        self.assertEqual(detected_person['weapon'], weapon)

    def test_vertical_remote_is_not_associated_as_gun(self):
        processor = FrameProcessor()
        detected_person = person()
        weapon = {
            'class': 'gun',
            'confidence': 0.75,
            'bbox': {'x': 75, 'y': 70, 'width': 15, 'height': 55},
        }
        processor._associate_weapons([detected_person], [weapon])
        self.assertNotIn('weapon', detected_person)

    def test_valid_unassociated_weapon_is_kept_as_standalone_threat(self):
        weapon = {
            'class': 'gun',
            'confidence': 0.7,
            'bbox': {'x': 150, 'y': 50, 'width': 60, 'height': 40},
        }
        standalone = FrameProcessor._standalone_weapons([person()], [weapon])
        self.assertEqual(len(standalone), 1)
        self.assertIs(standalone[0]['weapon'], weapon)

    def test_weapon_is_scanned_without_person_detections(self):
        processor = FrameProcessor()
        weapon = {
            'class': 'gun',
            'confidence': 0.7,
            'bbox': {'x': 150, 'y': 50, 'width': 60, 'height': 40},
        }
        processor.yolo_detector.detect = lambda frame: []
        processor.weapon_detector.detect = lambda frame: [weapon]
        processor.rule_engine.evaluate = lambda camera_id, detections: []

        result = processor._run_inference(
            'cam', np.zeros((240, 320, 3), dtype=np.uint8))

        self.assertEqual(result['weapon_detections'], [weapon])
        self.assertEqual(len(result['detections']), 1)
        self.assertIs(result['detections'][0]['weapon'], weapon)

    def test_phone_near_weapon_candidate_vetoes_it(self):
        weapon_bbox = {'x': 540, 'y': 239, 'width': 235, 'height': 136}
        phone_bbox = {'x': 630, 'y': 374, 'width': 98, 'height': 154}
        self.assertTrue(FrameProcessor._is_near_veto(
            weapon_bbox, phone_bbox))

    def test_distant_phone_does_not_veto_weapon(self):
        weapon_bbox = {'x': 490, 'y': 260, 'width': 136, 'height': 126}
        phone_bbox = {'x': 900, 'y': 500, 'width': 60, 'height': 100}
        self.assertFalse(FrameProcessor._is_near_veto(
            weapon_bbox, phone_bbox))

    def test_bottle_is_a_weapon_veto_class(self):
        self.assertIn('bottle', config.WEAPON_VETO_CLASSES)

    def test_hood_sized_box_is_associated_as_face_cover(self):
        processor = FrameProcessor()
        detected_person = person()
        cover = {
            'class': 'covered',
            'confidence': 0.9,
            'bbox': {'x': 30, 'y': 20, 'width': 60, 'height': 90},
        }
        processor._associate_face_covers([detected_person], [cover])
        self.assertEqual(detected_person['face_cover'], cover)

    def test_face_sized_cover_is_associated(self):
        processor = FrameProcessor()
        detected_person = person()
        cover = {
            'class': 'covered',
            'confidence': 0.9,
            'bbox': {'x': 45, 'y': 30, 'width': 45, 'height': 55},
        }
        processor._associate_face_covers([detected_person], [cover])
        self.assertEqual(detected_person['face_cover'], cover)

    def test_visible_face_inside_cover_box_vetoes_detection(self):
        cover = {'x': 100, 'y': 50, 'width': 200, 'height': 300}
        visible_face = {'x': 150, 'y': 80, 'width': 100, 'height': 140}
        self.assertTrue(FaceCoverDetector._contains_visible_face(
            cover, [visible_face]))

    def test_distant_visible_face_does_not_veto_detection(self):
        cover = {'x': 100, 'y': 50, 'width': 200, 'height': 300}
        visible_face = {'x': 500, 'y': 80, 'width': 100, 'height': 140}
        self.assertFalse(FaceCoverDetector._contains_visible_face(
            cover, [visible_face]))


if __name__ == '__main__':
    unittest.main()
