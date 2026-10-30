"""
AI Powered Virtual Trial Room
Modular Monolith Architecture - Single Entry Point (main.py)
Implements:
1. Garment Catalog Layer with 8-Point Manual Anchors & Fit Factors
2. MediaPipe Pose Layer & Quality Gate (Visibility >= 0.80, Tilt <= 12 deg, Frontal Check)
3. 30-Frame Rolling Median Size Estimation (Chest, Waist, Shoulder -> S/M/L/XL/XXL)
4. Thin Plate Spline (TPS) & Separate Sleeve Warping Layer (Arms 11->13->15, 12->14->16)
5. Realism Stack: Soft Drop Shadow, LAB Lighting Match, Occlusion Masking & Feathered Alpha Blending
"""

import os
import sys
import time
import argparse
import cv2
import numpy as np
from PIL import Image
import scipy.interpolate as interp

# MediaPipe Pose Integration
try:
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision as mp_vision
    MP_AVAILABLE = True
except ImportError:
    MP_AVAILABLE = False


# -----------------------------------------------------------------------------
# 1. Garment Catalog Layer with 8-Point Manual Anchors & Fit Factors (TASK 2)
# -----------------------------------------------------------------------------
GARMENTS = [
    {
        "id": "shirt1",
        "name": "Zara Slim Shirt",
        "brand": "Zara",
        "category": "Shirt",
        "file": "1.png",
        "type": "upper",
        "fit_factor": 1.45,
        "anchors": {
            "neck_left": [0.42, 0.08], "neck_right": [0.58, 0.08],
            "shoulder_left": [0.18, 0.12], "shoulder_right": [0.82, 0.12],
            "armpit_left": [0.22, 0.38], "armpit_right": [0.78, 0.38],
            "hem_left": [0.24, 0.96], "hem_right": [0.76, 0.96]
        }
    },
    {
        "id": "tshirt1",
        "name": "Levis T-Shirt",
        "brand": "Levis",
        "category": "T-Shirt",
        "file": "2.png",
        "type": "upper",
        "fit_factor": 1.45,
        "anchors": {
            "neck_left": [0.40, 0.08], "neck_right": [0.60, 0.08],
            "shoulder_left": [0.16, 0.14], "shoulder_right": [0.84, 0.14],
            "armpit_left": [0.22, 0.36], "armpit_right": [0.78, 0.36],
            "hem_left": [0.22, 0.96], "hem_right": [0.78, 0.96]
        }
    },
    {
        "id": "top1",
        "name": "H&M Women Top",
        "brand": "H&M",
        "category": "Tops",
        "file": "3.png",
        "type": "upper",
        "fit_factor": 1.45,
        "anchors": {
            "neck_left": [0.38, 0.10], "neck_right": [0.62, 0.10],
            "shoulder_left": [0.18, 0.15], "shoulder_right": [0.82, 0.15],
            "armpit_left": [0.24, 0.40], "armpit_right": [0.76, 0.40],
            "hem_left": [0.25, 0.95], "hem_right": [0.75, 0.95]
        }
    },
    {
        "id": "kurti1",
        "name": "Biba Kurti",
        "brand": "Biba",
        "category": "Kurti",
        "file": "4.png",
        "type": "long_upper",
        "fit_factor": 1.35,
        "anchors": {
            "neck_left": [0.42, 0.06], "neck_right": [0.58, 0.06],
            "shoulder_left": [0.18, 0.10], "shoulder_right": [0.82, 0.10],
            "armpit_left": [0.24, 0.32], "armpit_right": [0.76, 0.32],
            "hem_left": [0.20, 0.98], "hem_right": [0.80, 0.98]
        }
    },
    {
        "id": "saree1",
        "name": "Banarasi Saree",
        "brand": "Manyavar",
        "category": "Saree",
        "file": "5.png",
        "type": "saree",
        "fit_factor": 1.35,
        "anchors": {
            "neck_left": [0.40, 0.08], "neck_right": [0.60, 0.08],
            "shoulder_left": [0.18, 0.12], "shoulder_right": [0.82, 0.12],
            "armpit_left": [0.22, 0.35], "armpit_right": [0.78, 0.35],
            "hem_left": [0.18, 0.98], "hem_right": [0.82, 0.98]
        }
    }
]

