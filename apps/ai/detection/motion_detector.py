import cv2
import numpy as np
from typing import Optional, Tuple


class MotionDetector:
    def __init__(self, sensitivity: float = 0.5, min_area: int = 500):
        self.sensitivity = sensitivity
        self.min_area = min_area
        self.background_subtractor = cv2.createBackgroundSubtractorMOG2(
            history=500,
            varThreshold=int(50 * (1 - max(0.0, min(1.0, sensitivity))) + 10),
            detectShadows=True,
        )
        self.kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))

    def detect(self, frame: np.ndarray) -> Tuple[bool, Optional[np.ndarray]]:
        fg_mask = self.background_subtractor.apply(frame)

        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, self.kernel)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, self.kernel)

        contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        motion_detected = False
        motion_regions = []

        for contour in contours:
            area = cv2.contourArea(contour)
            if area > self.min_area:
                motion_detected = True
                x, y, w, h = cv2.boundingRect(contour)
                motion_regions.append((x, y, w, h))

        overlay = None
        if motion_detected and motion_regions:
            overlay = frame.copy()
            for (x, y, w, h) in motion_regions:
                cv2.rectangle(overlay, (x, y), (x + w, y + h), (0, 0, 255), 2)

        return motion_detected, overlay

    def update_sensitivity(self, sensitivity: float):
        self.sensitivity = max(0.0, min(1.0, sensitivity))
        threshold = int(50 * (1 - sensitivity) + 10)
        self.background_subtractor.setVarThreshold(threshold)
