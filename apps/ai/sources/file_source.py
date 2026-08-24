import cv2
import os
from typing import Optional
import numpy as np
from .base import VideoSource


class FileVideoSource(VideoSource):
    def __init__(self, source_id: str, file_path: str,
                 loop: bool = True, target_fps: int = 25):
        super().__init__(source_id, target_fps)
        self.file_path = file_path
        self.loop = loop
        self._cap: Optional[cv2.VideoCapture] = None

    def _connect(self):
        if not os.path.exists(self.file_path):
            raise FileNotFoundError(f"Video file not found: {self.file_path}")
        self._cap = cv2.VideoCapture(self.file_path)
        if not self._cap.isOpened():
            raise RuntimeError(f"Cannot open video file: {self.file_path}")

        file_fps = self._cap.get(cv2.CAP_PROP_FPS)
        if file_fps > 0:
            self.target_fps = min(int(file_fps), self.target_fps)
        print(f"[{self.source_id}] Connected to file: {self.file_path} (target FPS: {self.target_fps})")

    def _read_frame(self) -> Optional[np.ndarray]:
        if self._cap is None:
            return None
        ret, frame = self._cap.read()
        if not ret:
            if self.loop:
                self._cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = self._cap.read()
                if not ret:
                    return None
            else:
                self.status = self.status.STOPPED
                return None
        return frame

    def _disconnect(self):
        if self._cap:
            self._cap.release()
            self._cap = None

    def get_info(self) -> dict:
        info = super().get_info()
        info.update({
            'type': 'file',
            'file_path': self.file_path,
            'loop': self.loop,
            'total_frames': int(self._cap.get(cv2.CAP_PROP_FRAME_COUNT)) if self._cap else 0,
            'current_frame': int(self._cap.get(cv2.CAP_PROP_POS_FRAMES)) if self._cap else 0,
        })
        return info
