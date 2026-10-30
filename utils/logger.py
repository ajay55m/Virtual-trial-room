"""
AURA Virtual Trial Room - Logging & Error Management
Defines standard logging formats and error codes specified in SDD-VTR-2026-001.
"""

import logging
import sys

# Error Code Definitions
ERROR_CODES = {
    "E101": "Camera Not Found / Video Capture Stream Failed",
    "E102": "Pose Lost / No Human Body Detected in Frame",
    "E103": "Garment Asset Missing / Corrupted PNG File",
    "E104": "Landmark Occluded / Hand over Torso or Off-screen",
    "E105": "Discontinuity Detected / Tracking Jumped Beyond Tolerance"
}

def get_logger(name: str = "AURA_VTR") -> logging.Logger:
    """Configures and returns a structured logger."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        formatter = logging.Formatter(
            "[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        ch = logging.StreamHandler(sys.stdout)
        ch.setFormatter(formatter)
        logger.addHandler(ch)
    return logger

logger = get_logger()

def log_error(code: str, details: str = ""):
    """Logs a standard error code with description."""
    desc = ERROR_CODES.get(code, "Unknown System Error")
    msg = f"[{code}] {desc}"
    if details:
        msg += f" - {details}"
    logger.error(msg)

