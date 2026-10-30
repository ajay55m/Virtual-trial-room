"""
AURA Virtual Trial Room - Image & Canvas Processing Utilities
Provides robust alpha blending, boundary clipping, and UI rendering on OpenCV frames.
"""

import cv2
import numpy as np
from typing import Tuple, Optional
import config

def overlay_transparent(
    background: np.ndarray,
    overlay: np.ndarray,
    x: int,
    y: int,
    target_width: Optional[int] = None,
    target_height: Optional[int] = None
) -> np.ndarray:
    """
    Overlays a 4-channel RGBA image onto a 3-channel BGR background image at (x, y).
    Includes boundary clipping so coordinates partially or fully off-screen will not crash.
    """
    if overlay is None or background is None:
        return background

    # Resize overlay if dimensions specified
    if target_width is not None and target_height is not None:
        if target_width <= 0 or target_height <= 0:
            return background
        overlay = cv2.resize(overlay, (target_width, target_height), interpolation=cv2.INTER_AREA)

    h_bg, w_bg, _ = background.shape
    h_ov, w_ov = overlay.shape[:2]

    # Quick rejection if completely out of bounds
    if x >= w_bg or y >= h_bg or (x + w_ov) <= 0 or (y + h_ov) <= 0:
        return background

    # Compute valid overlap box on background
    x1_bg = max(0, x)
    y1_bg = max(0, y)
    x2_bg = min(w_bg, x + w_ov)
    y2_bg = min(h_bg, y + h_ov)

    # Compute valid slice on overlay image
    x1_ov = max(0, -x)
    y1_ov = max(0, -y)
    x2_ov = x1_ov + (x2_bg - x1_bg)
    y2_ov = y1_ov + (y2_bg - y1_bg)

    # Extract regions of interest
    bg_roi = background[y1_bg:y2_bg, x1_bg:x2_bg]
    ov_roi = overlay[y1_ov:y2_ov, x1_ov:x2_ov]

    if ov_roi.shape[2] == 4:
        # 4-channel image: extract BGR and normalized Alpha
        ov_bgr = ov_roi[:, :, :3]
        alpha = ov_roi[:, :, 3].astype(float) / 255.0
        alpha = np.expand_dims(alpha, axis=2)

        # Alpha composite blend
        blended = (alpha * ov_bgr + (1.0 - alpha) * bg_roi).astype(np.uint8)
        background[y1_bg:y2_bg, x1_bg:x2_bg] = blended
    else:
        # 3-channel direct copy
        background[y1_bg:y2_bg, x1_bg:x2_bg] = ov_roi[:, :, :3]

    return background


def draw_header_bar(frame: np.ndarray, title: str = "AURA LUXURY VIRTUAL FITTING STUDIO") -> np.ndarray:
    """Draws luxury dark header bar at the top of the frame."""
    h, w, _ = frame.shape
    header_h = 64
    
    # Dark glassmorphism rectangle
    sub_img = frame[0:header_h, 0:w]
    dark_rect = np.full(sub_img.shape, config.COLOR_DARK_BG, dtype=np.uint8)
    blended = cv2.addWeighted(sub_img, 0.20, dark_rect, 0.80, 0)
    frame[0:header_h, 0:w] = blended

    # Bottom border line
    cv2.line(frame, (0, header_h), (w, header_h), (60, 60, 60), 1)

    # Brand Title
    cv2.putText(frame, "AURA", (30, 42), cv2.FONT_HERSHEY_DUPLEX, 0.85, config.COLOR_WHITE, 2, cv2.LINE_AA)
    cv2.putText(frame, "|  VIRTUAL TRIAL STUDIO", (115, 41), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (160, 160, 160), 1, cv2.LINE_AA)

    # Status Pill Right
    status_text = "AI POSE ENGINE ACTIVE"
    cv2.circle(frame, (w - 230, 32), 6, config.COLOR_SUCCESS_GREEN, -1)
    cv2.putText(frame, status_text, (w - 210, 37), cv2.FONT_HERSHEY_SIMPLEX, 0.45, config.COLOR_WHITE, 1, cv2.LINE_AA)

    return frame