# Anatomical scale factors per size (Task 2)
SIZE_FACTORS = {
    "S": 1.35,
    "M": 1.45,
    "L": 1.55,
    "XL": 1.65,
    "XXL": 1.75
}

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
# TASK 1: Quality Gate Before Try-On
# -----------------------------------------------------------------------------
def check_quality_gate(landmarks, img_h: int, img_w: int) -> dict:
    """
    Validates posture and framing constraints:
    - Landmark visibility of 11, 12, 23, 24 >= 0.80
    - Shoulder tilt angle <= 12 degrees
    - Body rotation |shoulder_width / torso_height| >= 0.65 (front-facing check)
    - Person framing: 15% <= shoulder_width <= 45% of frame width
    """
    if not landmarks or len(landmarks) < 25:
        return {"passed": False, "guidance": "No Person In View", "suggest_photoreal": False}

    def get_val(idx, prop):
        lm = landmarks[idx]
        if hasattr(lm, prop):
            return getattr(lm, prop)
        if isinstance(lm, (list, tuple)):
            if prop == 'x': return lm[0]
            if prop == 'y': return lm[1]
            if prop == 'visibility' and len(lm) > 3: return lm[3]
        return 1.0

    # 1. Landmark visibility of 11, 12, 23, 24 >= 0.80
    for idx in [11, 12, 23, 24]:
        vis = get_val(idx, 'visibility')
        if vis < 0.80:
            return {
                "passed": False,
                "guidance": f"Torso Landmark {idx} Visibility Low ({vis:.2f} < 0.80)",
                "suggest_photoreal": False
            }

    lm11_x = get_val(11, 'x') * img_w
    lm11_y = get_val(11, 'y') * img_h
    lm12_x = get_val(12, 'x') * img_w
    lm12_y = get_val(12, 'y') * img_h

    dx = lm12_x - lm11_x
    dy = lm12_y - lm11_y
    shoulder_dist = np.hypot(dx, dy)

    # 2. Shoulder tilt <= 12 degrees
    tilt_deg = abs(np.degrees(np.arctan2(abs(dy), max(1e-4, abs(dx)))))
    if tilt_deg > 12.0:
        return {
            "passed": False,
            "guidance": f"Shoulder Tilt {tilt_deg:.1f}deg > 12deg (Stand Straight)",
            "suggest_photoreal": False
        }

    # 3. Body rotation |shoulder_width / torso_height| >= 0.65
    mid_sh_y = (lm11_y + lm12_y) / 2.0
    lm23_y = get_val(23, 'y') * img_h
    lm24_y = get_val(24, 'y') * img_h
    mid_hip_y = (lm23_y + lm24_y) / 2.0
    torso_h = max(1.0, abs(mid_hip_y - mid_sh_y))
    rotation_ratio = shoulder_dist / torso_h

    if rotation_ratio < 0.65:
        return {
            "passed": False,
            "guidance": "Please use Photoreal Mode for this photo",
            "suggest_photoreal": True
        }

    # 4. Framing check
    sh_pct = shoulder_dist / float(img_w)
    if sh_pct > 0.45:
        return {
            "passed": False,
            "guidance": f"Step Back (Shoulder {sh_pct*100:.0f}% > 45% Frame)",
            "suggest_photoreal": False
        }
    if sh_pct < 0.15:
        return {
            "passed": False,
            "guidance": f"Step Closer (Shoulder {sh_pct*100:.0f}% < 15% Frame)",
            "suggest_photoreal": False
        }

    return {"passed": True, "guidance": "Optimal Frontal Pose", "suggest_photoreal": False}


