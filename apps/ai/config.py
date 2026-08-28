import os
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")
AI_SERVICE_PORT = int(os.getenv("AI_SERVICE_PORT", "5000"))
AI_SERVICE_HOST = os.getenv("AI_SERVICE_HOST", "0.0.0.0")

YOLO_MODEL = os.getenv("YOLO_MODEL", "yolov8n.pt")
YOLO_CONFIDENCE_THRESHOLD = float(os.getenv("YOLO_CONFIDENCE_THRESHOLD", "0.5"))
INFERENCE_FPS = int(os.getenv("INFERENCE_FPS", "10"))
FACE_RECOGNITION_THRESHOLD = float(os.getenv("FACE_RECOGNITION_THRESHOLD", "0.6"))
MOTION_SENSITIVITY = float(os.getenv("MOTION_SENSITIVITY", "0.5"))

DETECTION_CLASSES = [
    "person", "car", "motorcycle", "bicycle", "dog", "cat", "cell phone",
    "bottle",
]
WEAPON_VETO_CLASSES = {"cell phone", "bottle"}
WEAPON_VETO_CONFIDENCE = float(os.getenv("WEAPON_VETO_CONFIDENCE", "0.10"))

BUFFER_DURATION_SECONDS = int(os.getenv("BUFFER_DURATION_SECONDS", "30"))
PRE_EVENT_SECONDS = int(os.getenv("PRE_EVENT_SECONDS", "15"))
POST_EVENT_SECONDS = int(os.getenv("POST_EVENT_SECONDS", "15"))

EVIDENCE_DIR = os.getenv("EVIDENCE_DIR", "./evidence")
os.makedirs(EVIDENCE_DIR, exist_ok=True)

WEAPON_MODEL = os.getenv("WEAPON_MODEL", "Hadi959/weapon-detection-yolov8")
MODEL_DIR = os.getenv(
    "MODEL_DIR",
    os.path.join(os.path.expanduser("~"), ".security-ai", "models"),
)
os.makedirs(MODEL_DIR, exist_ok=True)
WEAPON_MODEL_PATH = os.getenv("WEAPON_MODEL_PATH", os.path.join(MODEL_DIR, "weapon-best.pt"))
WEAPON_VERIFIER_MODEL = os.getenv(
    "WEAPON_VERIFIER_MODEL", "Subh775/Threat-Detection-YOLOv8n")
WEAPON_VERIFIER_MODEL_PATH = os.getenv(
    "WEAPON_VERIFIER_MODEL_PATH", os.path.join(MODEL_DIR, "weapon-verifier.pt"))
WEAPON_VERIFIER_CONFIDENCE = float(os.getenv("WEAPON_VERIFIER_CONFIDENCE", "0.15"))
WEAPON_CONFIDENCE_THRESHOLD = float(os.getenv("WEAPON_CONFIDENCE_THRESHOLD", "0.30"))
KNIFE_CONFIDENCE_THRESHOLD = float(os.getenv("KNIFE_CONFIDENCE_THRESHOLD", "0.50"))
WEAPON_INFERENCE_SIZE = int(os.getenv("WEAPON_INFERENCE_SIZE", "960"))
WEAPON_ENABLED = os.getenv("WEAPON_ENABLED", "true").lower() == "true"
WEAPON_CONFIRMATIONS = int(os.getenv("WEAPON_CONFIRMATIONS", "2"))
WEAPON_CONFIRMATION_WINDOW = int(os.getenv("WEAPON_CONFIRMATION_WINDOW", "8"))

FACE_COVER_MODEL_URL = os.getenv(
    "FACE_COVER_MODEL_URL",
    "https://raw.githubusercontent.com/STAVAN04/face_covered_or_uncovered_detection/"
    "1791c6e7deee9c1d0092341ceff605eab196687d/best.pt",
)
FACE_COVER_MODEL_PATH = os.getenv(
    "FACE_COVER_MODEL_PATH", os.path.join(MODEL_DIR, "face-cover-best.pt"))
VISIBLE_FACE_MODEL_URL = os.getenv(
    "VISIBLE_FACE_MODEL_URL",
    "https://raw.githubusercontent.com/opencv/opencv_zoo/"
    "f12e12798e8314f7c074a6656816c048dcc95b7a/models/face_detection_yunet/"
    "face_detection_yunet_2023mar.onnx",
)
VISIBLE_FACE_MODEL_PATH = os.getenv(
    "VISIBLE_FACE_MODEL_PATH",
    os.path.join(MODEL_DIR, "face-detection-yunet.onnx"),
)
FACE_COVER_CONFIDENCE_THRESHOLD = float(os.getenv("FACE_COVER_CONFIDENCE_THRESHOLD", "0.50"))
FACE_COVER_ENABLED = os.getenv("FACE_COVER_ENABLED", "true").lower() == "true"
FACE_COVER_CONFIRMATIONS = int(os.getenv("FACE_COVER_CONFIRMATIONS", "5"))
FACE_COVER_CONFIRMATION_WINDOW = int(os.getenv("FACE_COVER_CONFIRMATION_WINDOW", "8"))
THREAT_CLEAR_OBSERVATIONS = int(os.getenv("THREAT_CLEAR_OBSERVATIONS", "50"))
THREAT_MIN_REARM_SECONDS = int(os.getenv("THREAT_MIN_REARM_SECONDS", "60"))

SPEED_WALKING_THRESHOLD = float(os.getenv("SPEED_WALKING_THRESHOLD", "250"))
SPEED_RUNNING_THRESHOLD = float(os.getenv("SPEED_RUNNING_THRESHOLD", "600"))
SPEED_SPRINTING_THRESHOLD = float(os.getenv("SPEED_SPRINTING_THRESHOLD", "900"))
LOITERING_THRESHOLD_SECONDS = float(os.getenv("LOITERING_THRESHOLD_SECONDS", "30"))
TRAJECTORY_ANOMALY_THRESHOLD = float(os.getenv("TRAJECTORY_ANOMALY_THRESHOLD", "0.85"))
FACE_COVERED_MIN_BBOX_HEIGHT = int(os.getenv("FACE_COVERED_MIN_BBOX_HEIGHT", "80"))
PERIMETER_APPROACH_DISTANCE = float(os.getenv("PERIMETER_APPROACH_DISTANCE", "100"))
