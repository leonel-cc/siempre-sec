# Hardware acceleration

Security AI uses `AI_DEVICE=auto` by default. It selects the best accelerator exposed by the installed runtime and always falls back to CPU per model when necessary.

| Hardware | Object and weapon YOLO | InsightFace |
| --- | --- | --- |
| NVIDIA | CUDA | CUDA Execution Provider |
| AMD on Linux | ROCm through the PyTorch CUDA API | ROCm/MIGraphX when available |
| Apple Silicon | MPS | CoreML when available |
| Intel GPU | PyTorch XPU when installed | OpenVINO when available |
| AMD/Intel/NVIDIA on Windows without CUDA | CPU | DirectML when installed |
| Any unsupported adapter | CPU | CPU |

DirectML currently accelerates ONNX models such as InsightFace. YOLO requires a PyTorch-supported backend (CUDA/ROCm, MPS or XPU) and otherwise uses CPU.

## Local development

Automatic setup on Windows selects NVIDIA when present and DirectML otherwise:

```bash
cd apps/ai
python setup_acceleration.py
```

To select explicitly, use `--backend nvidia`, `--backend directml` or `--backend cpu`.

Verify `/health`: `runtime.device` should be `cuda:0`, and the object and weapon components should report CUDA. InsightFace uses CUDA when `CUDAExecutionProvider` is available and otherwise falls back to CPU.

## Docker

Install the NVIDIA Container Toolkit, then run Compose with the GPU override:

```bash
docker compose -f infrastructure/docker/docker-compose.yml -f infrastructure/docker/docker-compose.gpu.yml up --build
```

## Windows bundle

Build a GPU-capable frozen service with:

```powershell
$env:AI_BUNDLE_GPU="true"
npm run build:bundle
```

CUDA builds are substantially larger than CPU builds. The application still falls back to CPU if CUDA initialization fails.

## Configuration

- `AI_DEVICE=auto|cuda|mps|xpu|cpu`
- `AI_CUDA_DEVICE=0`
- `AI_ONNX_PROVIDER=auto` can be replaced with an installed provider such as `CUDAExecutionProvider`, `DmlExecutionProvider`, `OpenVINOExecutionProvider` or `CoreMLExecutionProvider`.
- `INFERENCE_FPS=0` enables adaptive cadence.
- `CPU_INFERENCE_FPS=5`
- `GPU_INFERENCE_FPS=10`
- `WEAPON_INFERENCE_FPS=0` enables adaptive cadence.
- `CPU_WEAPON_INFERENCE_FPS=5`
- `GPU_WEAPON_INFERENCE_FPS=10`

Use `/stats` to inspect pipeline and per-model latency (`last`, average, p50 and p95).
