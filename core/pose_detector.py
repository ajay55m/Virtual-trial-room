"""
AURA Virtual Trial Room - MediaPipe Pose Detection Service
Detects 33 anatomical 3D body keypoints using BlazePose (Tasks Vision API).
Complies with requirement FR-02 and error handling (E102).
"""

import os
import cv2
import numpy as np
from typing import List, Dict, Tuple, Optional, Any
import config
from utils.logger import logger, log_error

MP_TASKS_AVAILABLE = False
try:
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision as mp_vision
    MP_TASKS_AVAILABLE = True
except ImportError:
    MP_TASKS_AVAILABLE = False


class PoseDetector:
    """
    BlazePose Landmark Detector wrapping MediaPipe Tasks Vision.
    Extracts 33 3D normalized body landmarks and translates them to canvas pixel coordinates.
    """
    def __init__(
        self,
        model_path: Optional[str] = None,
        smooth: bool = True,
        detection_con: float = 0.5,
        track_con: float = 0.5
    ):
        self.smooth = smooth
        self.detection_con = detection_con
        self.track_con = track_con
        self.detector = None
        self.latest_landmarks = None

        if MP_TASKS_AVAILABLE:
            if not model_path:
                model_path = os.path.abspath(
                    os.path.join(config.BASE_DIR, "frontend", "public", "models", "pose_landmarker_lite.task")
                )

            if os.path.exists(model_path):
                try:
                    base_options = mp_python.BaseOptions(model_asset_path=model_path)
                    options = mp_vision.PoseLandmarkerOptions(
                        base_options=base_options,
                        running_mode=mp_vision.RunningMode.IMAGE,
                        num_poses=1,
                        min_pose_detection_confidence=self.detection_con
                    )
                    self.detector = mp_vision.PoseLandmarker.create_from_options(options)
                    logger.info(f"Loaded MediaPipe PoseLandmarker model from {model_path}")
                except Exception as e:
                    logger.warning(f"Could not load MediaPipe task options: {e}")
            else:
                logger.warning(f"Pose task model not found at {model_path}")

    def find_pose(self, img: np.ndarray, draw: bool = False) -> np.ndarray:
        """Processes BGR image and extracts pose landmarks."""
        if self.detector is None:
            return img

        try:
            # Convert OpenCV BGR to MediaPipe Image
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)
            result = self.detector.detect(mp_image)

            if result and result.pose_landmarks and len(result.pose_landmarks) > 0:
                self.latest_landmarks = result.pose_landmarks[0]
                if draw:
                    h, w, _ = img.shape
                    for lm in self.latest_landmarks:
                        cx, cy = int(lm.x * w), int(lm.y * h)
                        cv2.circle(img, (cx, cy), 3, (0, 255, 0), -1)
            else:
                self.latest_landmarks = None
        except Exception as e:
            logger.debug(f"Pose detection error: {e}")
            self.latest_landmarks = None

        return img

    def find_position(self, img: np.ndarray) -> List[Dict[str, Any]]:
        """
        Extracts landmark coordinates list (lmList).
        Each element contains: {'id': int, 'x': int, 'y': int, 'z': float, 'visibility': float}
        """
        lm_list: List[Dict[str, Any]] = []
        if self.latest_landmarks is None:
            return lm_list

        h, w, _ = img.shape
        for idx, lm in enumerate(self.latest_landmarks):
            cx, cy = int(lm.x * w), int(lm.y * h)
            vis = getattr(lm, "visibility", 1.0)
            if vis is None:
                vis = 1.0
            lm_list.append({
                "id": idx,
                "x": cx,
                "y": cy,
                "z": lm.z,
                "visibility": vis
            })

        return lm_list

    def get_shoulder_landmarks(self, lm_list: List[Dict[str, Any]]) -> Optional[Tuple[Dict[str, Any], Dict[str, Any]]]:
        """
        Extracts Landmark 11 (Right Shoulder) and Landmark 12 (Left Shoulder).
        Verifies visibility confidence >= 0.40.
        """
        if len(lm_list) < 33:
            return None

        lm11 = lm_list[11]
        lm12 = lm_list[12]

        if lm11["visibility"] < 0.40 or lm12["visibility"] < 0.40:
            log_error("E104", "Shoulder landmarks below visibility threshold")
            return None

        return lm11, lm12

    def check_safe_zone(self, lm11: Dict[str, Any], lm12: Dict[str, Any]) -> bool:
        """Verifies if the shopper's torso falls within the designated safe trial zone."""
        mid_x = (lm11["x"] + lm12["x"]) / 2.0
        mid_y = (lm11["y"] + lm12["y"]) / 2.0

        in_x = config.SAFE_ZONE_X_MIN <= mid_x <= config.SAFE_ZONE_X_MAX
        in_y = config.SAFE_ZONE_Y_MIN <= mid_y <= config.SAFE_ZONE_Y_MAX
        return in_x and in_y
