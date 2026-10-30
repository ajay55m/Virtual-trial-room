"""
AURA Virtual Trial Room - Capture & Screenshot Service
Captures, timestamps, and persists trial room still images.
Complies with requirement FR-06 and Security Design Section 12.
"""

import os
import cv2
import datetime
import numpy as np
from typing import Optional, Dict, Any
import config
from utils.logger import logger

class CaptureService:
    """Manages saving trial screenshots with timestamped filenames."""

    def __init__(self, captures_dir: str = config.CAPTURES_DIR):
        self.captures_dir = captures_dir
        os.makedirs(self.captures_dir, exist_ok=True)

    def save_capture(self, frame: np.ndarray, metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Saves current frame as high-quality JPEG image.
        Returns the absolute filepath of the saved capture.
        """
        now_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"aura_trial_{now_str}.jpg"
        filepath = os.path.join(self.captures_dir, filename)

        # Save with high quality compression
        cv2.imwrite(filepath, frame, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        logger.info(f"Saved trial screenshot to {filepath}")
        return filepath

