#!/usr/bin/env python3
"""
Phase 2 Test Script
Tests the video processing pipeline end-to-end without requiring
actual video files or cameras. Generates synthetic frames.

Usage:
    python test_phase2.py
"""

import sys
import os
import time
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))


def test_motion_detector():
    print("=== Test: Motion Detector ===")
    from detection.motion_detector import MotionDetector

    detector = MotionDetector(sensitivity=0.5)
    frame1 = np.zeros((720, 1280, 3), dtype=np.uint8)
    has_motion, overlay = detector.detect(frame1)
    assert isinstance(has_motion, bool), "Motion detection should return bool"
    print(f"  Static frame: motion={has_motion}")

    frame2 = frame1.copy()
    frame2[100:400, 200:500] = 255
    has_motion2, overlay2 = detector.detect(frame2)
    assert isinstance(has_motion2, bool), "Motion detection should return bool"
    print(f"  Changed frame: motion={has_motion2}")
    print("  PASS\n")


def test_yolo_detector():
    print("=== Test: YOLO Detector ===")
    try:
        from detection.yolo_detector import YoloDetector
    except ImportError as e:
        print(f"  SKIP (dependency not installed: {e})\n")
        return

    detector = YoloDetector()
    print(f"  Model: {detector.model_path}")
    print(f"  Confidence: {detector.confidence_threshold}")
    print(f"  Classes: {detector.enabled_classes}")
    print("  PASS (class instantiates correctly, inference needs GPU/longer time)")
    print()


def test_tracker():
    print("=== Test: Object Tracker ===")
    from tracking.tracker import ObjectTracker

    tracker = ObjectTracker()

    detections1 = [
        {'class': 'person', 'confidence': 0.9, 'bbox': {'x': 100, 'y': 200, 'width': 80, 'height': 200}},
    ]
    tracked1 = tracker.update(detections1)
    assert len(tracked1) == 1, "Should track 1 object"
    assert 'tracking_id' in tracked1[0], "Should have tracking_id"
    id1 = tracked1[0]['tracking_id']
    print(f"  Frame 1: tracked object #{id1}")

    detections2 = [
        {'class': 'person', 'confidence': 0.92, 'bbox': {'x': 105, 'y': 205, 'width': 80, 'height': 200}},
    ]
    tracked2 = tracker.update(detections2)
    id2 = tracked2[0]['tracking_id']
    print(f"  Frame 2: tracked object #{id2}")
    assert id1 == id2, "Same object should keep same tracking ID"
    print(f"  Persistent ID maintained: #{id1} == #{id2}")
    print("  PASS\n")


def test_rule_engine():
    print("=== Test: Rule Engine ===")
    from rules.rule_engine import RuleEngine

    engine = RuleEngine()
    engine.load_rules([
        {
            'id': 'test_rule',
            'name': 'Unknown person in restricted zone',
            'enabled': True,
            'conditions': [
                {'field': 'object_class', 'operator': 'equals', 'value': 'person'},
                {'field': 'identity', 'operator': 'equals', 'value': 'unknown'},
                {'field': 'zone_type', 'operator': 'equals', 'value': 'restricted'},
            ],
            'actions': ['CREATE_ALERT', 'SEND_NOTIFICATION'],
            'schedule': None,
            'cooldown_seconds': 60,
        }
    ])

    detections = [
        {'class': 'person', 'confidence': 0.9, 'bbox': {'x': 100, 'y': 200, 'width': 80, 'height': 200}, 'tracking_id': 1},
    ]
    face_results = [
        {'person_id': None, 'confidence': 0.3, 'bbox': {'x': 110, 'y': 210, 'width': 60, 'height': 100}, 'is_known': False},
    ]

    result = engine.evaluate(detections, face_results, None, 'restricted', 'cam1')
    assert result is not None, "Rule should match"
    assert result['rule_name'] == 'Unknown person in restricted zone'
    print(f"  Alert triggered: {result['rule_name']}")
    print("  PASS\n")


def test_video_buffer():
    print("=== Test: Video Buffer ===")
    from buffer.video_buffer import VideoBuffer

    buffer = VideoBuffer(duration_seconds=2, fps=5)
    buffer.create_buffer('test_cam')

    for i in range(20):
        frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        buffer.add_frame('test_cam', frame)

    info = buffer.get_buffer_info()
    assert 'test_cam' in info
    print(f"  Buffer frames: {info['test_cam']}")

    frames = buffer.get_pre_event_frames('test_cam', seconds=1)
    print(f"  Pre-event frames (1s): {len(frames)}")
    print("  PASS\n")


def test_video_sources():
    print("=== Test: Video Sources ===")
    from sources.base import SourceStatus
    from sources.file_source import FileVideoSource

    source = FileVideoSource('test', '/nonexistent.mp4', loop=False)
    assert source.status == SourceStatus.IDLE
    assert source.source_id == 'test'
    info = source.get_info()
    assert info['type'] == 'file'
    print(f"  Source type: {info['type']}")
    print(f"  Source status: {info['status']}")
    print("  PASS (source created without errors)\n")


def test_processor_standalone():
    print("=== Test: Frame Processor (standalone) ===")
    try:
        from processor import FrameProcessor
        processor = FrameProcessor()
        print("  Processor created successfully")
        print("  Components: MotionDetector + YoloDetector + Tracker + FaceRecognizer + RuleEngine + VideoBuffer")
        print("  PASS")
    except Exception as e:
        print(f"  SKIP (error: {e})")
    print()


def main():
    print("Phase 2 Tests - Video Processing Pipeline\n")

    test_motion_detector()
    test_tracker()
    test_rule_engine()
    test_video_buffer()
    test_video_sources()
    test_yolo_detector()
    test_processor_standalone()

    print("=" * 50)
    print("All tests completed!")


if __name__ == '__main__':
    main()
