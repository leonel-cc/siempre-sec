import threading
import math
import os
import sys
from collections import deque
from typing import Dict, Optional

import config


class LatencyTracker:
    def __init__(self, max_samples: int = 300):
        self._samples = deque(maxlen=max_samples)
        self._lock = threading.Lock()

    def record(self, elapsed_ms: float):
        with self._lock:
            self._samples.append(float(elapsed_ms))

    def snapshot(self) -> Dict:
        with self._lock:
            samples = list(self._samples)
        if not samples:
            return {"count": 0, "last_ms": None, "avg_ms": None, "p50_ms": None, "p95_ms": None}
        ordered = sorted(samples)
        return {
            "count": len(samples),
            "last_ms": round(samples[-1], 2),
            "avg_ms": round(sum(samples) / len(samples), 2),
            "p50_ms": round(ordered[int((len(ordered) - 1) * 0.50)], 2),
            "p95_ms": round(ordered[int((len(ordered) - 1) * 0.95)], 2),
        }

    def clear(self):
        with self._lock:
            self._samples.clear()


class InferenceRuntime:
    def __init__(self, preference: Optional[str] = None):
        self.requested = (preference or config.AI_DEVICE).strip().lower()
        if self.requested not in ("auto", "cpu", "cuda", "mps", "xpu"):
            raise ValueError("AI_DEVICE must be one of: auto, cpu, cuda, mps, xpu")
        self._lock = threading.Lock()
        self.components: Dict[str, Dict] = {}
        self.errors = []
        self.cuda_available = False
        self.cuda_device_count = 0
        self.gpu_name = None
        self.device = "cpu"
        self.backend = "cpu"
        self._dll_handles = []
        self._detect_device()

    def _detect_device(self):
        try:
            import torch

            self.cuda_available = bool(torch.cuda.is_available())
            self.cuda_device_count = torch.cuda.device_count() if self.cuda_available else 0
            if self.cuda_available:
                index = config.AI_CUDA_DEVICE
                if index < 0 or index >= self.cuda_device_count:
                    self.errors.append(
                        f"CUDA device {index} is invalid; available devices: {self.cuda_device_count}")
                else:
                    self.gpu_name = torch.cuda.get_device_name(index)
                    if self.requested in ("auto", "cuda"):
                        self.device = f"cuda:{index}"
                        self.backend = "rocm" if getattr(
                            getattr(torch, "version", None), "hip", None) else "cuda"
            if self.device == "cpu" and self.requested in ("auto", "mps"):
                mps = getattr(getattr(torch, "backends", None), "mps", None)
                if mps is not None and mps.is_available():
                    self.device = "mps"
                    self.backend = "mps"
                    self.gpu_name = "Apple Metal"
            if self.device == "cpu" and self.requested in ("auto", "xpu"):
                xpu = getattr(torch, "xpu", None)
                if xpu is not None and xpu.is_available():
                    self.device = f"xpu:{config.AI_CUDA_DEVICE}"
                    self.backend = "xpu"
                    self.gpu_name = xpu.get_device_name(config.AI_CUDA_DEVICE)
            if self.requested == "cuda" and not self.cuda_available:
                self.errors.append("CUDA requested but unavailable; using CPU")
            if self.requested in ("mps", "xpu") and self.device == "cpu":
                self.errors.append(f"{self.requested.upper()} requested but unavailable; using CPU")
        except Exception as exc:
            self.errors.append(f"CUDA detection failed: {exc}")

    @property
    def is_cuda(self) -> bool:
        return self.device.startswith("cuda")

    def get_object_fps(self) -> float:
        if config.INFERENCE_FPS > 0:
            return config.INFERENCE_FPS
        return self._profile_fps(
            "objects", config.GPU_INFERENCE_FPS, config.CPU_INFERENCE_FPS)

    def get_weapon_fps(self) -> float:
        if config.WEAPON_INFERENCE_FPS > 0:
            return config.WEAPON_INFERENCE_FPS
        return self._profile_fps(
            "weapons", config.GPU_WEAPON_INFERENCE_FPS, config.CPU_WEAPON_INFERENCE_FPS)

    def _profile_fps(self, component: str, gpu_fps: float, cpu_fps: float) -> float:
        for name, value in (("GPU FPS", gpu_fps), ("CPU FPS", cpu_fps)):
            if not math.isfinite(value) or value <= 0:
                raise ValueError(f"{name} must be a positive finite number")
        device = self.get_component_device(component)
        return gpu_fps if device != "cpu" else cpu_fps

    def get_onnx_providers(self):
        self._prepare_windows_cuda_dlls()
        try:
            import onnxruntime

            available = onnxruntime.get_available_providers()
        except Exception as exc:
            self.errors.append(f"ONNX Runtime provider detection failed: {exc}")
            return ["CPUExecutionProvider"]
        requested = config.AI_ONNX_PROVIDER.strip()
        if self.requested == "cpu" and requested.lower() == "auto":
            return ["CPUExecutionProvider"]
        if requested.lower() != "auto":
            if requested not in available:
                self.errors.append(f"ONNX provider {requested} unavailable; using CPU")
                return ["CPUExecutionProvider"]
            return [requested, "CPUExecutionProvider"] if requested != "CPUExecutionProvider" else [requested]

        provider_preferences = {
            "cuda": ["CUDAExecutionProvider"],
            "rocm": ["ROCMExecutionProvider", "MIGraphXExecutionProvider"],
            "mps": ["CoreMLExecutionProvider"],
            "xpu": ["OpenVINOExecutionProvider"],
            "cpu": ["DmlExecutionProvider", "OpenVINOExecutionProvider", "CoreMLExecutionProvider"],
        }
        ordered_providers = provider_preferences.get(self.backend, []) + [
            "DmlExecutionProvider", "OpenVINOExecutionProvider",
            "CoreMLExecutionProvider", "ROCMExecutionProvider",
            "MIGraphXExecutionProvider", "CUDAExecutionProvider",
        ]
        for provider in dict.fromkeys(ordered_providers):
            if provider in available:
                return [provider, "CPUExecutionProvider"]
        if self.backend != "cpu":
            self.errors.append(
                f"ONNX accelerator for {self.backend} unavailable; face recognition uses CPU")
        return ["CPUExecutionProvider"]

    def _prepare_windows_cuda_dlls(self):
        if sys.platform != "win32" or self.backend != "cuda":
            return
        try:
            import torch

            torch_lib = os.path.join(os.path.dirname(torch.__file__), "lib")
            if os.path.isdir(torch_lib):
                os.environ["PATH"] = torch_lib + os.pathsep + os.environ.get("PATH", "")
                if hasattr(os, "add_dll_directory"):
                    self._dll_handles.append(os.add_dll_directory(torch_lib))
        except Exception as exc:
            self.errors.append(f"Could not preload CUDA DLL directory: {exc}")

    def get_onnx_provider_options(self, providers):
        options = []
        for provider in providers:
            if provider in (
                "CUDAExecutionProvider", "ROCMExecutionProvider",
                "MIGraphXExecutionProvider", "DmlExecutionProvider",
            ):
                options.append({"device_id": str(config.AI_CUDA_DEVICE)})
            elif provider == "OpenVINOExecutionProvider":
                device = "GPU" if config.AI_CUDA_DEVICE == 0 else f"GPU.{config.AI_CUDA_DEVICE}"
                options.append({"device_type": device})
            else:
                options.append({})
        return options

    def report_component(self, name: str, device: str, error: Optional[str] = None):
        with self._lock:
            self.components[name] = {"device": device, "error": error}

    def get_component_device(self, name: str) -> str:
        with self._lock:
            return self.components.get(name, {}).get("device", self.device)

    def fallback_to_cpu(self, component: str, error: Exception):
        message = f"{component} accelerator failure; using CPU: {error}"
        with self._lock:
            self.errors.append(message)
            self.components[component] = {"device": "cpu", "error": str(error)}
        print(message)

    def get_status(self) -> Dict:
        with self._lock:
            components = dict(self.components)
            errors = list(dict.fromkeys(self.errors))
            device = self.device
            requested = self.requested
            cuda_available = self.cuda_available
            cuda_device_count = self.cuda_device_count
            gpu_name = self.gpu_name
        return {
            "requested": requested,
            "device": device,
            "backend": self.backend,
            "cuda_available": cuda_available,
            "cuda_device_count": cuda_device_count,
            "gpu_name": gpu_name,
            "components": components,
            "object_inference_fps": self.get_object_fps(),
            "weapon_inference_fps": self.get_weapon_fps(),
            "errors": errors,
        }
