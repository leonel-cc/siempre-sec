import numpy as np
import threading
import time
from typing import Optional, Tuple, List
import config
from runtime import InferenceRuntime, LatencyTracker


class FaceRecognizer:
    def __init__(self, runtime: InferenceRuntime = None):
        self.app = None
        self.threshold = config.FACE_RECOGNITION_THRESHOLD
        self.known_embeddings: dict = {}
        self.runtime = runtime or InferenceRuntime()
        self.providers = []
        self.load_error = None
        self.latency = LatencyTracker()
        self._lock = threading.Lock()

    def load_model(self):
        self.providers = self.runtime.get_onnx_providers()
        try:
            self._initialize_app(self.providers)
            device = self._effective_device()
            self.runtime.report_component("faces", device)
            self.load_error = None
            print(f"InsightFace model loaded on {device}")
            return True
        except Exception as e:
            if self.providers and self.providers[0] != "CPUExecutionProvider":
                try:
                    print(f"InsightFace CUDA load failed; using CPU: {e}")
                    self.providers = ["CPUExecutionProvider"]
                    self._initialize_app(self.providers)
                    self.runtime.report_component("faces", "cpu", str(e))
                    self.load_error = None
                    return True
                except Exception as cpu_error:
                    e = cpu_error
            self.load_error = str(e)
            self.runtime.report_component("faces", "unavailable", str(e))
            print(f"Failed to load InsightFace: {e}")
            print("Face recognition will be unavailable")
            return False

    def _initialize_app(self, providers):
        from insightface.app import FaceAnalysis

        provider_options = self.runtime.get_onnx_provider_options(providers)
        app = FaceAnalysis(
            name="buffalo_l",
            providers=providers,
            provider_options=provider_options,
        )
        ctx_id = self._provider_context_id(providers)
        app.prepare(ctx_id=ctx_id, det_size=(640, 640))
        self.app = app

    def _provider_context_id(self, providers) -> int:
        if not providers or providers[0] == "CPUExecutionProvider":
            return -1
        return config.AI_CUDA_DEVICE

    def _effective_device(self) -> str:
        sessions = []
        for model in getattr(self.app, "models", {}).values():
            session = getattr(model, "session", None)
            if session is not None:
                sessions.append(session.get_providers())
        provider_devices = {
            "CUDAExecutionProvider": f"cuda:{config.AI_CUDA_DEVICE}",
            "ROCMExecutionProvider": f"rocm:{config.AI_CUDA_DEVICE}",
            "MIGraphXExecutionProvider": f"rocm:{config.AI_CUDA_DEVICE}",
            "DmlExecutionProvider": f"directml:{config.AI_CUDA_DEVICE}",
            "OpenVINOExecutionProvider": f"openvino:{config.AI_CUDA_DEVICE}",
            "CoreMLExecutionProvider": "coreml",
        }
        first_providers = [p[0] for p in sessions if p]
        if first_providers and len(set(first_providers)) == 1:
            return provider_devices.get(first_providers[0], "cpu")
        if any(provider in provider_devices for provider in first_providers):
            return "mixed"
        return "cpu"

    def register_person(self, person_id: str, embeddings: List[np.ndarray]):
        self.known_embeddings[person_id] = [
            emb / np.linalg.norm(emb) for emb in embeddings
        ]

    def recognize(self, frame: np.ndarray) -> List[dict]:
        if self.app is None:
            return []

        faces = self._get_faces(frame)
        results = []

        for face in faces:
            embedding = face.normed_embedding
            best_match = None
            best_score = -1

            for person_id, known_embs in self.known_embeddings.items():
                for known_emb in known_embs:
                    score = float(np.dot(embedding, known_emb))
                    if score > best_score:
                        best_score = score
                        best_match = person_id

            if best_match and best_score >= self.threshold:
                results.append({
                    "person_id": best_match,
                    "confidence": best_score,
                    "bbox": {
                        "x": int(face.bbox[0]),
                        "y": int(face.bbox[1]),
                        "width": int(face.bbox[2] - face.bbox[0]),
                        "height": int(face.bbox[3] - face.bbox[1]),
                    },
                    "is_known": True,
                })
            else:
                results.append({
                    "person_id": None,
                    "confidence": best_score if best_score >= 0 else 0,
                    "bbox": {
                        "x": int(face.bbox[0]),
                        "y": int(face.bbox[1]),
                        "width": int(face.bbox[2] - face.bbox[0]),
                        "height": int(face.bbox[3] - face.bbox[1]),
                    },
                    "is_known": False,
                })

        return results

    def generate_embedding(self, face_image: np.ndarray) -> Optional[np.ndarray]:
        if self.app is None:
            return None

        faces = self._get_faces(face_image)
        if faces:
            return faces[0].normed_embedding
        return None

    def _get_faces(self, image: np.ndarray):
        started = time.perf_counter()
        try:
            try:
                with self._lock:
                    return self.app.get(image)
            except Exception as exc:
                with self._lock:
                    if not self.providers or self.providers[0] == "CPUExecutionProvider":
                        return self.app.get(image)
                    print(f"InsightFace CUDA failure; using CPU: {exc}")
                    self.providers = ["CPUExecutionProvider"]
                    self._initialize_app(self.providers)
                    self.runtime.report_component("faces", "cpu", str(exc))
                    return self.app.get(image)
        finally:
            self.latency.record((time.perf_counter() - started) * 1000)

    def get_status(self) -> dict:
        return {
            "loaded": self.app is not None,
            "providers": self.providers,
            "device": self.runtime.get_component_device("faces") if self.app is not None else "unavailable",
            "error": self.load_error,
            "latency": self.latency.snapshot(),
        }

    def warmup(self):
        if self.app is None:
            return
        self._get_faces(np.zeros(
            (config.WARMUP_FRAME_HEIGHT, config.WARMUP_FRAME_WIDTH, 3),
            dtype=np.uint8,
        ))
        self.latency.clear()
        print(f"InsightFace warmup complete on {self.runtime.get_component_device('faces')}")
