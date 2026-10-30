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
    head_y = landmarks[0].y * img_h if hasattr(landmarks[0], 'y') else landmarks[0][1] * img_h
    ankle_lm_27_y = landmarks[27].y if hasattr(landmarks[27], 'y') else landmarks[27][1]
    ankle_lm_28_y = landmarks[28].y if hasattr(landmarks[28], 'y') else landmarks[28][1]
    ankle_y = max(ankle_lm_27_y, ankle_lm_28_y) * img_h
    person_height_px = max(60.0, abs(ankle_y - head_y))

    scale = user_height_cm / person_height_px

    lm11_x = landmarks[11].x if hasattr(landmarks[11], 'x') else landmarks[11][0]
    lm11_y = landmarks[11].y if hasattr(landmarks[11], 'y') else landmarks[11][1]
    lm12_x = landmarks[12].x if hasattr(landmarks[12], 'x') else landmarks[12][0]
    lm12_y = landmarks[12].y if hasattr(landmarks[12], 'y') else landmarks[12][1]

    dx_sh = (lm12_x - lm11_x) * img_w
    dy_sh = (lm12_y - lm11_y) * img_h
    shoulder_cm = np.hypot(dx_sh, dy_sh) * scale
    chest_cm = shoulder_cm * 2.3

    lm23_x = landmarks[23].x if hasattr(landmarks[23], 'x') else landmarks[23][0]
    lm23_y = landmarks[23].y if hasattr(landmarks[23], 'y') else landmarks[23][1]
    lm24_x = landmarks[24].x if hasattr(landmarks[24], 'x') else landmarks[24][0]
    lm24_y = landmarks[24].y if hasattr(landmarks[24], 'y') else landmarks[24][1]

    dx_w = (lm24_x - lm23_x) * img_w
    dy_w = (lm24_y - lm23_y) * img_h
    waist_cm = np.hypot(dx_w, dy_w) * scale * 2.1

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


# -----------------------------------------------------------------------------
# 4. Realistic Warping, Smoothing, Lighting & Occlusion Layer
# -----------------------------------------------------------------------------
class LandmarkSmoother:
    """Exponential Moving Average (EMA) smoothing filter to eliminate tracking jitter."""
    def __init__(self, alpha: float = 0.3):
        self.alpha = alpha  # 0.7 * prev + 0.3 * curr
        self.prev_landmarks = None

    def update(self, landmarks):
        if not landmarks:
            return None

        curr_pts = []
        for lm in landmarks:
            x = lm.x if hasattr(lm, 'x') else lm[0]
            y = lm.y if hasattr(lm, 'y') else lm[1]
            z = lm.z if hasattr(lm, 'z') else (lm[2] if len(lm) > 2 else 0.0)
            curr_pts.append((x, y, z))

        if self.prev_landmarks is None or len(self.prev_landmarks) != len(curr_pts):
            self.prev_landmarks = curr_pts
            return self.prev_landmarks

        smoothed = []
        for (px, py, pz), (cx, cy, cz) in zip(self.prev_landmarks, curr_pts):
            sx = 0.7 * px + 0.3 * cx
            sy = 0.7 * py + 0.3 * cy
            sz = 0.7 * pz + 0.3 * cz
            smoothed.append((sx, sy, sz))

        self.prev_landmarks = smoothed
        return smoothed

    def reset(self):
        self.prev_landmarks = None


def match_lighting_lab(frame_bgr: np.ndarray, dress_bgr: np.ndarray, alpha_mask: np.ndarray) -> np.ndarray:
    """
    Converts frame and dress to LAB color space, matching dress luminance
    to the ambient environment before blending.
    """
    valid_mask = alpha_mask > 0.05
    if not np.any(valid_mask):
        return dress_bgr

    frame_lab = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2LAB)
    dress_lab = cv2.cvtColor(dress_bgr, cv2.COLOR_BGR2LAB)

    person_mean_l = float(np.mean(frame_lab[:, :, 0][valid_mask]))
    dress_mean_l = float(np.mean(dress_lab[:, :, 0][valid_mask]))

    if dress_mean_l > 5.0:
        delta_l = (person_mean_l - dress_mean_l) * 0.50
        dress_l = np.clip(dress_lab[:, :, 0].astype(np.float32) + delta_l, 0, 255).astype(np.uint8)
        dress_lab[:, :, 0] = dress_l
        return cv2.cvtColor(dress_lab, cv2.COLOR_LAB2BGR)

    return dress_bgr


