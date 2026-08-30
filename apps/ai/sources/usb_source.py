import sys
import cv2
from typing import Optional
import numpy as np
from .base import VideoSource


class UsbVideoSource(VideoSource):
    def __init__(self, source_id: str, device_index: int = 0,
                 target_fps: int = 30, width: int = 1280, height: int = 720):
        super().__init__(source_id, target_fps)
        self.device_index = device_index
        self.width = width
        self.height = height
        self._cap: Optional[cv2.VideoCapture] = None

    def _connect(self):
        if sys.platform == 'win32':
            self._cap = cv2.VideoCapture(self.device_index, cv2.CAP_DSHOW)
        else:
            self._cap = cv2.VideoCapture(self.device_index)

        if not self._cap.isOpened():
            raise RuntimeError(f"Cannot open USB camera index {self.device_index}")

        self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self._cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        print(f"[{self.source_id}] Connected to USB camera {self.device_index}")

    def _read_frame(self) -> Optional[np.ndarray]:
        if self._cap is None:
            return None
        ret, frame = self._cap.read()
        if not ret:
            raise RuntimeError("Frame read failed, device may be disconnected")
        return frame

    def _disconnect(self):
        if self._cap:
            self._cap.release()
            self._cap = None

    def get_info(self) -> dict:
        info = super().get_info()
        info.update({
            'type': 'usb',
            'device_index': self.device_index,
            'width': int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH)) if self._cap else 0,
            'height': int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) if self._cap else 0,
        })
        return info