def draw_footer_bar(frame: np.ndarray, recommended_size: str, fit_status: str = "Honest Fit") -> np.ndarray:
    """Renders bottom size indicator badge."""
    h, w, _ = frame.shape
    badge_w, badge_h = 240, 44
    bx = (w - badge_w) // 2
    by = h - 60

    # Rounded pill background
    cv2.rectangle(frame, (bx, by), (bx + badge_w, by + badge_h), config.COLOR_PRIMARY_BLUE, -1)
    cv2.rectangle(frame, (bx, by), (bx + badge_w, by + badge_h), config.COLOR_WHITE, 1)

    text = f"SIZE: {recommended_size}  |  {fit_status}"
    cv2.putText(frame, text, (bx + 20, by + 28), cv2.FONT_HERSHEY_SIMPLEX, 0.55, config.COLOR_WHITE, 2, cv2.LINE_AA)
    return frame


def draw_virtual_button(
    frame: np.ndarray,
    pos: Tuple[int, int],
    size: Tuple[int, int],
    label: str,
    direction: str = "left",
    progress: float = 0.0,
    is_active: bool = False
) -> np.ndarray:
    """Renders virtual gesture button with circular progress fill."""
    x, y = pos
    bw, bh = size

    # Background card
    sub = frame[y:y+bh, x:x+bw]
    card_color = config.COLOR_PRIMARY_BLUE if is_active else config.COLOR_DARK_BG
    color_rect = np.full(sub.shape, card_color, dtype=np.uint8)
    frame[y:y+bh, x:x+bw] = cv2.addWeighted(sub, 0.35, color_rect, 0.65, 0)
    cv2.rectangle(frame, (x, y), (x + bw, y + bh), config.COLOR_WHITE if is_active else (100, 100, 100), 2)

    # Arrow direction
    cx = x + bw // 2
    cy = y + bh // 2 - 8
    arrow_color = config.COLOR_WHITE

    if direction == "left":
        pts = np.array([[cx + 15, cy - 20], [cx - 15, cy], [cx + 15, cy + 20]], np.int32)
    else:
        pts = np.array([[cx - 15, cy - 20], [cx + 15, cy], [cx - 15, cy + 20]], np.int32)
    cv2.polylines(frame, [pts], isClosed=False, color=arrow_color, thickness=3)

    # Label Text
    cv2.putText(frame, label, (x + 16, y + bh - 16), cv2.FONT_HERSHEY_SIMPLEX, 0.45, config.COLOR_WHITE, 1, cv2.LINE_AA)

    # Circular progress arc if hovered
    if progress > 0.0:
        radius = 24
        cv2.circle(frame, (cx, cy), radius, (80, 80, 80), 2)
        angle = int(360 * min(1.0, progress))
        cv2.ellipse(frame, (cx, cy), (radius, radius), -90, 0, angle, config.COLOR_SUCCESS_GREEN, 3)

    return frame


def draw_safe_zone(frame: np.ndarray, compliant: bool = True) -> np.ndarray:
    """Draws subtle guide brackets for the safe trial zone."""
    x1, y1 = config.SAFE_ZONE_X_MIN, config.SAFE_ZONE_Y_MIN
    x2, y2 = config.SAFE_ZONE_X_MAX, config.SAFE_ZONE_Y_MAX
    color = config.COLOR_SUCCESS_GREEN if compliant else (120, 120, 120)
    bracket_len = 30

    # Top-Left
    cv2.line(frame, (x1, y1), (x1 + bracket_len, y1), color, 2)
    cv2.line(frame, (x1, y1), (x1, y1 + bracket_len), color, 2)

    # Top-Right
    cv2.line(frame, (x2, y1), (x2 - bracket_len, y1), color, 2)
    cv2.line(frame, (x2, y1), (x2, y1 + bracket_len), color, 2)

    # Bottom-Left
    cv2.line(frame, (x1, y2), (x1 + bracket_len, y2), color, 2)
    cv2.line(frame, (x1, y2), (x1, y2 - bracket_len), color, 2)

    # Bottom-Right
    cv2.line(frame, (x2, y2), (x2 - bracket_len, y2), color, 2)
    cv2.line(frame, (x2, y2), (x2, y2 - bracket_len), color, 2)

    return frame

