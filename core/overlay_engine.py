"""
AURA Virtual Trial Room - Garment Overlay Engine
Executes anatomical coordinate calculations, aspect ratio scaling,
anti-jitter temporal smoothing, and transparent alpha blending onto camera frames.
Complies with requirements FR-03, FR-05, and Algorithm Design Section 7.
"""

import cv2
import numpy as np
import math
from typing import Dict, Tuple, Optional, Any
import config
from core.smoothing import EMACoordinateSmoother
from utils.image_utils import overlay_transparent
from utils.logger import logger, log_error

class OverlayEngine:
    """
    Renders 2D clothing onto human body landmarks using exact geometric ratios:
    - Fixed Ratio Scale: 262 / 190 (~1.3789)
    - Garment Aspect Ratio: 581 / 440 (~1.3204)
    - Offset Factors: X = 0.38, Y = 0.22
    - Anti-Jitter EMA Smoothing
    """

    def __init__(self):
        self.smoother = EMACoordinateSmoother(
            prev_weight=config.SMOOTH_PREV_WEIGHT,
            current_weight=config.SMOOTH_CURRENT_WEIGHT,
            max_discontinuity=config.MAX_DISCONTINUITY_PX
        )
        self.fixed_ratio = config.FIXED_RATIO_SCALE
        self.aspect_ratio = config.SHIRT_ASPECT_RATIO

    def reset(self):
        """Resets the smoothing filter state."""
        self.smoother.reset()

    def calculate_size_and_position(
        self,
        lm11: Dict[str, Any],
        lm12: Dict[str, Any]
    ) -> Tuple[int, int, int, int, float, float]:
        """
        Computes the target width, height, and (x, y) offset for the garment
        based on the detected shoulder keypoints.
        Returns: (smooth_x, smooth_y, smooth_w, smooth_h, shoulder_width, tilt_degrees)
        """
        x11, y11 = float(lm11["x"]), float(lm11["y"])
        x12, y12 = float(lm12["x"]), float(lm12["y"])

        # Order keypoints: left shoulder to right shoulder on canvas
        left_x, left_y = (x11, y11) if x11 <= x12 else (x12, y12)
        right_x, right_y = (x12, y12) if x11 <= x12 else (x11, y11)

        # 1. Euclidean distance between shoulders (ShoulderWidth_px)
        dx = right_x - left_x
        dy = right_y - left_y
        shoulder_width = math.sqrt(dx * dx + dy * dy)

        # Angular tilt
        tilt_radians = math.atan2(dy, dx)
        tilt_degrees = math.degrees(tilt_radians)

        # 2. Scaling Factors
        # ShirtWidth = ShoulderWidth_px * (262 / 190)
        raw_shirt_width = shoulder_width * self.fixed_ratio

        # ShirtHeight = ShirtWidth * (581 / 440)
        raw_shirt_height = raw_shirt_width * self.aspect_ratio

        # 3. Offsets:
        # OffsetX = left_x - (ShirtWidth * 0.38)
        # OffsetY = left_y - (ShirtHeight * 0.22)
        raw_x = left_x - (raw_shirt_width * config.OFFSET_FACTOR_X)
        raw_y = left_y - (raw_shirt_height * config.OFFSET_FACTOR_Y)

        # 4. Anti-Jitter EMA Smoothing: Smooth = Prev * 0.75 + Current * 0.25
        smooth_x, smooth_y, smooth_w, smooth_h = self.smoother.smooth(
            raw_x, raw_y, raw_shirt_width, raw_shirt_height
        )

        return smooth_x, smooth_y, smooth_w, smooth_h, shoulder_width, tilt_degrees

    def overlay_garment(
        self,
        frame: np.ndarray,
        garment_img: np.ndarray,
        lm11: Dict[str, Any],
        lm12: Dict[str, Any],
        apply_rotation: bool = True
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Blends the transparent garment PNG onto the video frame at the calculated coordinates.
        Returns the modified frame and telemetry dictionary.
        """
        if garment_img is None:
            log_error("E103", "Garment image buffer is empty")
            return frame, {"aligned": False}

        (
            pos_x,
            pos_y,
            target_w,
            target_h,
            shoulder_width,
            tilt_degrees
        ) = self.calculate_size_and_position(lm11, lm12)

        # Safeguard against degenerate bounds
        if target_w <= 10 or target_h <= 10:
            return frame, {"aligned": False}

        # Resize garment
        resized_garment = cv2.resize(
            garment_img,
            (target_w, target_h),
            interpolation=cv2.INTER_AREA
        )

        # Optional subtle tilt rotation compensation (if tilt > 2 degrees)
        if apply_rotation and abs(tilt_degrees) > 2.0:
            # Collar center in resized image coordinates
            collar_cx = int(target_w * 0.50)
            collar_cy = int(target_h * config.OFFSET_FACTOR_Y)
            
            rot_matrix = cv2.getRotationMatrix2D((collar_cx, collar_cy), -tilt_degrees, 1.0)
            resized_garment = cv2.warpAffine(
                resized_garment,
                rot_matrix,
                (target_w, target_h),
                flags=cv2.INTER_LINEAR,
                borderMode=cv2.BORDER_CONSTANT,
                borderValue=(0, 0, 0, 0)
            )

        # Composite onto frame using boundary-safe alpha blending
        frame = overlay_transparent(
            background=frame,
            overlay=resized_garment,
            x=pos_x,
            y=pos_y
        )

        telemetry = {
            "aligned": True,
            "shoulder_width_px": round(shoulder_width, 1),
            "target_w": target_w,
            "target_h": target_h,
            "pos_x": pos_x,
            "pos_y": pos_y,
            "tilt_degrees": round(tilt_degrees, 1)
        }

        return frame, telemetry

