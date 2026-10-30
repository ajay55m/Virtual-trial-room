"""
AI Powered Virtual Trial Room
Modular Monolith Architecture - Single Entry Point (main.py)
"""

import os
import sys
import argparse
import cv2
import numpy as np
from PIL import Image

# MediaPipe Pose Integration
try:
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision as mp_vision
    MP_AVAILABLE = True
except ImportError:
    MP_AVAILABLE = False


# -----------------------------------------------------------------------------
# 1. Garment Catalog Layer
# -----------------------------------------------------------------------------
GARMENTS = [
    {"name": "Zara Slim Shirt", "brand": "Zara", "category": "Shirt", "file": "1.png", "type": "upper"},
    {"name": "Levis T-Shirt", "brand": "Levis", "category": "T-Shirt", "file": "2.png", "type": "upper"},
    {"name": "H&M Women Top", "brand": "H&M", "category": "Tops", "file": "3.png", "type": "upper"},
    {"name": "Biba Kurti", "brand": "Biba", "category": "Kurti", "file": "4.png", "type": "long_upper"},
    {"name": "Banarasi Saree", "brand": "Manyavar", "category": "Saree", "file": "5.png", "type": "saree"},
]

SEARCH_DIRS = ["assets/shirts", "Shirts", "Resources/Shirts", "."]
_garment_cache = {}


def find_garment_path(filename: str) -> str:
    """Locate transparent garment PNG within registered asset directories."""
    for folder in SEARCH_DIRS:
        candidate = os.path.join(folder, filename)
        if os.path.exists(candidate):
            return candidate
    return filename


def load_garment_image(filename: str) -> np.ndarray:
    """Load transparent RGBA garment PNG from disk with caching."""
    if filename in _garment_cache:
        return _garment_cache[filename]

    filepath = find_garment_path(filename)
    img_rgba = cv2.imread(filepath, cv2.IMREAD_UNCHANGED)

    if img_rgba is None:
        img_rgba = np.zeros((600, 600, 4), dtype=np.uint8)
        cv2.rectangle(img_rgba, (120, 100), (480, 560), (230, 230, 230, 255), -1)
        cv2.putText(img_rgba, filename, (160, 320), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (40, 40, 40, 255), 2)
    elif img_rgba.ndim == 3 and img_rgba.shape[2] == 3:
        b, g, r = cv2.split(img_rgba)
        a = np.full(b.shape, 255, dtype=np.uint8)
        img_rgba = cv2.merge([b, g, r, a])

    _garment_cache[filename] = img_rgba
    return img_rgba


def get_next_category_index(current_idx: int) -> int:
    """Find index of next garment belonging to a different category."""
    curr_cat = GARMENTS[current_idx]["category"]
    n = len(GARMENTS)
    for i in range(1, n):
        candidate_idx = (current_idx + i) % n
        if GARMENTS[candidate_idx]["category"] != curr_cat:
            return candidate_idx
    return (current_idx + 1) % n


# -----------------------------------------------------------------------------
# 2. Body Analysis & MediaPipe Pose Layer
# -----------------------------------------------------------------------------
class PoseDetector:
    """Initializes and runs MediaPipe Pose Landmark detection."""
    def __init__(self):
        self.detector = None
        if not MP_AVAILABLE:
            return

        # Model resolution
        model_paths = [
            "frontend/public/models/pose_landmarker_lite.task",
            os.path.join(os.path.dirname(__file__), "frontend/public/models/pose_landmarker_lite.task"),
            "pose_landmarker_lite.task"
        ]
        resolved_path = None
        for p in model_paths:
            if os.path.exists(p):
                resolved_path = os.path.abspath(p)
                break

        if resolved_path:
            try:
                base_options = mp_python.BaseOptions(model_asset_path=resolved_path)
                options = mp_vision.PoseLandmarkerOptions(
                    base_options=base_options,
                    running_mode=mp_vision.RunningMode.IMAGE,
                    num_poses=1,
                    min_pose_detection_confidence=0.5
                )
                self.detector = mp_vision.PoseLandmarker.create_from_options(options)
            except Exception as e:
                print(f"[!] Warning: MediaPipe Pose initialization error: {e}")

    def detect(self, bgr_frame: np.ndarray):
        """Processes BGR frame and returns 33 pose landmarks if detected."""
        if self.detector is None:
            return None
        try:
            rgb_frame = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            detection_result = self.detector.detect(mp_image)
            if detection_result.pose_landmarks and len(detection_result.pose_landmarks) > 0:
                return detection_result.pose_landmarks[0]
        except Exception as e:
            pass
        return None


