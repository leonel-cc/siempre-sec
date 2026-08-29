import cv2
import time
import threading
from collections import deque
from typing import Optional
import config


class VideoBuffer:
    def __init__(self, duration_seconds: int = None, fps: int = 25):
        self.duration = duration_seconds or config.BUFFER_DURATION_SECONDS
        self.fps = fps
        self.max_frames = self.duration * fps
        self.buffers: dict = {}
        self.lock = threading.Lock()

    def create_buffer(self, camera_id: str):
        with self.lock:
            self.buffers[camera_id] = deque(maxlen=self.max_frames)

    def add_frame(self, camera_id: str, frame):
        with self.lock:
            if camera_id not in self.buffers:
                self.buffers[camera_id] = deque(maxlen=self.max_frames)
            self.buffers[camera_id].append((time.time(), frame.copy()))

    def get_pre_event_frames(self, camera_id: str, seconds: int = None):
        seconds = seconds or config.PRE_EVENT_SECONDS
        with self.lock:
            if camera_id not in self.buffers:
                return []

            buffer = self.buffers[camera_id]
            cutoff = time.time() - seconds
            frames = [f for t, f in buffer if t >= cutoff]
            return frames

    def save_clip(
        self,
        camera_id: str,
        event_timestamp: float,
        output_path: str,
        pre_seconds: int = None,
        post_seconds: int = None,
    ) -> bool:
        pre_seconds = pre_seconds or config.PRE_EVENT_SECONDS
        post_seconds = post_seconds or config.POST_EVENT_SECONDS

        with self.lock:
            if camera_id not in self.buffers:
                return False

            buffer = list(self.buffers[camera_id])

        pre_cutoff = event_timestamp - pre_seconds
        post_cutoff = event_timestamp + post_seconds

        pre_frames = [f for t, f in buffer if pre_cutoff <= t <= event_timestamp]
        post_frames = [f for t, f in buffer if event_timestamp < t <= post_cutoff]

        all_frames = pre_frames + post_frames

        if not all_frames:
            return False

        height, width = all_frames[0].shape[:2]
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(output_path, fourcc, self.fps, (width, height))

        for frame in all_frames:
            writer.write(frame)

        writer.release()
        return True

    def clear_buffer(self, camera_id: str):
        with self.lock:
            if camera_id in self.buffers:
                self.buffers[camera_id].clear()

    def get_buffer_info(self) -> dict:
        with self.lock:
            return {
                cam_id: len(buf)
                for cam_id, buf in self.buffers.items()
            }