# -----------------------------------------------------------------------------
# 3. Size Estimation Layer with 30-Frame Rolling Median (TASK 1)
# -----------------------------------------------------------------------------
class RollingMedianSizer:
    """30-frame rolling median buffer to eliminate frame-to-frame sizing jitter."""
    def __init__(self, capacity: int = 30):
        self.capacity = capacity
        self.history = []

    def update(self, landmarks, img_h: int, img_w: int, user_height_cm: float, category: str = "Shirt") -> dict:
        def get_val(idx, prop):
            lm = landmarks[idx]
            if hasattr(lm, prop): return getattr(lm, prop)
            if isinstance(lm, (list, tuple)):
                if prop == 'x': return lm[0]
                if prop == 'y': return lm[1]
            return 0.0

        head_y = get_val(0, 'y') * img_h
        ankle_y = max(get_val(27, 'y'), get_val(28, 'y')) * img_h
        person_height_px = max(60.0, abs(ankle_y - head_y))
        scale = user_height_cm / person_height_px

        dx_sh = (get_val(12, 'x') - get_val(11, 'x')) * img_w
        dy_sh = (get_val(12, 'y') - get_val(11, 'y')) * img_h
        shoulder_cm = np.hypot(dx_sh, dy_sh) * scale
        chest_cm = shoulder_cm * 2.3

        dx_w = (get_val(24, 'x') - get_val(23, 'x')) * img_w
        dy_w = (get_val(24, 'y') - get_val(23, 'y')) * img_h
        waist_cm = np.hypot(dx_w, dy_w) * scale * 2.1

        self.history.append((shoulder_cm, chest_cm, waist_cm))
        if len(self.history) > self.capacity:
            self.history.pop(0)

        # Median calculation
        med_sh = float(np.median([h[0] for h in self.history]))
        med_ch = float(np.median([h[1] for h in self.history]))
        med_wst = float(np.median([h[2] for h in self.history]))

        # Sizing standards (Task 1)
        if med_ch < 91:
            size_label = "S"
        elif med_ch < 97:
            size_label = "M"
        elif med_ch < 102:
            size_label = "L"
        elif med_ch < 107:
            size_label = "XL"
        else:
            size_label = "XXL"

        cat_lower = category.lower()
        if cat_lower == "saree":
            chest_in = med_ch / 2.54
            if chest_in < 33: blouse_size = "32"
            elif chest_in < 35: blouse_size = "34"
            elif chest_in < 37: blouse_size = "36"
            elif chest_in < 39: blouse_size = "38"
            else: blouse_size = "40"
            display_size = f"Blouse {blouse_size}"
        elif cat_lower in ["kurti", "tops"]:
            display_size = f"Bust {size_label}"
        else:
            display_size = size_label

        return {
            "size": display_size,
            "standard_size": size_label,
            "shoulder_cm": med_sh,
            "chest_cm": med_ch,
            "waist_cm": med_wst,
            "scale": scale
        }


# -----------------------------------------------------------------------------
# 4. Realistic Warping, Smoothing, Lighting & Occlusion Layer (TASKS 3, 4, 5)
# -----------------------------------------------------------------------------
class LandmarkSmoother:
    """Exponential Moving Average (EMA) smoothing with 100ms lock (TASK 4)."""
    def __init__(self, alpha: float = 0.35, lock_ms: float = 100.0):
        # smooth = 0.65 * prev + 0.35 * curr
        self.alpha = alpha
        self.lock_ms = lock_ms
        self.prev_landmarks = None
        self.last_update_time = 0.0

    def update(self, landmarks):
        now = time.time()
        if not landmarks:
            # Lock garment for 100ms if landmark lost
            if self.prev_landmarks and (now - self.last_update_time) * 1000.0 < self.lock_ms:
                return self.prev_landmarks
            return None

        curr_pts = []
        for lm in landmarks:
            x = lm.x if hasattr(lm, 'x') else lm[0]
            y = lm.y if hasattr(lm, 'y') else lm[1]
            z = lm.z if hasattr(lm, 'z') else (lm[2] if len(lm) > 2 else 0.0)
            curr_pts.append((x, y, z))

        if self.prev_landmarks is None or len(self.prev_landmarks) != len(curr_pts):
            self.prev_landmarks = curr_pts
            self.last_update_time = now
            return self.prev_landmarks

        smoothed = []
        for (px, py, pz), (cx, cy, cz) in zip(self.prev_landmarks, curr_pts):
            sx = 0.65 * px + 0.35 * cx
            sy = 0.65 * py + 0.35 * cy
            sz = 0.65 * pz + 0.35 * cz
            smoothed.append((sx, sy, sz))

        self.prev_landmarks = smoothed
        self.last_update_time = now
        return smoothed


def match_lighting_lab(frame_bgr: np.ndarray, dress_bgr: np.ndarray, alpha_mask: np.ndarray) -> np.ndarray:
    """Match garment luminance mean and standard deviation to person torso in LAB space."""
    valid_mask = alpha_mask > 0.05
    if not np.any(valid_mask):
        return dress_bgr

    frame_lab = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2LAB)
    dress_lab = cv2.cvtColor(dress_bgr, cv2.COLOR_BGR2LAB)

    person_l = frame_lab[:, :, 0][valid_mask].astype(np.float32)
    dress_l = dress_lab[:, :, 0][valid_mask].astype(np.float32)

    p_mean, p_std = np.mean(person_l), max(1.0, np.std(person_l))
    d_mean, d_std = np.mean(dress_l), max(1.0, np.std(dress_l))

    if d_mean > 5.0:
        scaled_l = (dress_lab[:, :, 0].astype(np.float32) - d_mean) * (p_std / d_std * 0.4 + 0.6) + p_mean
        dress_lab[:, :, 0] = np.clip(scaled_l, 0, 255).astype(np.uint8)
        return cv2.cvtColor(dress_lab, cv2.COLOR_LAB2BGR)

    return dress_bgr


