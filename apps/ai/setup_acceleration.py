#!/usr/bin/env python3
import argparse
import os
import platform
import shutil
import subprocess
import sys


def run(*args):
    print(">", " ".join(args))
    subprocess.check_call(args)


def install_directml():
    python = sys.executable
    run(
        python, "-m", "pip", "install", "--upgrade", "--force-reinstall",
        "numpy==1.26.4", "scipy==1.14.1", "tifffile==2024.8.30",
        "ml-dtypes==0.5.4", "coloredlogs==15.0.1",
    )
    run(
        python, "-m", "pip", "uninstall", "-y",
        "onnxruntime", "onnxruntime-gpu", "onnxruntime-directml",
    )
    run(
        python, "-m", "pip", "install", "--force-reinstall", "--no-deps",
        "onnxruntime-directml==1.20.1",
    )
    run(
        python, "-c",
        "import onnxruntime as ort; print(ort.get_available_providers()); "
        "assert 'DmlExecutionProvider' in ort.get_available_providers()",
    )


def install_cpu():
    python = sys.executable
    run(
        python, "-m", "pip", "install", "--upgrade", "--force-reinstall",
        "torch==2.3.1", "torchvision==0.18.1",
        "--index-url", "https://download.pytorch.org/whl/cpu",
    )
    run(
        python, "-m", "pip", "uninstall", "-y",
        "onnxruntime", "onnxruntime-gpu", "onnxruntime-directml",
    )
    run(python, "-m", "pip", "install", "onnxruntime==1.18.0")


def main():
    parser = argparse.ArgumentParser(description="Configure the best available AI accelerator")
    parser.add_argument("--backend", choices=("auto", "nvidia", "directml", "cpu"), default="auto")
    args = parser.parse_args()
    backend = args.backend

    if backend == "auto":
        if shutil.which("nvidia-smi"):
            backend = "nvidia"
        elif platform.system() == "Windows":
            backend = "directml"
        else:
            backend = "cpu"

    if backend == "nvidia":
        run(sys.executable, os.path.join(os.path.dirname(__file__), "setup_gpu.py"))
    elif backend == "directml":
        install_directml()
        print("DirectML enabled for ONNX models. YOLO uses CPU unless CUDA, ROCm, MPS or XPU is available.")
    else:
        install_cpu()
        print("CPU runtimes installed. Use AI_DEVICE=cpu to force CPU explicitly.")


if __name__ == "__main__":
    main()
