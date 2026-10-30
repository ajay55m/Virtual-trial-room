"""
AURA Virtual Trial Room - Coordinate & Temporal Smoothing Filters
Implements Exponential Moving Average (EMA) and OneEuroFilter to eliminate landmark jitter.
"""

import math
import time
from typing import Tuple, Optional
import config

class OneEuroFilter:
    """
    1€ Filter: Adaptive low-pass filter that balances low jitter at low speeds
    with low lag at high speeds.
    """
    def __init__(self, min_cutoff: float = 1.0, beta: float = 0.05, d_cutoff: float = 1.0):
        self.min_cutoff = min_cutoff
        self.beta = beta
        self.d_cutoff = d_cutoff
        self.x_prev: Optional[float] = None
        self.dx_prev: float = 0.0
        self.t_prev: Optional[float] = None

    def _smoothing_factor(self, t_e: float, cutoff: float) -> float:
        r = 2 * math.pi * cutoff * t_e
        return r / (r + 1)

    def filter(self, x: float, timestamp: Optional[float] = None) -> float:
        t = timestamp if timestamp is not None else time.time()
        if self.t_prev is None:
            self.x_prev = x
            self.dx_prev = 0.0
            self.t_prev = t
            return x

        t_e = max(1e-4, t - self.t_prev)
        self.t_prev = t

        # Velocity estimation
        dx = (x - (self.x_prev if self.x_prev is not None else x)) / t_e
        a_d = self._smoothing_factor(t_e, self.d_cutoff)
        dx_hat = a_d * dx + (1.0 - a_d) * self.dx_prev
        self.dx_prev = dx_hat

        # Dynamic cutoff frequency
        cutoff = self.min_cutoff + self.beta * abs(dx_hat)
        a = self._smoothing_factor(t_e, cutoff)
        x_hat = a * x + (1.0 - a) * (self.x_prev if self.x_prev is not None else x)
        self.x_prev = x_hat
        return x_hat

    def reset(self):
        self.x_prev = None
        self.dx_prev = 0.0
        self.t_prev = None


class EMACoordinateSmoother:
    """
    Exponential Moving Average coordinate smoother with discontinuity detection.
    Prevents garment jitter during micro-movements while responding immediately
    to fast repositioning or subject changes.
    """
    def __init__(
        self,
        prev_weight: float = config.SMOOTH_PREV_WEIGHT,
        current_weight: float = config.SMOOTH_CURRENT_WEIGHT,
        max_discontinuity: float = config.MAX_DISCONTINUITY_PX
    ):
        self.prev_weight = prev_weight
        self.current_weight = current_weight
        self.max_discontinuity = max_discontinuity
        self.prev_coords: Optional[Tuple[float, float, float, float]] = None

    def smooth(self, x: float, y: float, w: float, h: float) -> Tuple[int, int, int, int]:
        """
        Smooths (x, y, w, h) bounding box coordinates.
        Returns integer pixel values.
        """
        if self.prev_coords is None:
            self.prev_coords = (x, y, w, h)
            return int(round(x)), int(round(y)), int(round(w)), int(round(h))

        px, py, pw, ph = self.prev_coords

        # Check for large distance jump
        dist = math.hypot(x - px, y - py)
        if dist > self.max_discontinuity:
            # Subject jumped or re-entered: reset filter
            self.prev_coords = (x, y, w, h)
            return int(round(x)), int(round(y)), int(round(w)), int(round(h))

        # Standard weighted smoothing: Smooth = Prev * 0.75 + Current * 0.25
        sx = px * self.prev_weight + x * self.current_weight
        sy = py * self.prev_weight + y * self.current_weight
        sw = pw * self.prev_weight + w * self.current_weight
        sh = ph * self.prev_weight + h * self.current_weight

        self.prev_coords = (sx, sy, sw, sh)
        return int(round(sx)), int(round(sy)), int(round(sw)), int(round(sh))

    def reset(self):
        """Resets the filter state."""
        self.prev_coords = None

