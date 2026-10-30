"""
AURA Virtual Trial Room - Unit Test Suite
Verifies geometric calculations, EMA smoothing, boundary clipping, and sizing.
Complies with Testing Design Section 13.
"""

import os
import sys
import math
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
from core.overlay_engine import OverlayEngine
from core.smoothing import EMACoordinateSmoother, OneEuroFilter
from utils.image_utils import overlay_transparent
from services.shirt_service import ShirtService


def test_overlay_geometric_scaling():
    """Verifies that shoulder distance is correctly multiplied by 262/190 and 581/440."""
    engine = OverlayEngine()

    lm11 = {"x": 500, "y": 300, "visibility": 0.95}
    lm12 = {"x": 690, "y": 300, "visibility": 0.95}

    pos_x, pos_y, target_w, target_h, shoulder_width, tilt = engine.calculate_size_and_position(lm11, lm12)

    expected_shoulder_w = 190.0
    expected_shirt_w = 190.0 * (262.0 / 190.0)  # exactly 262.0
    expected_shirt_h = expected_shirt_w * (581.0 / 440.0)  # ~346.06

    assert abs(shoulder_width - expected_shoulder_w) < 1e-4
    assert abs(target_w - int(round(expected_shirt_w))) <= 1
    assert abs(target_h - int(round(expected_shirt_h))) <= 1
    assert abs(tilt - 0.0) < 1e-4


def test_ema_coordinate_smoother():
    """Verifies EMA formula: Smooth = Prev * 0.75 + Current * 0.25."""
    smoother = EMACoordinateSmoother(prev_weight=0.75, current_weight=0.25)

    # Initial frame
    x1, y1, w1, h1 = smoother.smooth(100.0, 100.0, 200.0, 200.0)
    assert (x1, y1, w1, h1) == (100, 100, 200, 200)

    # Second frame with slight shift
    x2, y2, w2, h2 = smoother.smooth(120.0, 120.0, 200.0, 200.0)
    # Expected x = 100 * 0.75 + 120 * 0.25 = 75 + 30 = 105
    assert x2 == 105
    assert y2 == 105


def test_discontinuity_reset():
    """Verifies that large distance jumps (> 20% canvas width) reset the filter immediately."""
    smoother = EMACoordinateSmoother(max_discontinuity=200.0)
    smoother.smooth(100.0, 100.0, 200.0, 200.0)

    # Big jump beyond 200px threshold
    xj, yj, wj, hj = smoother.smooth(500.0, 500.0, 200.0, 200.0)
    assert (xj, yj) == (500, 500)


def test_boundary_safe_overlay():
    """Verifies that rendering partially or fully off-screen coordinates does not raise errors."""
    bg = np.zeros((720, 1280, 3), dtype=np.uint8)
    ov = np.ones((200, 200, 4), dtype=np.uint8) * 255

    # Completely off-screen left and top
    res1 = overlay_transparent(bg.copy(), ov, x=-300, y=-300)
    assert res1.shape == bg.shape

    # Completely off-screen right and bottom
    res2 = overlay_transparent(bg.copy(), ov, x=1500, y=900)
    assert res2.shape == bg.shape

    # Partially clipped on edge
    res3 = overlay_transparent(bg.copy(), ov, x=1200, y=650)
    assert res3.shape == bg.shape


def test_sizing_recommendation():
    """Verifies size classification according to shoulder width thresholds."""
    service = ShirtService()
    assert service.recommend_size(170) == "XS"
    assert service.recommend_size(200) == "S"
    assert service.recommend_size(230) == "M"
    assert service.recommend_size(270) == "L"
    assert service.recommend_size(330) == "XL"


if __name__ == "__main__":
    test_overlay_geometric_scaling()
    test_ema_coordinate_smoother()
    test_discontinuity_reset()
    test_boundary_safe_overlay()
    test_sizing_recommendation()
    print("All 5 unit tests passed successfully!")
