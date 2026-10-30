"""
AURA Virtual Trial Room - System Configuration
Document ID: SDD-VTR-2026-001 (Version 2.0)
Defines all constants, dimensions, aspect ratios, scaling factors, and UI colors.
"""

import os

# -----------------------------------------------------------------------------
# Base Directories
# -----------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(BASE_DIR, "assets")
SHIRTS_DIR = os.path.join(ASSETS_DIR, "shirts")
BUTTONS_DIR = os.path.join(ASSETS_DIR, "buttons")
CAPTURES_DIR = os.path.join(BASE_DIR, "captures")

# Ensure required directories exist
for directory in [ASSETS_DIR, SHIRTS_DIR, BUTTONS_DIR, CAPTURES_DIR]:
    os.makedirs(directory, exist_ok=True)

# -----------------------------------------------------------------------------
# Display & Video Feed Parameters (16:9 Canvas)
# -----------------------------------------------------------------------------
WINDOW_NAME = "AURA | AI Virtual Trial Room Kiosk v2.0"
FRAME_WIDTH = 1280
FRAME_HEIGHT = 720
TARGET_FPS = 30
CAMERA_INDEX = 0

# -----------------------------------------------------------------------------
# Geometric & Anatomical Anchoring Ratios
# -----------------------------------------------------------------------------
# Ratio of shirt width to detected shoulder distance (from standard flatlay geometry)
FIXED_RATIO_SCALE = 262.0 / 190.0  # ~1.3789

# Aspect ratio of the master garment asset (Height / Width)
SHIRT_ASPECT_RATIO = 581.0 / 440.0  # ~1.3204

# Horizontal offset: left shoulder margin correction (0.38 of garment width)
OFFSET_FACTOR_X = 0.38

# Vertical offset: collar/neckline sits 22% above shoulder midpoint
OFFSET_FACTOR_Y = 0.22

# -----------------------------------------------------------------------------
# Anti-Jitter Smoothing Parameters
# -----------------------------------------------------------------------------
# EMA filter weights: Smooth = Prev * PREV_WEIGHT + Current * CURRENT_WEIGHT
SMOOTH_PREV_WEIGHT = 0.75
SMOOTH_CURRENT_WEIGHT = 0.25

# OneEuroFilter defaults
ONE_EURO_MIN_CUTOFF = 1.0
ONE_EURO_BETA = 0.05
ONE_EURO_D_CUTOFF = 1.0

# Discontinuity threshold (jump > 20% of frame width triggers instant filter reset)
MAX_DISCONTINUITY_PX = FRAME_WIDTH * 0.20

# -----------------------------------------------------------------------------
# Interactive Virtual Gesture Buttons
# -----------------------------------------------------------------------------
BUTTON_WIDTH = 110
BUTTON_HEIGHT = 135

# Left Button coordinates (Prev Shirt)
LEFT_BUTTON_POS = (20, 293)

# Right Button coordinates (Next Shirt)
RIGHT_BUTTON_POS = (1150, 293)

# Number of consecutive frames the hand must hover to activate button
GESTURE_HOLD_FRAMES = 30
GESTURE_COOLDOWN_FRAMES = 20

# Safe Body Standing Zone (600x600 px centered)
SAFE_ZONE_X_MIN = 340
SAFE_ZONE_X_MAX = 940
SAFE_ZONE_Y_MIN = 100
SAFE_ZONE_Y_MAX = 700

# -----------------------------------------------------------------------------
# Sizing Estimation Thresholds (Shoulder Width in Pixels at 1.5m Reference)
# -----------------------------------------------------------------------------
SIZE_THRESHOLDS = {
    "XS": 180,
    "S": 210,
    "M": 245,
    "L": 280,
    "XL": 320
}

# -----------------------------------------------------------------------------
# UI Color Palette (BGR for OpenCV)
# -----------------------------------------------------------------------------
COLOR_PRIMARY_BLUE = (235, 99, 37)     # #2563EB in BGR: (37, 99, 235)
COLOR_DARK_BG = (23, 24, 17)           # #111827 in BGR: (17, 24, 23)
COLOR_SUCCESS_GREEN = (129, 185, 16)   # #10B981 in BGR: (16, 185, 129)
COLOR_ERROR_RED = (68, 68, 239)        # #EF4444 in BGR: (68, 68, 239)
COLOR_ACCENT_AMBER = (36, 178, 245)    # #F5B224 in BGR: (36, 178, 245)
COLOR_WHITE = (255, 255, 255)
COLOR_GRAY = (180, 180, 180)
COLOR_DARK_GRAY = (60, 60, 60)

