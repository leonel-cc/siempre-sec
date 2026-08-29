import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch


sys.path.insert(0, os.path.dirname(__file__))


class ThreatDetectionTests(unittest.TestCase):
    def setUp(self):
        from processor import FrameProcessor

        self.processor = FrameProcessor()
        self.person = {
            "class": "person",
            "confidence": 0.91,
            "tracking_id": 7,
            "bbox": {"x": 100, "y": 50, "width": 200, "height": 400},
            "behavior": {},
            "perimeter": {},
            "zone_type": None,
        }

    def test_only_guns_and_knives_are_enabled(self):
        import config

        self.assertEqual(config.WEAPON_CLASSES, {"gun", "knife"})

    def test_small_weapon_inside_person_is_confirmed_over_time(self):
        weapon = {
            "class": "Gun",
            "confidence": 0.84,
            "bbox": {"x": 245, "y": 210, "width": 24, "height": 18},
        }

        first = self.processor._confirm_weapon_detections(
            "camera-a", [self.person], [dict(weapon)])
        second = self.processor._confirm_weapon_detections(
            "camera-a", [self.person], [dict(weapon)])

        self.assertEqual(first[0]["associated_tracking_id"], 7)
        self.assertFalse(first[0]["confirmed"])
        self.assertTrue(second[0]["confirmed"])
        self.assertEqual(second[0]["confirmation_hits"], 2)

    def test_weapon_confirmation_is_isolated_per_camera(self):
        weapon = {
            "class": "Knife",
            "confidence": 0.8,
            "bbox": {"x": 245, "y": 210, "width": 20, "height": 50},
        }

        self.processor._confirm_weapon_detections("camera-a", [self.person], [dict(weapon)])
        result = self.processor._confirm_weapon_detections(
            "camera-b", [self.person], [dict(weapon)])

        self.assertFalse(result[0]["confirmed"])

    def test_camera_cleanup_resets_weapon_confirmation(self):
        weapon = {
            "class": "Gun",
            "confidence": 0.84,
            "bbox": {"x": 245, "y": 210, "width": 24, "height": 18},
        }

        self.processor._confirm_weapon_detections(
            "camera-a", [self.person], [dict(weapon)])
        self.processor._clear_camera_state("camera-a")
        result = self.processor._confirm_weapon_detections(
            "camera-a", [self.person], [dict(weapon)])

        self.assertFalse(result[0]["confirmed"])

    def test_confirmed_weapon_triggers_rule_with_weapon_metadata(self):
        from rules.rule_engine import RuleEngine

        engine = RuleEngine()
        engine.load_default_rules()
        weapon = {
            "class": "Gun",
            "confidence": 0.86,
            "confirmed": True,
            "associated_tracking_id": 7,
            "bbox": {"x": 245, "y": 210, "width": 24, "height": 18},
        }

        alert = engine.evaluate(
            [self.person], [], None, None, "camera-a", [weapon])

        self.assertIsNotNone(alert)
        self.assertEqual(alert["rule_id"], "weapon_detected")
        self.assertEqual(alert["weapon"]["class"], "Gun")

class TrackerTests(unittest.TestCase):
    def test_each_detection_gets_a_distinct_track(self):
        from tracking.tracker import ObjectTracker

        tracker = ObjectTracker()
        tracker.update([{
            "class": "person",
            "confidence": 0.9,
            "bbox": {"x": 100, "y": 100, "width": 50, "height": 100},
        }])
        tracked = tracker.update([
            {
                "class": "person",
                "confidence": 0.9,
                "bbox": {"x": 105, "y": 100, "width": 50, "height": 100},
            },
            {
                "class": "person",
                "confidence": 0.9,
                "bbox": {"x": 115, "y": 100, "width": 50, "height": 100},
            },
        ])

        self.assertNotEqual(tracked[0]["tracking_id"], tracked[1]["tracking_id"])


