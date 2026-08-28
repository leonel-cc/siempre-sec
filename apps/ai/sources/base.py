from abc import ABC, abstractmethod
from enum import Enum
from typing import Optional, Callable
import numpy as np
import time
import threading


class SourceStatus(Enum):
    IDLE = 'IDLE'
    CONNECTING = 'CONNECTING'
    STREAMING = 'STREAMING'
    RECONNECTING = 'RECONNECTING'
    ERROR = 'ERROR'
    STOPPED = 'STOPPED'


class VideoSource(ABC):
    def __init__(self, source_id: str, target_fps: int = 30):
        self.source_id = source_id
        self.target_fps = target_fps
        self.status = SourceStatus.IDLE
        self._frame_callback: Optional[Callable] = None
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._current_frame: Optional[np.ndarray] = None
        self._frame_count = 0
        self._actual_fps = 0.0
        self._last_fps_time = time.time()
        self._last_fps_count = 0
        self._error_count = 0
        self._max_reconnect_attempts = 10
        self._reconnect_delay = 1.0

    def set_frame_callback(self, callback: Callable[[str, np.ndarray], None]):
        self._frame_callback = callback

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        self.status = SourceStatus.STOPPED
        if self._thread:
            self._thread.join(timeout=5)

    def _run_loop(self):
        while self._running:
            try:
                self.status = SourceStatus.CONNECTING
                self._connect()
                self.status = SourceStatus.STREAMING
                self._error_count = 0
                self._stream_loop()
            except Exception as e:
                self._error_count += 1
                self.status = SourceStatus.ERROR
                if self._error_count >= self._max_reconnect_attempts:
                    print(f"[{self.source_id}] Max reconnect attempts reached, stopping")
                    break
                self.status = SourceStatus.RECONNECTING
                delay = min(self._reconnect_delay * (2 ** min(self._error_count - 1, 5)), 30)
                print(f"[{self.source_id}] Error: {e}, reconnecting in {delay:.1f}s (attempt {self._error_count})")
                time.sleep(delay)

    def _stream_loop(self):
        frame_interval = 1.0 / self.target_fps
        while self._running and self.status == SourceStatus.STREAMING:
            start = time.time()
            frame = self._read_frame()
            if frame is not None:
                self._current_frame = frame
                self._frame_count += 1
                self._update_fps()
                if self._frame_callback:
                    self._frame_callback(self.source_id, frame)
            elapsed = time.time() - start
            sleep_time = frame_interval - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)

    def _update_fps(self):
        now = time.time()
        elapsed = now - self._last_fps_time
        if elapsed >= 1.0:
            self._actual_fps = (self._frame_count - self._last_fps_count) / elapsed
            self._last_fps_count = self._frame_count
            self._last_fps_time = now

    @abstractmethod
    def _connect(self):
        pass

    @abstractmethod
    def _read_frame(self) -> Optional[np.ndarray]:
        pass

    @abstractmethod
    def _disconnect(self):
        pass

    def get_info(self) -> dict:
        return {
            'source_id': self.source_id,
            'status': self.status.value,
            'fps': round(self._actual_fps, 1),
            'frame_count': self._frame_count,
            'error_count': self._error_count,
        }

    def __del__(self):
        self.stop()