def generate_occlusion_mask(landmarks: list, img_h: int, img_w: int, shoulder_dist: float) -> np.ndarray:
    """
    Builds occlusion mask for face, hair, neck, and foreground hands
    so they always render ABOVE the dress layer.
    """
    mask = np.zeros((img_h, img_w), dtype=np.float32)

    # 1. Face & Chin region (landmarks 0..10)
    face_pts = []
    for i in range(11):
        fx = int(landmarks[i][0] * img_w)
        fy = int(landmarks[i][1] * img_h)
        face_pts.append((fx, fy))

    if face_pts:
        face_hull = cv2.convexHull(np.array(face_pts, dtype=np.int32))
        cv2.fillConvexPoly(mask, face_hull, 1.0)
        center_x = int(np.mean([p[0] for p in face_pts]))
        center_y = int(np.mean([p[1] for p in face_pts]))
        axes = (int(shoulder_dist * 0.38), int(shoulder_dist * 0.45))
        cv2.ellipse(mask, (center_x, center_y), axes, 0, 0, 360, 1.0, -1)

    # 2. Hands, wrists, and forearms in front of torso (landmarks 15..22)
    sh_top_y = min(landmarks[11][1], landmarks[12][1]) * img_h
    hip_bot_y = max(landmarks[23][1], landmarks[24][1]) * img_h + shoulder_dist * 0.5
    hand_radius = max(18, int(shoulder_dist * 0.16))

    for h_idx in [15, 16, 17, 18, 19, 20, 21, 22]:
        hx = int(landmarks[h_idx][0] * img_w)
        hy = int(landmarks[h_idx][1] * img_h)
        if sh_top_y <= hy <= hip_bot_y:
            cv2.circle(mask, (hx, hy), hand_radius, 1.0, -1)

    # Connect forearm segments if situated in front of torso
    for (elbow_idx, wrist_idx) in [(13, 15), (14, 16)]:
        ex = int(landmarks[elbow_idx][0] * img_w)
        ey = int(landmarks[elbow_idx][1] * img_h)
        wx = int(landmarks[wrist_idx][0] * img_w)
        wy = int(landmarks[wrist_idx][1] * img_h)
        if sh_top_y <= max(ey, wy) and min(ey, wy) <= hip_bot_y:
            cv2.line(mask, (ex, ey), (wx, wy), 1.0, int(hand_radius * 1.5))

    return cv2.GaussianBlur(mask, (9, 9), 0)


def _alpha_composite(bg_rgba: np.ndarray, fg_rgba: np.ndarray) -> np.ndarray:
    """Combines two RGBA images using Porter-Duff source-over compositing."""
    fg_a = fg_rgba[:, :, 3].astype(np.float32) / 255.0
    bg_a = bg_rgba[:, :, 3].astype(np.float32) / 255.0
    out_a = fg_a + bg_a * (1.0 - fg_a)
    out_rgb = np.zeros_like(fg_rgba[:, :, :3], dtype=np.float32)
    valid = out_a > 1e-4
    for c in range(3):
        out_rgb[:, :, c][valid] = (
            fg_rgba[:, :, c].astype(np.float32)[valid] * fg_a[valid] +
            bg_rgba[:, :, c].astype(np.float32)[valid] * bg_a[valid] * (1.0 - fg_a[valid])
        ) / out_a[valid]
    out = np.zeros_like(fg_rgba)
    out[:, :, :3] = np.clip(out_rgb, 0, 255).astype(np.uint8)
    out[:, :, 3] = np.clip(out_a * 255.0, 0, 255).astype(np.uint8)
    return out