class RuntimeTests(unittest.TestCase):
    def test_auto_selects_cuda_and_gpu_cadence(self):
        import config
        from runtime import InferenceRuntime

        fake_cuda = SimpleNamespace(
            is_available=lambda: True,
            device_count=lambda: 1,
            get_device_name=lambda index: "Test GPU",
        )
        with patch.dict(sys.modules, {"torch": SimpleNamespace(cuda=fake_cuda)}), \
                patch.object(config, "INFERENCE_FPS", 0):
            runtime = InferenceRuntime("auto")

        self.assertEqual(runtime.device, "cuda:0")
        self.assertEqual(runtime.gpu_name, "Test GPU")
        self.assertEqual(runtime.get_object_fps(), 10)

    def test_auto_falls_back_to_cpu(self):
        import config
        from runtime import InferenceRuntime

        fake_cuda = SimpleNamespace(
            is_available=lambda: False,
            device_count=lambda: 0,
        )
        with patch.dict(sys.modules, {"torch": SimpleNamespace(cuda=fake_cuda)}), \
                patch.object(config, "INFERENCE_FPS", 0):
            runtime = InferenceRuntime("auto")

        self.assertEqual(runtime.device, "cpu")
        self.assertEqual(runtime.get_object_fps(), 5)

    def test_component_fallback_does_not_disable_other_gpu_models(self):
        import config
        from runtime import InferenceRuntime

        fake_cuda = SimpleNamespace(
            is_available=lambda: True,
            device_count=lambda: 1,
            get_device_name=lambda index: "Test GPU",
        )
        with patch.dict(sys.modules, {"torch": SimpleNamespace(cuda=fake_cuda)}), \
                patch.object(config, "INFERENCE_FPS", 0), \
                patch.object(config, "WEAPON_INFERENCE_FPS", 0):
            runtime = InferenceRuntime("auto")
            runtime.report_component("objects", "cuda:0")
            runtime.fallback_to_cpu("weapons", RuntimeError("test failure"))

            self.assertEqual(runtime.device, "cuda:0")
            self.assertEqual(runtime.get_object_fps(), 10)
            self.assertEqual(runtime.get_weapon_fps(), 5)

    def test_explicit_cuda_request_reports_cpu_fallback(self):
        from runtime import InferenceRuntime

        fake_cuda = SimpleNamespace(
            is_available=lambda: False,
            device_count=lambda: 0,
        )
        with patch.dict(sys.modules, {"torch": SimpleNamespace(cuda=fake_cuda)}):
            runtime = InferenceRuntime("cuda")

        self.assertEqual(runtime.device, "cpu")
        self.assertTrue(runtime.get_status()["errors"])

    def test_auto_selects_apple_mps(self):
        import config
        from runtime import InferenceRuntime

        fake_cuda = SimpleNamespace(is_available=lambda: False, device_count=lambda: 0)
        fake_mps = SimpleNamespace(is_available=lambda: True)
        fake_torch = SimpleNamespace(
            cuda=fake_cuda,
            backends=SimpleNamespace(mps=fake_mps),
        )
        with patch.dict(sys.modules, {"torch": fake_torch}), \
                patch.object(config, "INFERENCE_FPS", 0):
            runtime = InferenceRuntime("auto")

        self.assertEqual(runtime.device, "mps")
        self.assertEqual(runtime.get_object_fps(), 10)

    def test_onnx_uses_directml_when_it_is_the_available_accelerator(self):
        import config
        from runtime import InferenceRuntime

        fake_cuda = SimpleNamespace(is_available=lambda: False, device_count=lambda: 0)
        fake_torch = SimpleNamespace(cuda=fake_cuda)
        fake_ort = SimpleNamespace(
            get_available_providers=lambda: ["DmlExecutionProvider", "CPUExecutionProvider"])
        with patch.dict(sys.modules, {"torch": fake_torch, "onnxruntime": fake_ort}), \
                patch.object(config, "AI_ONNX_PROVIDER", "auto"):
            runtime = InferenceRuntime("auto")
            providers = runtime.get_onnx_providers()

        self.assertEqual(providers[0], "DmlExecutionProvider")

    def test_explicit_cpu_disables_onnx_accelerators(self):
        import config
        from runtime import InferenceRuntime

        fake_cuda = SimpleNamespace(is_available=lambda: False, device_count=lambda: 0)
        fake_torch = SimpleNamespace(cuda=fake_cuda)
        fake_ort = SimpleNamespace(
            get_available_providers=lambda: ["DmlExecutionProvider", "CPUExecutionProvider"])
        with patch.dict(sys.modules, {"torch": fake_torch, "onnxruntime": fake_ort}), \
                patch.object(config, "AI_ONNX_PROVIDER", "auto"):
            runtime = InferenceRuntime("cpu")
            providers = runtime.get_onnx_providers()

        self.assertEqual(providers, ["CPUExecutionProvider"])

    def test_latency_tracker_reports_percentiles(self):
        from runtime import LatencyTracker

        latency = LatencyTracker()
        for sample in (10, 20, 30, 40, 50):
            latency.record(sample)
        result = latency.snapshot()

        self.assertEqual(result["count"], 5)
        self.assertEqual(result["last_ms"], 50)
        self.assertEqual(result["p50_ms"], 30)

    def test_insightface_keeps_accelerated_provider_contexts_enabled(self):
        from recognition.face_recognizer import FaceRecognizer

        recognizer = FaceRecognizer()

        self.assertEqual(recognizer._provider_context_id(["CPUExecutionProvider"]), -1)
        self.assertEqual(recognizer._provider_context_id(["DmlExecutionProvider"]), 0)
        self.assertEqual(recognizer._provider_context_id(["ROCMExecutionProvider"]), 0)
        self.assertEqual(recognizer._provider_context_id(["CoreMLExecutionProvider"]), 0)


if __name__ == "__main__":
    unittest.main()
