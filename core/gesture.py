"""
AURA Virtual Trial Room - Hand Gesture Controller
Tracks hand keypoints hovering over virtual buttons for 30 consecutive frames.
Complies with requirement FR-04 and Interaction Design Section 8.
"""

from typing import List, Dict, Tuple, Optional, Any
import config

class GestureController:
    """
    Evaluates hand/wrist keypoint positions against virtual on-screen buttons.
    Implements a 30-frame dwell-time filter to prevent accidental switches.
    """

    def __init__(
        self,
        hold_frames: int = config.GESTURE_HOLD_FRAMES,
        cooldown_frames: int = config.GESTURE_COOLDOWN_FRAMES
    ):
        self.hold_frames = hold_frames
        self.cooldown_frames = cooldown_frames

        self.left_counter = 0
        self.right_counter = 0
        self.cooldown_timer = 0

    def _is_point_inside_box(self, px: int, py: int, box_pos: Tuple[int, int], box_size: Tuple[int, int]) -> bool:
        bx, by = box_pos
        bw, bh = box_size
        return (bx <= px <= bx + bw) and (by <= py <= by + bh)

    def update(self, lm_list: List[Dict[str, Any]]) -> Tuple[Optional[str], float, float]:
        """
        Updates gesture tracker with the latest frame landmarks.
        Returns:
            triggered_action: 'prev', 'next', or None
            left_progress: float [0.0, 1.0]
            right_progress: float [0.0, 1.0]
        """
        if self.cooldown_timer > 0:
            self.cooldown_timer -= 1
            self.left_counter = 0
            self.right_counter = 0
            return None, 0.0, 0.0

        if len(lm_list) < 21:
            self.left_counter = max(0, self.left_counter - 2)
            self.right_counter = max(0, self.right_counter - 2)
            return None, 0.0, 0.0

        # Candidate control landmarks:
        # 15: Left Wrist, 16: Right Wrist
        # 19: Left Index, 20: Right Index
        candidates = []
        for idx in [15, 16, 19, 20]:
            if idx < len(lm_list) and lm_list[idx]["visibility"] > 0.40:
                candidates.append((lm_list[idx]["x"], lm_list[idx]["y"]))

        hover_left = False
        hover_right = False

        for cx, cy in candidates:
            if self._is_point_inside_box(cx, cy, config.LEFT_BUTTON_POS, (config.BUTTON_WIDTH, config.BUTTON_HEIGHT)):
                hover_left = True
            if self._is_point_inside_box(cx, cy, config.RIGHT_BUTTON_POS, (config.BUTTON_WIDTH, config.BUTTON_HEIGHT)):
                hover_right = True

        triggered = None

        # Update Left Button (Prev)
        if hover_left:
            self.left_counter += 1
            if self.left_counter >= self.hold_frames:
                triggered = "prev"
                self.left_counter = 0
                self.cooldown_timer = self.cooldown_frames
        else:
            self.left_counter = max(0, self.left_counter - 2)

        # Update Right Button (Next)
        if hover_right:
            self.right_counter += 1
            if self.right_counter >= self.hold_frames:
                triggered = "next"
                self.right_counter = 0
                self.cooldown_timer = self.cooldown_frames
        else:
            self.right_counter = max(0, self.right_counter - 2)

        left_prog = min(1.0, self.left_counter / float(self.hold_frames))
        right_prog = min(1.0, self.right_counter / float(self.hold_frames))

        return triggered, left_prog, right_prog

    def reset(self):
        """Resets gesture counters."""
        self.left_counter = 0
        self.right_counter = 0
        self.cooldown_timer = 0

