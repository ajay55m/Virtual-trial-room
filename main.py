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


def draw_hud(frame: np.ndarray, garment: dict, current_idx: int, total_garments: int, height_cm: float, mode: str) -> None:
    """Render top header bar, user height, and navigation controls on frame."""
    h, w = frame.shape[:2]
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, 64), (17, 24, 39), -1)
    cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)

    title = f"{garment['brand']} - {garment['name']} [{garment['category']}] ({current_idx + 1}/{total_garments})"
    cv2.putText(frame, title, (20, 38), cv2.FONT_HERSHEY_SIMPLEX, 0.70, (255, 255, 255), 2, cv2.LINE_AA)

    # Mode and Height badge
    badge = f"Mode: {mode.upper()} | User Height: {height_cm:.0f}cm"
    cv2.putText(frame, badge, (w - 380, 38), cv2.FONT_HERSHEY_SIMPLEX, 0.60, (140, 240, 160), 2, cv2.LINE_AA)

    # Controls footer banner
    footer_text = "[N] Next  [P] Prev  [C] Category  [Q] Quit"
    cv2.rectangle(overlay, (0, h - 36), (w, h), (17, 24, 39), -1)
    cv2.addWeighted(overlay, 0.65, frame, 0.35, 0, frame)
    cv2.putText(frame, footer_text, (20, h - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 220, 255), 1, cv2.LINE_AA)


def run_photo_mode(image_path: str, user_height_cm: float):
    """Run Virtual Trial Room on an uploaded static person photo."""
    if not os.path.exists(image_path):
        print(f"[!] Error: Image file '{image_path}' not found.")
        return

    base_frame = cv2.imread(image_path)
    if base_frame is None:
        print(f"[!] Error: Failed to decode image '{image_path}'.")
        return

    current_index = 0
    window_name = "AURA Virtual Trial Room [PHOTO MODE]"

    while True:
        display_frame = base_frame.copy()
        garment = GARMENTS[current_index]
        draw_hud(display_frame, garment, current_index, len(GARMENTS), user_height_cm, mode="Photo Upload")

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

    cv2.destroyAllWindows()


def run_camera_mode(user_height_cm: float):
    """Run Virtual Trial Room in real-time on live camera feed."""
    current_index = 0
    cap = cv2.VideoCapture(0)
    window_name = "AURA Virtual Trial Room [LIVE CAMERA]"

    if not cap.isOpened():
        print("[!] Warning: Could not open camera 0. Falling back to synthetic canvas.")
        frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        while True:
            display_frame = frame.copy()
            garment = GARMENTS[current_index]
            draw_hud(display_frame, garment, current_index, len(GARMENTS), user_height_cm, mode="Camera Fallback")
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
        cv2.destroyAllWindows()
        return

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        garment = GARMENTS[current_index]
        draw_hud(frame, garment, current_index, len(GARMENTS), user_height_cm, mode="Live Camera")

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

    cap.release()
    cv2.destroyAllWindows()


def parse_args():
    parser = argparse.ArgumentParser(description="AI Powered Virtual Trial Room")
    parser.add_argument("--image", type=str, default=None, help="Path to static person photo for try-on")
    parser.add_argument("--height", type=float, default=None, help="User height in centimeters (e.g., 170)")
    return parser.parse_args()


def main():
    args = parse_args()

    # User height input: mandatory for anatomical centimeter sizing
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
