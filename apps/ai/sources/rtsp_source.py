import cv2
from typing import Optional
import numpy as np
from .base import VideoSource


class RTSPVideoSource(VideoSource):
    def __init__(self, source_id: str, rtsp_url: str,
                 username: str = '', password: str = '',
                 target_fps: int = 25):
        super().__init__(source_id, target_fps)
        self.rtsp_url = rtsp_url
        self.username = username
        self.password = password
        self._cap: Optional[cv2.VideoCapture] = None

    def _build_url(self) -> str:
        if self.username and self.password:
            protocol = 'rtsp://'
            rest = self.rtsp_url.replace('rtsp://', '')
            return f"{protocol}{self.username}:{self.password}@{rest}"
        return self.rtsp_url

    def _connect(self):
        url = self._build_url()
        self._cap = cv2.VideoCapture(url)
        self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if not self._cap.isOpened():
            raise RuntimeError(f"Cannot connect to RTSP stream: {self.rtsp_url}")
        print(f"[{self.source_id}] Connected to RTSP: {self.rtsp_url}")

    def _read_frame(self) -> Optional[np.ndarray]:
        if self._cap is None:
            return None
        ret, frame = self._cap.read()
        if not ret:
            raise RuntimeError("Frame read failed, stream may be disconnected")
        return frame

    def _disconnect(self):
        if self._cap:
            self._cap.release()
            self._cap = None

    def get_info(self) -> dict:
        info = super().get_info()
        info.update({
            'type': 'rtsp',
            'rtsp_url': self.rtsp_url,
            'width': int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH)) if self._cap else 0,
            'height': int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) if self._cap else 0,
        })
        return info