def get_lm_coord(lm):
    """Safely extracts x, y, z from either NormalizedLandmark object or tuple."""
    if hasattr(lm, 'x'):
        return lm.x, lm.y, getattr(lm, 'z', 0.0)
    return lm[0], lm[1], (lm[2] if len(lm) > 2 else 0.0)


def generate_occlusion_mask(landmarks: list, img_h: int, img_w: int, shoulder_dist: float) -> np.ndarray:
    """Builds occlusion mask for face, hair, and foreground hands/forearms to stay ABOVE dress."""
    mask = np.zeros((img_h, img_w), dtype=np.float32)

    # 1. Face & Chin region (landmarks 0..10)
    face_pts = []
    for i in range(11):
        x, y, _ = get_lm_coord(landmarks[i])
        fx = int(x * img_w)
        fy = int(y * img_h)
        face_pts.append((fx, fy))

    if face_pts:
        face_hull = cv2.convexHull(np.array(face_pts, dtype=np.int32))
        cv2.fillConvexPoly(mask, face_hull, 1.0)
        cx = int(np.mean([p[0] for p in face_pts]))
        cy = int(np.mean([p[1] for p in face_pts]))
        cv2.ellipse(mask, (cx, cy), (int(shoulder_dist * 0.38), int(shoulder_dist * 0.45)), 0, 0, 360, 1.0, -1)

    # 2. Hands, wrists, and forearms in front of torso (landmarks 13..22)
    sh11_x, sh11_y, _ = get_lm_coord(landmarks[11])
    sh12_x, sh12_y, _ = get_lm_coord(landmarks[12])
    hp23_x, hp23_y, _ = get_lm_coord(landmarks[23])
    hp24_x, hp24_y, _ = get_lm_coord(landmarks[24])

    sh_top_y = min(sh11_y, sh12_y) * img_h
    hip_bot_y = max(hp23_y, hp24_y) * img_h + shoulder_dist * 0.6
    hand_radius = max(18, int(shoulder_dist * 0.16))

    for h_idx in [15, 16, 17, 18, 19, 20, 21, 22]:
        hx_norm, hy_norm, _ = get_lm_coord(landmarks[h_idx])
        hx = int(hx_norm * img_w)
        hy = int(hy_norm * img_h)
        if sh_top_y <= hy <= hip_bot_y:
            cv2.circle(mask, (hx, hy), hand_radius, 1.0, -1)

    for (el_idx, wr_idx) in [(13, 15), (14, 16)]:
        ex_norm, ey_norm, _ = get_lm_coord(landmarks[el_idx])
        wx_norm, wy_norm, _ = get_lm_coord(landmarks[wr_idx])
        ex = int(ex_norm * img_w)
        ey = int(ey_norm * img_h)
        wx = int(wx_norm * img_w)
        wy = int(wy_norm * img_h)
        if sh_top_y <= max(ey, wy) and min(ey, wy) <= hip_bot_y:
            cv2.line(mask, (ex, ey), (wx, wy), 1.0, int(hand_radius * 1.5))

    return cv2.GaussianBlur(mask, (9, 9), 0)


def _alpha_composite(bg_rgba: np.ndarray, fg_rgba: np.ndarray) -> np.ndarray:
    """Porter-Duff source-over compositing."""
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


