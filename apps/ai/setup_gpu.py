#!/usr/bin/env python3
import argparse
import os
import shutil
import subprocess
import sys


DEFAULT_TORCH_INDEX = "https://download.pytorch.org/whl/cu121"
DEFAULT_ORT_INDEX = "https://aiinfra.pkgs.visualstudio.com/PublicPackages/_packaging/onnxruntime-cuda-12/pypi/simple/"
TORCH_VERSION = "2.3.1"
TORCHVISION_VERSION = "0.18.1"


def run(*args):
    print(">", " ".join(args))
    subprocess.check_call(args)


def main():
    parser = argparse.ArgumentParser(description="Install NVIDIA GPU runtimes for Security AI")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Install CUDA wheels even when nvidia-smi is unavailable (useful for bundle builds)",
    )
    args = parser.parse_args()

    if not args.force and shutil.which("nvidia-smi") is None:
        raise SystemExit("No NVIDIA driver detected. Install it first or use --force for packaging.")

    python = sys.executable
    torch_index = os.getenv("PYTORCH_CUDA_INDEX_URL", DEFAULT_TORCH_INDEX)
    ort_index = os.getenv("ONNXRUNTIME_CUDA_INDEX_URL", DEFAULT_ORT_INDEX)
    run(
        python, "-m", "pip", "install", "--upgrade",
        f"torch=={TORCH_VERSION}", f"torchvision=={TORCHVISION_VERSION}",
        "--index-url", torch_index,
    )
    run(
        python, "-m", "pip", "install", "--upgrade", "--force-reinstall",
        "numpy==1.26.4", "scipy==1.14.1", "tifffile==2024.8.30",
        "ml-dtypes==0.5.4", "coloredlogs==15.0.1",
    )
    run(python, "-m", "pip", "uninstall", "-y", "onnxruntime", "onnxruntime-gpu")
    run(
        python, "-m", "pip", "install", "--force-reinstall", "--no-cache-dir",
        "--no-deps", "onnxruntime-gpu==1.18.0", "--index-url", ort_index,
    )

    assertions = "" if args.force else (
        "assert torch.cuda.is_available(); "
        "assert 'CUDAExecutionProvider' in ort.get_available_providers()"
    )
    verify = (
        "import torch, onnxruntime as ort; "
        "print('CUDA available:', torch.cuda.is_available()); "
        "print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none'); "
        "print('ONNX providers:', ort.get_available_providers()); "
        + assertions
    )
    run(python, "-c", verify)


if __name__ == "__main__":
    main()