# -----------------------------------------------------------------------------
# 3. Size Estimation Layer
# -----------------------------------------------------------------------------
def analyze_size(landmarks, img_h: int, img_w: int, user_height_cm: float, category: str = "Shirt"):
    """
    Analyzes body landmarks, calculates human proportions, and estimates garment size.
    """
    # Head landmark (0: nose)
    head_y = landmarks[0].y * img_h
    # Ankle landmarks (27: right, 28: left)
    ankle_y = max(landmarks[27].y, landmarks[28].y) * img_h
    person_height_px = max(60.0, abs(ankle_y - head_y))

    # Real-world scale factor (cm per pixel)
    scale = user_height_cm / person_height_px

    # Distance between shoulders (11: right shoulder, 12: left shoulder)
    dx_sh = (landmarks[12].x - landmarks[11].x) * img_w
    dy_sh = (landmarks[12].y - landmarks[11].y) * img_h
    shoulder_cm = np.hypot(dx_sh, dy_sh) * scale

    # Approximate chest circumference
    chest_cm = shoulder_cm * 2.3

    # Distance between hips (23: right hip, 24: left hip)
    dx_w = (landmarks[24].x - landmarks[23].x) * img_w
    dy_w = (landmarks[24].y - landmarks[23].y) * img_h
    waist_cm = np.hypot(dx_w, dy_w) * scale * 2.1

    # Standard size classification: Chest <91=S, <97=M, <102=L, <107=XL, else XXL
    if chest_cm < 91:
        size_label = "S"
    elif chest_cm < 97:
        size_label = "M"
    elif chest_cm < 102:
        size_label = "L"
    elif chest_cm < 107:
        size_label = "XL"
    else:
        size_label = "XXL"

    # Category specifics:
    # For Kurti/Tops use same chest for Bust size
    # For Saree return Blouse Size: 32, 34, 36, 38, 40
    cat_lower = category.lower()
    if cat_lower == "saree":
        chest_in = chest_cm / 2.54
        if chest_in < 33:
            blouse_size = "32"
        elif chest_in < 35:
            blouse_size = "34"
        elif chest_in < 37:
            blouse_size = "36"
        elif chest_in < 39:
            blouse_size = "38"
        else:
            blouse_size = "40"
        display_size = f"Blouse {blouse_size}"
    elif cat_lower in ["kurti", "tops"]:
        display_size = f"Bust {size_label}"
    else:
        display_size = size_label

    return {
        "size": display_size,
        "standard_size": size_label,
        "shoulder_cm": shoulder_cm,
        "chest_cm": chest_cm,
        "waist_cm": waist_cm,
        "scale": scale
    }