# -----------------------------------------------------------------------------
# TASK 3: Thin Plate Spline (TPS) & Separate Sleeve Warping
# -----------------------------------------------------------------------------
def warp_garment_tps(
    frame: np.ndarray,
    garment_rgba: np.ndarray,
    landmarks: list,
    garment: dict,
    selected_size: str = "M",
    current_size: str = None
) -> np.ndarray:
    """
    Thin Plate Spline (TPS) Warping with 8 Manual Garment Anchors -> 8 Body Anchors.
    Warps torso and sleeves separately, then blends with drop shadow, LAB lighting, and occlusion.
    """
    if current_size is not None:
        selected_size = current_size
    img_h, img_w = frame.shape[:2]
    g_h, g_w = garment_rgba.shape[:2]
    g_type = garment.get("type", "upper").lower()
    anchors = garment.get("anchors", {})

    # Body anchors from MediaPipe Pose:
    # 11 = Left Shoulder, 12 = Right Shoulder, 23 = Left Hip, 24 = Right Hip
    p11_x, p11_y, _ = get_lm_coord(landmarks[11])
    p12_x, p12_y, _ = get_lm_coord(landmarks[12])
    p23_x, p23_y, _ = get_lm_coord(landmarks[23])
    p24_x, p24_y, _ = get_lm_coord(landmarks[24])

    p11 = np.array([p11_x * img_w, p11_y * img_h], dtype=np.float32)
    p12 = np.array([p12_x * img_w, p12_y * img_h], dtype=np.float32)
    p23 = np.array([p23_x * img_w, p23_y * img_h], dtype=np.float32)
    p24 = np.array([p24_x * img_w, p24_y * img_h], dtype=np.float32)

    shoulder_center = (p11 + p12) / 2.0
    hip_center = (p23 + p24) / 2.0
    dx_sh = p12[0] - p11[0]
    dy_sh = p12[1] - p11[1]
    shoulder_dist = max(20.0, float(np.hypot(dx_sh, dy_sh)))
    torso_len = max(30.0, float(np.hypot(hip_center[0] - shoulder_center[0], hip_center[1] - shoulder_center[1])))

    # Size Factor (Task 2)
    size_factor = SIZE_FACTORS.get(selected_size.upper(), 1.45)

    # Anatomical target anchors
    target_neck = shoulder_center - np.array([0, shoulder_dist * 0.18], dtype=np.float32)
    target_neck_left = target_neck - np.array([shoulder_dist * 0.12, 0], dtype=np.float32)
    target_neck_right = target_neck + np.array([shoulder_dist * 0.12, 0], dtype=np.float32)

    vec_sh_left = (p11 - shoulder_center)
    vec_sh_right = (p12 - shoulder_center)
    target_shoulder_left = shoulder_center + vec_sh_left * size_factor
    target_shoulder_right = shoulder_center + vec_sh_right * size_factor

    target_armpit_left = p11 + (p23 - p11) * 0.32
    target_armpit_right = p12 + (p24 - p12) * 0.32

    # Hem offset based on category (Task 2)
    if g_type == "long_upper":  # Kurti
        p25_x, p25_y, _ = get_lm_coord(landmarks[25])
        p26_x, p26_y, _ = get_lm_coord(landmarks[26])
        p25 = np.array([p25_x * img_w, p25_y * img_h], dtype=np.float32)
        p26 = np.array([p26_x * img_w, p26_y * img_h], dtype=np.float32)
        hem_y = ((p25[1] + p26[1]) / 2.0) - torso_len * 0.05
    elif g_type == "saree":     # Saree / Dress
        p27_x, p27_y, _ = get_lm_coord(landmarks[27])
        p28_x, p28_y, _ = get_lm_coord(landmarks[28])
        p27 = np.array([p27_x * img_w, p27_y * img_h], dtype=np.float32)
        p28 = np.array([p28_x * img_w, p28_y * img_h], dtype=np.float32)
        hem_y = max(p27[1], p28[1])
    else:                       # Shirt / T-Shirt / Top
        hem_y = hip_center[1] + torso_len * 0.15

    hem_w = shoulder_dist * (size_factor * 0.90)
    target_hem_left = np.array([hip_center[0] - hem_w / 2.0, hem_y], dtype=np.float32)
    target_hem_right = np.array([hip_center[0] + hem_w / 2.0, hem_y], dtype=np.float32)

    # 8 Source garment anchor coordinates
    src_nl = np.array(anchors.get("neck_left", [0.42, 0.08])) * [g_w, g_h]
    src_nr = np.array(anchors.get("neck_right", [0.58, 0.08])) * [g_w, g_h]
    src_sl = np.array(anchors.get("shoulder_left", [0.18, 0.12])) * [g_w, g_h]
    src_sr = np.array(anchors.get("shoulder_right", [0.82, 0.12])) * [g_w, g_h]
    src_al = np.array(anchors.get("armpit_left", [0.22, 0.38])) * [g_w, g_h]
    src_ar = np.array(anchors.get("armpit_right", [0.78, 0.38])) * [g_w, g_h]
    src_hl = np.array(anchors.get("hem_left", [0.24, 0.96])) * [g_w, g_h]
    src_hr = np.array(anchors.get("hem_right", [0.76, 0.96])) * [g_w, g_h]

    src_pts = np.float32([src_nl, src_nr, src_sl, src_sr, src_al, src_ar, src_hl, src_hr])
    dst_pts = np.float32([
        target_neck_left, target_neck_right,
        target_shoulder_left, target_shoulder_right,
        target_armpit_left, target_armpit_right,
        target_hem_left, target_hem_right
    ])

    # 1. TPS Remapping on Bounding Region
    min_x = max(0, int(np.min(dst_pts[:, 0]) - shoulder_dist * 0.3))
    max_x = min(img_w, int(np.max(dst_pts[:, 0]) + shoulder_dist * 0.3))
    min_y = max(0, int(np.min(dst_pts[:, 1]) - shoulder_dist * 0.2))
    max_y = min(img_h, int(np.max(dst_pts[:, 1]) + shoulder_dist * 0.2))
    box_w = max(10, max_x - min_x)
    box_h = max(10, max_y - min_y)

    grid_dim = 36
    gy, gx = np.mgrid[min_y:max_y:complex(0, grid_dim), min_x:max_x:complex(0, grid_dim)]
    query_pts = np.column_stack([gx.ravel(), gy.ravel()])

    rbf_x = interp.RBFInterpolator(dst_pts, src_pts[:, 0], kernel='thin_plate_spline')
    rbf_y = interp.RBFInterpolator(dst_pts, src_pts[:, 1], kernel='thin_plate_spline')

    coarse_mx = rbf_x(query_pts).reshape(grid_dim, grid_dim).astype(np.float32)
    coarse_my = rbf_y(query_pts).reshape(grid_dim, grid_dim).astype(np.float32)

    crop_map_x = cv2.resize(coarse_mx, (box_w, box_h), interpolation=cv2.INTER_CUBIC)
    crop_map_y = cv2.resize(coarse_my, (box_w, box_h), interpolation=cv2.INTER_CUBIC)

    warped_torso_crop = cv2.remap(garment_rgba, crop_map_x, crop_map_y, cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))

    warped_rgba = np.zeros((img_h, img_w, 4), dtype=np.uint8)
    warped_rgba[min_y:max_y, min_x:max_x] = warped_torso_crop

    # 2. Separate Sleeve Warping along Arms (11->13->15 and 12->14->16) (TASK 3)
    armpit_l_x = int(src_al[0])
    armpit_r_x = int(src_ar[0])

    if len(landmarks) > 16:
        p13_x, p13_y, _ = get_lm_coord(landmarks[13])
        p14_x, p14_y, _ = get_lm_coord(landmarks[14])
        p15_x, p15_y, _ = get_lm_coord(landmarks[15])
        p16_x, p16_y, _ = get_lm_coord(landmarks[16])
        p13 = np.array([p13_x * img_w, p13_y * img_h], dtype=np.float32)
        p14 = np.array([p14_x * img_w, p14_y * img_h], dtype=np.float32)
        p15 = np.array([p15_x * img_w, p15_y * img_h], dtype=np.float32)
        p16 = np.array([p16_x * img_w, p16_y * img_h], dtype=np.float32)

        # Left Sleeve Affine
        src_left_sleeve = np.float32([[0, 0], [armpit_l_x, 0], [armpit_l_x, int(g_h * 0.65)]])
        dst_left_sleeve = np.float32([target_shoulder_left, target_armpit_left, p13])
        M_left = cv2.getAffineTransform(src_left_sleeve, dst_left_sleeve)
        warped_left_sleeve = cv2.warpAffine(garment_rgba[:, :armpit_l_x], M_left, (img_w, img_h), borderValue=(0, 0, 0, 0))

        # Right Sleeve Affine
        src_right_sleeve = np.float32([[armpit_r_x, 0], [g_w, 0], [armpit_r_x, int(g_h * 0.65)]])
        dst_right_sleeve = np.float32([target_armpit_right, target_shoulder_right, p14])
        M_right = cv2.getAffineTransform(src_right_sleeve, dst_right_sleeve)
        warped_right_sleeve = cv2.warpAffine(garment_rgba[:, armpit_r_x:], M_right, (img_w, img_h), borderValue=(0, 0, 0, 0))

        warped_rgba = _alpha_composite(_alpha_composite(warped_rgba, warped_left_sleeve), warped_right_sleeve)

    # 3. Soft Drop Shadow (offset 6px down, opacity 0.25) (TASK 5)
    shadow_offset_y = 6
    raw_alpha = warped_rgba[:, :, 3].astype(np.float32) / 255.0
    shadow_mask = np.zeros_like(raw_alpha)
    if shadow_offset_y < img_h:
        shadow_mask[shadow_offset_y:, :] = raw_alpha[:-shadow_offset_y, :] * 0.25
    shadow_mask = cv2.GaussianBlur(shadow_mask, (15, 15), 0)

    # Apply shadow to frame
    frame_shadowed = (frame.astype(np.float32) * (1.0 - np.dstack([shadow_mask] * 3))).astype(np.uint8)

    # 4. Soft Edge Feathering GaussianBlur(7,7) (TASK 5)
    feathered_alpha = cv2.GaussianBlur(raw_alpha, (7, 7), 0)

    # 5. MediaPipe Segmentation Occlusion: Keep face, hair, and foreground hands ABOVE dress
    occlusion_mask = generate_occlusion_mask(landmarks, img_h, img_w, shoulder_dist)
    effective_alpha = np.clip(feathered_alpha * (1.0 - occlusion_mask), 0.0, 1.0)

    # 6. LAB Color Lighting Match (TASK 5)
    matched_bgr = match_lighting_lab(frame_shadowed, warped_rgba[:, :, :3], effective_alpha)

    # 7. Alpha Blend with Feathered Mask
    effective_3ch = np.dstack([effective_alpha] * 3)
    blended_frame = (frame_shadowed.astype(np.float32) * (1.0 - effective_3ch) + matched_bgr.astype(np.float32) * effective_3ch).astype(np.uint8)
    return blended_frame


