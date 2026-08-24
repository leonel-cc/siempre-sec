import numpy as np
from typing import Optional, Tuple, List
import config


class FaceRecognizer:
    def __init__(self):
        self.app = None
        self.threshold = config.FACE_RECOGNITION_THRESHOLD
        self.known_embeddings: dict = {}

    def load_model(self):
        try:
            import insightface
            from insightface.app import FaceAnalysis

            self.app = FaceAnalysis(
                name="buffalo_l",
                providers=["CPUExecutionProvider"],
            )
            self.app.prepare(ctx_id=0, det_size=(640, 640))
            print("InsightFace model loaded successfully")
        except Exception as e:
            print(f"Failed to load InsightFace: {e}")
            print("Face recognition will be unavailable")

    def register_person(self, person_id: str, embeddings: List[np.ndarray]):
        self.known_embeddings[person_id] = [
            emb / np.linalg.norm(emb) for emb in embeddings
        ]

    def recognize(self, frame: np.ndarray) -> List[dict]:
        if self.app is None:
            return []

        faces = self.app.get(frame)
        results = []

        for face in faces:
            embedding = face.normed_embedding
            best_match = None
            best_score = -1

            for person_id, known_embs in self.known_embeddings.items():
                for known_emb in known_embs:
                    score = float(np.dot(embedding, known_emb))
                    if score > best_score:
                        best_score = score
                        best_match = person_id

            if best_match and best_score >= self.threshold:
                results.append({
                    "person_id": best_match,
                    "confidence": best_score,
                    "bbox": {
                        "x": int(face.bbox[0]),
                        "y": int(face.bbox[1]),
                        "width": int(face.bbox[2] - face.bbox[0]),
                        "height": int(face.bbox[3] - face.bbox[1]),
                    },
                    "is_known": True,
                })
            else:
                results.append({
                    "person_id": None,
                    "confidence": best_score if best_score >= 0 else 0,
                    "bbox": {
                        "x": int(face.bbox[0]),
                        "y": int(face.bbox[1]),
                        "width": int(face.bbox[2] - face.bbox[0]),
                        "height": int(face.bbox[3] - face.bbox[1]),
                    },
                    "is_known": False,
                })

        return results

    def generate_embedding(self, face_image: np.ndarray) -> Optional[np.ndarray]:
        if self.app is None:
            return None

        faces = self.app.get(face_image)
        if faces:
            return faces[0].normed_embedding
        return None