def draw_hud(
    frame: np.ndarray,
    garment: dict,
    current_idx: int,
    total_garments: int,
    height_cm: float,
    mode: str,
    size_info: dict = None,
    show_size: bool = True
) -> None:
    """Render top header bar, user height, size estimation, and navigation controls on frame."""
    h, w = frame.shape[:2]
    overlay = frame.copy()

    # Top Header
    cv2.rectangle(overlay, (0, 0), (w, 64), (17, 24, 39), -1)
    cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)

    title = f"{garment['brand']} - {garment['name']} [{garment['category']}] ({current_idx + 1}/{total_garments})"
    cv2.putText(frame, title, (20, 38), cv2.FONT_HERSHEY_SIMPLEX, 0.70, (255, 255, 255), 2, cv2.LINE_AA)

    badge = f"Mode: {mode.upper()} | Height: {height_cm:.0f}cm"
    cv2.putText(frame, badge, (w - 380, 38), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (140, 240, 160), 2, cv2.LINE_AA)

    # Size Analysis Card Overlay (Press S to toggle)
    if show_size and size_info is not None:
        card_w, card_h = 340, 95
        card_x, card_y = 20, 75
        cv2.rectangle(overlay, (card_x, card_y), (card_x + card_w, card_y + card_h), (30, 41, 59), -1)
        cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)
        cv2.rectangle(frame, (card_x, card_y), (card_x + card_w, card_y + card_h), (59, 130, 246), 2)

        size_text = f"Recommended Size: {size_info['size']}"
        cv2.putText(frame, size_text, (card_x + 15, card_y + 32), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2, cv2.LINE_AA)

        metrics_text = f"Chest: {size_info['chest_cm']:.1f}cm | Waist: {size_info['waist_cm']:.1f}cm"
        cv2.putText(frame, metrics_text, (card_x + 15, card_y + 60), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (203, 213, 225), 1, cv2.LINE_AA)

        sh_text = f"Shoulder: {size_info['shoulder_cm']:.1f}cm (Height: {height_cm:.0f}cm)"
        cv2.putText(frame, sh_text, (card_x + 15, card_y + 82), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (148, 163, 184), 1, cv2.LINE_AA)

    # Controls footer banner
    footer_text = "[N] Next  [P] Prev  [C] Category  [S] Toggle Size  [Q] Quit"
    cv2.rectangle(overlay, (0, h - 36), (w, h), (17, 24, 39), -1)
    cv2.addWeighted(overlay, 0.65, frame, 0.35, 0, frame)
    cv2.putText(frame, footer_text, (20, h - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (200, 220, 255), 1, cv2.LINE_AA)


def run_photo_mode(image_path: str, user_height_cm: float):
    """Run Virtual Trial Room on an uploaded static person photo."""
    if not os.path.exists(image_path):
        print(f"[!] Error: Image file '{image_path}' not found.")
        return

    base_frame = cv2.imread(image_path)
    if base_frame is None:
        print(f"[!] Error: Failed to decode image '{image_path}'.")
        return

    detector = PoseDetector()
    landmarks = detector.detect(base_frame)
    current_index = 0
    show_size = True
    window_name = "AURA Virtual Trial Room [PHOTO MODE]"

    while True:
        display_frame = base_frame.copy()
        garment = GARMENTS[current_index]

        size_info = None
        if landmarks:
            h, w = display_frame.shape[:2]
            size_info = analyze_size(landmarks, h, w, user_height_cm, garment["category"])

        draw_hud(display_frame, garment, current_index, len(GARMENTS), user_height_cm, mode="Photo Upload", size_info=size_info, show_size=show_size)

        cv2.imshow(window_name, display_frame)
        key = cv2.waitKey(30) & 0xFF

        if key in [ord('q'), ord('Q'), 27]:
            break
        elif key in [ord('n'), ord('N')]:
            current_index = (current_index + 1) % len(GARMENTS)
        elif key in [ord('p'), ord('P')]:
            current_index = (current_index - 1) % len(GARMENTS)
        elif key in [ord('c'), ord('C')]:
            current_index = get_next_category_index(current_index)
        elif key in [ord('s'), ord('S')]:
            show_size = not show_size

    cv2.destroyAllWindows()


def run_camera_mode(user_height_cm: float):
    """Run Virtual Trial Room in real-time on live camera feed."""
    detector = PoseDetector()
    current_index = 0
    show_size = True
    cap = cv2.VideoCapture(0)
    window_name = "AURA Virtual Trial Room [LIVE CAMERA]"

    if not cap.isOpened():
        print("[!] Warning: Could not open camera 0. Falling back to synthetic canvas.")
        frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        while True:
            display_frame = frame.copy()
            garment = GARMENTS[current_index]
            draw_hud(display_frame, garment, current_index, len(GARMENTS), user_height_cm, mode="Camera Fallback", show_size=show_size)
            cv2.imshow(window_name, display_frame)
            key = cv2.waitKey(30) & 0xFF
            if key in [ord('q'), ord('Q'), 27]:
                break
            elif key in [ord('n'), ord('N')]:
                current_index = (current_index + 1) % len(GARMENTS)
            elif key in [ord('p'), ord('P')]:
                current_index = (current_index - 1) % len(GARMENTS)
            elif key in [ord('c'), ord('C')]:
                current_index = get_next_category_index(current_index)
            elif key in [ord('s'), ord('S')]:
                show_size = not show_size
        cv2.destroyAllWindows()
        return

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]
        garment = GARMENTS[current_index]

        landmarks = detector.detect(frame)
        size_info = None
        if landmarks:
            size_info = analyze_size(landmarks, h, w, user_height_cm, garment["category"])

        draw_hud(frame, garment, current_index, len(GARMENTS), user_height_cm, mode="Live Camera", size_info=size_info, show_size=show_size)

        cv2.imshow(window_name, frame)
        key = cv2.waitKey(1) & 0xFF

        if key in [ord('q'), ord('Q'), 27]:
            break
        elif key in [ord('n'), ord('N')]:
            current_index = (current_index + 1) % len(GARMENTS)
        elif key in [ord('p'), ord('P')]:
            current_index = (current_index - 1) % len(GARMENTS)
        elif key in [ord('c'), ord('C')]:
            current_index = get_next_category_index(current_index)
        elif key in [ord('s'), ord('S')]:
            show_size = not show_size

    cap.release()
    cv2.destroyAllWindows()


def parse_args():
    parser = argparse.ArgumentParser(description="AI Powered Virtual Trial Room")
    parser.add_argument("--image", type=str, default=None, help="Path to static person photo for try-on")
    parser.add_argument("--height", type=float, default=None, help="User height in centimeters (e.g., 170)")
    return parser.parse_args()


def main():
    args = parse_args()

    if args.height is None:
        try:
            val = input("Enter your height in cm (default 170): ").strip()
            user_height_cm = float(val) if val else 170.0
        except (EOFError, ValueError):
            user_height_cm = 170.0
    else:
        user_height_cm = float(args.height)

    print(f"[*] Virtual Trial Room initialized. User Height: {user_height_cm} cm")

    if args.image:
        print(f"[*] Launching Photo Mode with: {args.image}")
        run_photo_mode(args.image, user_height_cm)
    else:
        print("[*] Launching Live Camera Mode...")
        run_camera_mode(user_height_cm)


if __name__ == "__main__":
    main()