def warp_garment_perspective(
    frame: np.ndarray,
    garment_rgba: np.ndarray,
    landmarks: list,
    garment: dict
) -> np.ndarray:
    """
    Warps garment PNG to person using 4-point perspective transform, rotation angle,
    lighting match, and face/hand occlusion masking.
    For sarees, implements special multi-layer draping:
    - Base blouse across upper torso
    - Flared skirt warped down to ankles (landmarks 27 & 28)
    - Diagonal pallu strip running from Right Shoulder (12) across to Left Hip (23)
    """
    img_h, img_w = frame.shape[:2]
    g_h, g_w = garment_rgba.shape[:2]
    g_type = garment.get("type", "upper").lower()

    pt11 = (landmarks[11][0] * img_w, landmarks[11][1] * img_h)
    pt12 = (landmarks[12][0] * img_w, landmarks[12][1] * img_h)

    sh_left = pt11 if pt11[0] <= pt12[0] else pt12
    sh_right = pt12 if pt11[0] <= pt12[0] else pt11

    dx = sh_right[0] - sh_left[0]
    dy = sh_right[1] - sh_left[1]
    shoulder_dist = max(20.0, np.hypot(dx, dy))
    angle_rad = np.arctan2(dy, dx)

    if g_type in ["long_upper", "kurti", "saree"]:
        target_width = shoulder_dist * 1.35
    else:
        target_width = shoulder_dist * 1.45

    if g_type == "upper":
        b1 = (landmarks[23][0] * img_w, landmarks[23][1] * img_h)
        b2 = (landmarks[24][0] * img_w, landmarks[24][1] * img_h)
    elif g_type in ["long_upper", "kurti"]:
        b1 = (landmarks[25][0] * img_w, landmarks[25][1] * img_h)
        b2 = (landmarks[26][0] * img_w, landmarks[26][1] * img_h)
    else:  # saree
        b1 = (landmarks[27][0] * img_w, landmarks[27][1] * img_h)
        b2 = (landmarks[28][0] * img_w, landmarks[28][1] * img_h)

    bot_left = b1 if b1[0] <= b2[0] else b2
    bot_right = b2 if b1[0] <= b2[0] else b1

    mid_top_x = (sh_left[0] + sh_right[0]) / 2.0
    mid_top_y = (sh_left[1] + sh_right[1]) / 2.0 - shoulder_dist * 0.16

    mid_bot_x = (bot_left[0] + bot_right[0]) / 2.0
    mid_bot_y = (bot_left[1] + bot_right[1]) / 2.0

    ux = np.cos(angle_rad)
    uy = np.sin(angle_rad)

    dst_tl = [mid_top_x - (target_width / 2.0) * ux, mid_top_y - (target_width / 2.0) * uy]
    dst_tr = [mid_top_x + (target_width / 2.0) * ux, mid_top_y + (target_width / 2.0) * uy]

    bot_w = target_width * (1.10 if g_type != "upper" else 0.95)
    dst_br = [mid_bot_x + (bot_w / 2.0) * ux, mid_bot_y + (bot_w / 2.0) * uy]
    dst_bl = [mid_bot_x - (bot_w / 2.0) * ux, mid_bot_y - (bot_w / 2.0) * uy]

    if g_type == "saree":
        # SAREE SPECIAL:
        # 1. Warp bottom part till ankle (landmarks 27 & 28)
        # 2. Warp base blouse across upper torso
        # 3. Draw pallu as diagonal warped strip from Right Shoulder(12) to Left Hip(23)
        # Do not paste saree as a normal shirt!
        mid_hip_x = (landmarks[23][0] + landmarks[24][0]) * img_w / 2.0
        mid_hip_y = (landmarks[23][1] + landmarks[24][1]) * img_h / 2.0

        ankle_l_y = landmarks[27][1] * img_h
        ankle_r_y = landmarks[28][1] * img_h
        mid_ankle_x = (landmarks[27][0] + landmarks[28][0]) * img_w / 2.0
        mid_ankle_y = (ankle_l_y + ankle_r_y) / 2.0
        if mid_ankle_y < mid_hip_y + shoulder_dist:
            mid_ankle_y = min(float(img_h), mid_hip_y + shoulder_dist * 2.8)
            mid_ankle_x = mid_hip_x

        skirt_top_w = shoulder_dist * 0.95
        dst_skirt_tl = [mid_hip_x - (skirt_top_w / 2.0) * ux, mid_hip_y - (skirt_top_w / 2.0) * uy]
        dst_skirt_tr = [mid_hip_x + (skirt_top_w / 2.0) * ux, mid_hip_y + (skirt_top_w / 2.0) * uy]
        dst_skirt_br = [mid_ankle_x + (target_width / 2.0) * ux, mid_ankle_y + (target_width / 2.0) * uy]
        dst_skirt_bl = [mid_ankle_x - (target_width / 2.0) * ux, mid_ankle_y - (target_width / 2.0) * uy]
        src_skirt = np.float32([[0, int(g_h * 0.30)], [g_w, int(g_h * 0.30)], [g_w, g_h], [0, g_h]])
        dst_skirt = np.float32([dst_skirt_tl, dst_skirt_tr, dst_skirt_br, dst_skirt_bl])
        M_skirt = cv2.getPerspectiveTransform(src_skirt, dst_skirt)
        warped_skirt = cv2.warpPerspective(garment_rgba, M_skirt, (img_w, img_h), borderValue=(0, 0, 0, 0))

        # Base blouse / bodice across torso
        blouse_w = shoulder_dist * 1.15
        dst_blouse_tl = [mid_top_x - (blouse_w / 2.0) * ux, mid_top_y - (blouse_w / 2.0) * uy]
        dst_blouse_tr = [mid_top_x + (blouse_w / 2.0) * ux, mid_top_y + (blouse_w / 2.0) * uy]
        dst_blouse_br = [mid_hip_x + (skirt_top_w / 2.0) * ux, mid_hip_y + (skirt_top_w / 2.0) * uy]
        dst_blouse_bl = [mid_hip_x - (skirt_top_w / 2.0) * ux, mid_hip_y - (skirt_top_w / 2.0) * uy]
        src_blouse = np.float32([[0, 0], [g_w, 0], [g_w, int(g_h * 0.35)], [0, int(g_h * 0.35)]])
        dst_blouse = np.float32([dst_blouse_tl, dst_blouse_tr, dst_blouse_br, dst_blouse_bl])
        M_blouse = cv2.getPerspectiveTransform(src_blouse, dst_blouse)
        warped_blouse = cv2.warpPerspective(garment_rgba, M_blouse, (img_w, img_h), borderValue=(0, 0, 0, 0))

        # Pallu: diagonal warped strip from Right Shoulder (12) to Left Hip (23)
        p12 = np.array([landmarks[12][0] * img_w, landmarks[12][1] * img_h], dtype=np.float32)
        p23 = np.array([landmarks[23][0] * img_w, landmarks[23][1] * img_h], dtype=np.float32)
        v_p = p23 - p12
        len_p = float(np.hypot(v_p[0], v_p[1]))
        u_p = v_p / max(1.0, len_p)
        norm_p = np.array([-u_p[1], u_p[0]], dtype=np.float32)
        pallu_w = shoulder_dist * 0.48
        p_start = p12 - u_p * (shoulder_dist * 0.12)
        p_end = p23 + u_p * (shoulder_dist * 0.15)
        dst_pallu = np.float32([
            p_start - norm_p * (pallu_w / 2.0),
            p_start + norm_p * (pallu_w / 2.0),
            p_end + norm_p * (pallu_w / 2.0),
            p_end - norm_p * (pallu_w / 2.0)
        ])
        src_pallu = np.float32([[0, 0], [int(g_w * 0.42), 0], [int(g_w * 0.42), g_h], [0, g_h]])
        M_pallu = cv2.getPerspectiveTransform(src_pallu, dst_pallu)
        warped_pallu = cv2.warpPerspective(garment_rgba, M_pallu, (img_w, img_h), borderValue=(0, 0, 0, 0))

        warped_rgba = _alpha_composite(_alpha_composite(warped_blouse, warped_skirt), warped_pallu)
    else:
        dst_pts = np.float32([dst_tl, dst_tr, dst_br, dst_bl])
        src_pts = np.float32([[0, 0], [g_w, 0], [g_w, g_h], [0, g_h]])

        M = cv2.getPerspectiveTransform(src_pts, dst_pts)
        warped_rgba = cv2.warpPerspective(
            garment_rgba, M, (img_w, img_h),
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(0, 0, 0, 0)
        )

    # 4. Soft Edge Feathering
    raw_alpha = warped_rgba[:, :, 3].astype(np.float32) / 255.0
    feathered_alpha = cv2.GaussianBlur(raw_alpha, (7, 7), 0)

    # 5. MediaPipe Segmentation Occlusion (Keep face & hands ABOVE dress layer)
    occlusion_mask = generate_occlusion_mask(landmarks, img_h, img_w, shoulder_dist)
    effective_alpha = np.clip(feathered_alpha * (1.0 - occlusion_mask), 0.0, 1.0)

    # 6. Lighting Match in LAB color space
    matched_bgr = match_lighting_lab(frame, warped_rgba[:, :, :3], effective_alpha)

    # 7. Alpha blending with feathered mask
    effective_3ch = np.dstack([effective_alpha] * 3)
    blended_frame = (frame.astype(np.float32) * (1.0 - effective_3ch) + matched_bgr.astype(np.float32) * effective_3ch).astype(np.uint8)
    return blended_frame


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
    smoother = LandmarkSmoother(alpha=0.3)
    raw_landmarks = detector.detect(base_frame)
    smoothed_landmarks = smoother.update(raw_landmarks) if raw_landmarks else None

    current_index = 0
    show_size = True
    window_name = "AURA Virtual Trial Room [PHOTO MODE]"

    while True:
        display_frame = base_frame.copy()
        garment = GARMENTS[current_index]
        garment_rgba = load_garment_image(garment["file"])

        size_info = None
        if smoothed_landmarks:
            h, w = display_frame.shape[:2]
            size_info = analyze_size(smoothed_landmarks, h, w, user_height_cm, garment["category"])
            display_frame = warp_garment_perspective(display_frame, garment_rgba, smoothed_landmarks, garment)

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
    smoother = LandmarkSmoother(alpha=0.3)
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
        garment_rgba = load_garment_image(garment["file"])

        raw_landmarks = detector.detect(frame)
        smoothed_landmarks = smoother.update(raw_landmarks) if raw_landmarks else None

        size_info = None
        if smoothed_landmarks:
            size_info = analyze_size(smoothed_landmarks, h, w, user_height_cm, garment["category"])
            frame = warp_garment_perspective(frame, garment_rgba, smoothed_landmarks, garment)

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
