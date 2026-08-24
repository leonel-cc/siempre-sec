from typing import List, Dict
import config


class WeaponDetector:
    def __init__(self):
        self.model = None

    def load_model(self):
        if not config.WEAPON_ENABLED:
            print("Weapon detection disabled via config")
            return
        try:
            from ultralytics import YOLO
            from huggingface_hub import hf_hub_download
            model_path = hf_hub_download(
                repo_id=config.WEAPON_MODEL,
                filename="best.pt",
            )
            self.model = YOLO(model_path)
            print(f"Weapon model loaded: {config.WEAPON_MODEL}")
        except Exception as e:
            print(f"Failed to load weapon model: {e}")
            self.model = None

    def detect(self, frame, confidence: float = None) -> List[Dict]:
        if self.model is None:
            return []
        if confidence is None:
            confidence = config.WEAPON_CONFIDENCE_THRESHOLD
        results = self.model(frame, verbose=False)
        detections = []
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                if conf < confidence:
                    continue
                xyxy = box.xyxy[0].tolist()
                class_name = self.model.names.get(cls_id, f"class_{cls_id}")
                detections.append({
                    "class": class_name,
                    "confidence": conf,
                    "bbox": {
                        "x": int(xyxy[0]),
                        "y": int(xyxy[1]),
                        "width": int(xyxy[2] - xyxy[0]),
                        "height": int(xyxy[3] - xyxy[1]),
                    },
                })
        return detections
