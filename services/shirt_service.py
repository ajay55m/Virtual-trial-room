"""
AURA Virtual Trial Room - Garment Catalog & Shirt Service
Manages garment loading, cycling, and shoulder-width anthropometric sizing.
Complies with requirement FR-04, FR-07, and Module Design Section 6.
"""

import os
import glob
import shutil
import cv2
import numpy as np
from typing import List, Dict, Optional, Any
import config
from utils.logger import logger, log_error

class ShirtService:
    """
    Manages the active inventory of transparent PNG garments.
    Implements size estimation and next/previous navigation.
    """

    def __init__(self, shirts_dir: str = config.SHIRTS_DIR):
        self.shirts_dir = shirts_dir
        self.shirts: List[Dict[str, Any]] = []
        self.current_index: int = 0

        self._ensure_sample_shirts()
        self.load_shirts()

    def _ensure_sample_shirts(self):
        """Copies transparent catalog assets from frontend if shirts directory is empty."""
        existing = glob.glob(os.path.join(self.shirts_dir, "*.png"))
        if not existing:
            frontend_assets = os.path.abspath(
                os.path.join(config.BASE_DIR, "frontend", "public", "assets")
            )
            candidate_files = [
                "garment_basic_shirt.png",
                "garment_basic_sweater.png",
                "garment_blazer.png",
                "garment_jacket.png",
                "garment_white_tshirt.png",
                "garment_dress.png"
            ]
            for c in candidate_files:
                src = os.path.join(frontend_assets, c)
                if os.path.exists(src):
                    dst = os.path.join(self.shirts_dir, c)
                    try:
                        shutil.copyfile(src, dst)
                    except Exception as e:
                        logger.warning(f"Could not copy {c}: {e}")

    def load_shirts(self) -> int:
        """Loads all PNG garments into memory."""
        self.shirts.clear()
        files = sorted(glob.glob(os.path.join(self.shirts_dir, "*.png")))

        for path in files:
            img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
            if img is not None:
                # Ensure 4 channels
                if img.shape[2] == 3:
                    img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

                name = os.path.splitext(os.path.basename(path))[0].replace("garment_", "").replace("_", " ").title()
                self.shirts.append({
                    "name": name,
                    "path": path,
                    "image": img,
                    "width": img.shape[1],
                    "height": img.shape[0]
                })

        logger.info(f"Loaded {len(self.shirts)} garment assets into ShirtService.")
        if not self.shirts:
            log_error("E103", f"No valid PNG garment files found in {self.shirts_dir}")
        return len(self.shirts)

    def next_shirt(self) -> Dict[str, Any]:
        """Switches to the next garment in the collection."""
        if not self.shirts:
            return {}
        self.current_index = (self.current_index + 1) % len(self.shirts)
        logger.info(f"Switched to next garment: {self.get_current_shirt().get('name')}")
        return self.get_current_shirt()

    def prev_shirt(self) -> Dict[str, Any]:
        """Switches to the previous garment in the collection."""
        if not self.shirts:
            return {}
        self.current_index = (self.current_index - 1 + len(self.shirts)) % len(self.shirts)
        logger.info(f"Switched to previous garment: {self.get_current_shirt().get('name')}")
        return self.get_current_shirt()

    def get_current_shirt(self) -> Dict[str, Any]:
        """Returns the active garment object."""
        if not self.shirts:
            return {}
        return self.shirts[self.current_index]

    def recommend_size(self, shoulder_width_px: float) -> str:
        """
        Recommends sizing (XS, S, M, L, XL) based on detected shoulder span in pixels.
        Reference: 1.5m distance from a 720p lens.
        """
        if shoulder_width_px < config.SIZE_THRESHOLDS["XS"]:
            return "XS"
        elif shoulder_width_px < config.SIZE_THRESHOLDS["S"]:
            return "S"
        elif shoulder_width_px < config.SIZE_THRESHOLDS["M"]:
            return "M"
        elif shoulder_width_px < config.SIZE_THRESHOLDS["L"]:
            return "L"
        else:
            return "XL"

