"""
AI Powered Virtual Trial Room
Modular Monolith Architecture - Single Entry Point (main.py)
"""

import os
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
        # Generate clean fallback RGBA graphic if file is missing
        img_rgba = np.zeros((600, 600, 4), dtype=np.uint8)
        cv2.rectangle(img_rgba, (120, 100), (480, 560), (230, 230, 230, 255), -1)
        cv2.putText(img_rgba, filename, (160, 320), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (40, 40, 40, 255), 2)
    elif img_rgba.ndim == 3 and img_rgba.shape[2] == 3:
        # Convert BGR to BGRA with full opacity if missing alpha
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


def draw_hud(frame: np.ndarray, garment: dict, current_idx: int, total_garments: int) -> None:
    """Render top header bar and navigation controls on frame."""
    h, w = frame.shape[:2]
    # Semi-transparent top bar
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, 64), (17, 24, 39), -1)
    cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)

    # Title & Garment info
    title = f"{garment['brand']} - {garment['name']} [{garment['category']}] ({current_idx + 1}/{total_garments})"
    cv2.putText(frame, title, (20, 38), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2, cv2.LINE_AA)

    # Controls footer banner
    footer_text = "[N] Next  [P] Prev  [C] Category  [Q] Quit"
    cv2.rectangle(overlay, (0, h - 36), (w, h), (17, 24, 39), -1)
    cv2.addWeighted(overlay, 0.65, frame, 0.35, 0, frame)
    cv2.putText(frame, footer_text, (20, h - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 220, 255), 1, cv2.LINE_AA)


def main():
    current_index = 0
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("[!] Warning: Could not open camera 0. Creating synthetic canvas.")
        frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        while True:
            display_frame = frame.copy()
            garment = GARMENTS[current_index]
            draw_hud(display_frame, garment, current_index, len(GARMENTS))
            cv2.imshow("AURA Virtual Trial Room", display_frame)
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
        draw_hud(frame, garment, current_index, len(GARMENTS))

        cv2.imshow("AURA Virtual Trial Room", frame)
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


if __name__ == "__main__":
    main()