# -----------------------------------------------------------------------------
# 5. HUD & User Interface Layer
# -----------------------------------------------------------------------------
def draw_hud(
    frame: np.ndarray,
    garment: dict,
    current_idx: int,
    total_garments: int,
    height_cm: float,
    mode: str,
    size_info: dict = None,
    show_size: bool = True,
    quality_status: dict = None,
    selected_size: str = "M"
) -> None:
    """Render top header bar, quality gate guidance, and recommended sizing."""
    h, w = frame.shape[:2]
    overlay = frame.copy()

    # Top Header
    cv2.rectangle(overlay, (0, 0), (w, 64), (17, 24, 39), -1)
    cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)

    title = f"{garment['brand']} - {garment['name']} [{garment['category']}] ({current_idx + 1}/{total_garments})"
    cv2.putText(frame, title, (20, 38), cv2.FONT_HERSHEY_SIMPLEX, 0.70, (255, 255, 255), 2, cv2.LINE_AA)

    badge = f"Mode: {mode.upper()} | Fit Size: {selected_size} | H: {height_cm:.0f}cm"
    cv2.putText(frame, badge, (w - 440, 38), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (140, 240, 160), 2, cv2.LINE_AA)

    # Quality Gate Guidance Banner (Task 1)
    if quality_status:
        banner_color = (16, 185, 129) if quality_status.get("passed") else (239, 68, 68)
        guidance_text = quality_status.get("guidance", "Quality Check")
        cv2.rectangle(overlay, (20, 75), (w - 20, 105), (15, 23, 42), -1)
        cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)
        cv2.rectangle(frame, (20, 75), (w - 20, 105), banner_color, 2)
        cv2.putText(frame, f"[QUALITY GATE] {guidance_text}", (35, 96), cv2.FONT_HERSHEY_SIMPLEX, 0.55, banner_color, 2, cv2.LINE_AA)

    # Size Analysis Card Overlay (Press S to toggle)
    if show_size and size_info is not None:
        card_w, card_h = 360, 105
        card_x, card_y = 20, 120
        cv2.rectangle(overlay, (card_x, card_y), (card_x + card_w, card_y + card_h), (30, 41, 59), -1)
        cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)
        cv2.rectangle(frame, (card_x, card_y), (card_x + card_w, card_y + card_h), (59, 130, 246), 2)

        size_text = f"Recommended (Median 30f): {size_info['size']}"
        cv2.putText(frame, size_text, (card_x + 15, card_y + 32), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2, cv2.LINE_AA)

        metrics_text = f"Chest: {size_info['chest_cm']:.1f}cm | Waist: {size_info['waist_cm']:.1f}cm"
        cv2.putText(frame, metrics_text, (card_x + 15, card_y + 60), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (203, 213, 225), 1, cv2.LINE_AA)

        sh_text = f"Shoulder: {size_info['shoulder_cm']:.1f}cm | Fit Factor: {SIZE_FACTORS.get(selected_size, 1.45):.2f}x"
        cv2.putText(frame, sh_text, (card_x + 15, card_y + 86), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (148, 163, 184), 1, cv2.LINE_AA)

    # Controls footer banner
    footer_text = "[N/P] Garment  [C] Category  [1-4] Size S/M/L/XL  [S] Size HUD  [Q] Quit"
    cv2.rectangle(overlay, (0, h - 36), (w, h), (17, 24, 39), -1)
    cv2.addWeighted(overlay, 0.65, frame, 0.35, 0, frame)
    cv2.putText(frame, footer_text, (20, h - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (200, 220, 255), 1, cv2.LINE_AA)


# -----------------------------------------------------------------------------
# 6. Execution Modes (Photo Mode & Live Camera Mode)
# -----------------------------------------------------------------------------
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
    smoother = LandmarkSmoother(alpha=0.35)
    sizer = RollingMedianSizer(capacity=30)

    raw_landmarks = detector.detect(base_frame)
    smoothed_landmarks = smoother.update(raw_landmarks) if raw_landmarks else None

    current_index = 0
    selected_size = "M"
    show_size = True
    window_name = "AURA Virtual Trial Room [PHOTO MODE]"

    while True:
        display_frame = base_frame.copy()
        garment = GARMENTS[current_index]
        garment_rgba = load_garment_image(garment["file"])
        h, w = display_frame.shape[:2]

        size_info = None
        quality_status = None

        if smoothed_landmarks:
            quality_status = check_quality_gate(smoothed_landmarks, h, w)
            size_info = sizer.update(smoothed_landmarks, h, w, user_height_cm, garment["category"])
            display_frame = warp_garment_tps(display_frame, garment_rgba, smoothed_landmarks, garment, selected_size=selected_size)

        draw_hud(
            display_frame,
            garment,
            current_index,
            len(GARMENTS),
            user_height_cm,
            mode="Photo Upload",
            size_info=size_info,
            show_size=show_size,
            quality_status=quality_status,
            selected_size=selected_size
        )

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
        elif key == ord('1'):
            selected_size = "S"
        elif key == ord('2'):
            selected_size = "M"
        elif key == ord('3'):
            selected_size = "L"
        elif key == ord('4'):
            selected_size = "XL"

    cv2.destroyAllWindows()


def run_camera_mode(user_height_cm: float):
    """Run Virtual Trial Room in real-time on live camera feed."""
    detector = PoseDetector()
    smoother = LandmarkSmoother(alpha=0.35, lock_ms=100.0)
    sizer = RollingMedianSizer(capacity=30)

    current_index = 0
    selected_size = "M"
    show_size = True
    cap = cv2.VideoCapture(0)
    window_name = "AURA Virtual Trial Room [LIVE CAMERA]"

    if not cap.isOpened():
        print("[!] Warning: Could not open camera 0. Falling back to synthetic canvas.")
        frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        while True:
            display_frame = frame.copy()
            garment = GARMENTS[current_index]
            draw_hud(
                display_frame,
                garment,
                current_index,
                len(GARMENTS),
                user_height_cm,
                mode="Camera Fallback",
                show_size=show_size,
                selected_size=selected_size
            )
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
        smoothed_landmarks = smoother.update(raw_landmarks)

        size_info = None
        quality_status = None

        if smoothed_landmarks:
            quality_status = check_quality_gate(smoothed_landmarks, h, w)
            size_info = sizer.update(smoothed_landmarks, h, w, user_height_cm, garment["category"])
            frame = warp_garment_tps(frame, garment_rgba, smoothed_landmarks, garment, selected_size=selected_size)

        draw_hud(
            frame,
            garment,
            current_index,
            len(GARMENTS),
            user_height_cm,
            mode="Live Camera",
            size_info=size_info,
            show_size=show_size,
            quality_status=quality_status,
            selected_size=selected_size
        )

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
        elif key == ord('1'):
            selected_size = "S"
        elif key == ord('2'):
            selected_size = "M"
        elif key == ord('3'):
            selected_size = "L"
        elif key == ord('4'):
            selected_size = "XL"

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
