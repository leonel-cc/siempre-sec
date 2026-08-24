import subprocess
import os
import signal
import threading
from typing import Optional


class FFmpegProcess:
    def __init__(self):
        self._process: Optional[subprocess.Popen] = None
        self._lock = threading.Lock()

    def start_rtsp_server(self, config_path: str = None) -> bool:
        if config_path is None:
            config_path = os.path.join(
                os.path.dirname(__file__), '..', '..', 'services', 'media', 'mediamtx.yml'
            )
        config_path = os.path.abspath(config_path)

        try:
            self._process = subprocess.Popen(
                ['mediamtx', config_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            return True
        except FileNotFoundError:
            print("MediaMTX not found in PATH. Install from: https://github.com/bluenviron/mediamtx")
            return False

    def stop(self):
        with self._lock:
            if self._process and self._process.poll() is None:
                self._process.terminate()
                try:
                    self._process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self._process.kill()
                self._process = None

    @property
    def is_running(self) -> bool:
        return self._process is not None and self._process.poll() is None


class FFmpegTranscoder:
    def __init__(self):
        self._processes = {}

    def transcode_rtsp_to_hls(self, input_url: str, output_path: str,
                               callback=None) -> subprocess.Popen:
        cmd = [
            'ffmpeg', '-i', input_url,
            '-c:v', 'libx264', '-preset', 'ultrafast',
            '-c:a', 'aac',
            '-f', 'hls',
            '-hls_time', '2',
            '-hls_list_size', '5',
            output_path,
        ]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self._processes[input_url] = proc
        return proc

    def capture_frames(self, input_url: str, callback, max_frames: int = 0):
        cmd = [
            'ffmpeg', '-i', input_url,
            '-f', 'rawvideo', '-pix_fmt', 'bgr24',
            '-vf', 'fps=10',
            '-',
        ]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        frame_count = 0
        try:
            width, height = 1280, 720
            frame_size = width * height * 3
            while True:
                raw = proc.stdout.read(frame_size)
                if len(raw) < frame_size:
                    break
                import numpy as np
                frame = np.frombuffer(raw, dtype=np.uint8).reshape((height, width, 3))
                callback(frame)
                frame_count += 1
                if max_frames > 0 and frame_count >= max_frames:
                    break
        finally:
            proc.terminate()

    def stop_all(self):
        for url, proc in self._processes.items():
            if proc.poll() is None:
                proc.terminate()
        self._processes.clear()


def check_ffmpeg() -> bool:
    try:
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, timeout=5)
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def check_mediamtx() -> bool:
    try:
        result = subprocess.run(['mediamtx', '--version'], capture_output=True, timeout=5)
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False
