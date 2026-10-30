"""
AURA Virtual Trial Room - Main Desktop Application
Document ID: SDD-VTR-2026-001 (Version 2.0)
Entry point orchestrating real-time webcam video, MediaPipe BlazePose detection,
anatomical garment overlay, gesture control, and UI rendering at 30-60 FPS.
"""

import sys
import time
import cv2
import numpy as np

import config
from utils.logger import logger, log_error
from utils.image_utils import (
    draw_header_bar,
    draw_footer_bar,
    draw_virtual_button,
    draw_safe_zone
)
from core.pose_detector import PoseDetector
from core.overlay_engine import OverlayEngine
from core.gesture import GestureController
from services.shirt_service import ShirtService
from services.capture_service import CaptureService


class VirtualTrialRoomApp:
    """Main desktop application controller."""

    def __init__(self, camera_index: int = config.CAMERA_INDEX):
        self.camera_index = camera_index
        self.cap: cv2.VideoCapture = None  # type: ignore
        self.is_running: bool = False

        # Initialize Core Subsystems
        logger.info("Initializing AURA Virtual Trial Room subsystems...")
        self.detector = PoseDetector(smooth=True, detection_con=0.5, track_con=0.5)
        self.overlay_engine = OverlayEngine()
        self.gesture_controller = GestureController()
        self.shirt_service = ShirtService()
        self.capture_service = CaptureService()

        # Telemetry
        self.frame_count = 0
        self.fps = 30.0
        self.last_fps_time = time.time()
        self.current_size = "M"

    def start_camera(self) -> bool:
        """Initializes the webcam device."""
        self.cap = cv2.VideoCapture(self.camera_index, cv2.CAP_DSHOW)
        if not self.cap.isOpened():
            self.cap = cv2.VideoCapture(self.camera_index)

        if not self.cap.isOpened():
            log_error("E101", f"Could not open camera at index {self.camera_index}")
            return False

        # Set optimal resolution
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, config.FRAME_WIDTH)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, config.FRAME_HEIGHT)
        self.cap.set(cv2.CAP_PROP_FPS, config.TARGET_FPS)
        logger.info(f"Camera opened successfully ({config.FRAME_WIDTH}x{config.FRAME_HEIGHT} @ {config.TARGET_FPS} FPS).")
        return True

    def run(self):
        """Main rendering and event loop."""
        if not self.start_camera():
            print("\n[!] Live camera device unavailable. Creating synthetic test stream.")
            self._run_synthetic_demo()
            return

        cv2.namedWindow(config.WINDOW_NAME, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(config.WINDOW_NAME, config.FRAME_WIDTH, config.FRAME_HEIGHT)
        self.is_running = True

        logger.info("AURA Virtual Trial Room running. Controls: [Q] Quit | [N] Next Shirt | [P] Prev Shirt | [S] Screenshot")

        while self.is_running:
            ret, frame = self.cap.read()
            if not ret or frame is None:
                log_error("E101", "Frame read failed")
                break

            # 1. Ensure 1280x720 canvas
            if frame.shape[1] != config.FRAME_WIDTH or frame.shape[0] != config.FRAME_HEIGHT:
                frame = cv2.resize(frame, (config.FRAME_WIDTH, config.FRAME_HEIGHT))

            # 2. Mirror video for natural mirror user experience
            frame = cv2.flip(frame, 1)

            # 3. MediaPipe Pose Landmark Detection
            frame = self.detector.find_pose(frame, draw=False)
            lm_list = self.detector.find_position(frame)

            in_safe_zone = False
            overlay_telemetry = {}

            if lm_list:
                shoulders = self.detector.get_shoulder_landmarks(lm_list)
                if shoulders:
                    lm11, lm12 = shoulders
                    in_safe_zone = self.detector.check_safe_zone(lm11, lm12)

                    # Compute shoulder distance and estimate size
                    sh_dist = np.hypot(lm12["x"] - lm11["x"], lm12["y"] - lm11["y"])
                    self.current_size = self.shirt_service.recommend_size(sh_dist)

                    # Render transparent garment overlay
                    curr_shirt = self.shirt_service.get_current_shirt()
                    if curr_shirt and "image" in curr_shirt:
                        frame, overlay_telemetry = self.overlay_engine.overlay_garment(
                            frame=frame,
                            garment_img=curr_shirt["image"],
                            lm11=lm11,
                            lm12=lm12,
                            apply_rotation=True
                        )

                # Check hand gesture hover over buttons
                action, left_prog, right_prog = self.gesture_controller.update(lm_list)
                if action == "prev":
                    self.shirt_service.prev_shirt()
                    self.overlay_engine.reset()
                elif action == "next":
                    self.shirt_service.next_shirt()
                    self.overlay_engine.reset()
            else:
                left_prog, right_prog = 0.0, 0.0

            # 4. Render UI Elements
            # Safe zone guidance brackets
            frame = draw_safe_zone(frame, compliant=in_safe_zone)

            # Interactive virtual buttons
            frame = draw_virtual_button(
                frame,
                pos=config.LEFT_BUTTON_POS,
                size=(config.BUTTON_WIDTH, config.BUTTON_HEIGHT),
                label="PREV",
                direction="left",
                progress=left_prog
            )
            frame = draw_virtual_button(
                frame,
                pos=config.RIGHT_BUTTON_POS,
                size=(config.BUTTON_WIDTH, config.BUTTON_HEIGHT),
                label="NEXT",
                direction="right",
                progress=right_prog
            )

            # Luxury Header Bar
            frame = draw_header_bar(frame)

            # Size Indicator Footer
            frame = draw_footer_bar(frame, recommended_size=self.current_size, fit_status="Honest Fit")

            # Active Garment Tag (Top center)
            curr = self.shirt_service.get_current_shirt()
            if curr and "name" in curr:
                tag_text = f"TRYING ON: {curr['name'].upper()}"
                cv2.putText(frame, tag_text, (config.FRAME_WIDTH // 2 - 140, 95), cv2.FONT_HERSHEY_SIMPLEX, 0.55, config.COLOR_ACCENT_AMBER, 2, cv2.LINE_AA)

            # FPS Calculation & Display
            self.frame_count += 1
            now = time.time()
            if now - self.last_fps_time >= 0.5:
                self.fps = (self.frame_count) / (now - self.last_fps_time)
                self.frame_count = 0
                self.last_fps_time = now

            fps_text = f"{self.fps:.1f} FPS"
            cv2.putText(frame, fps_text, (config.FRAME_WIDTH - 120, config.FRAME_HEIGHT - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1, cv2.LINE_AA)

            # Display composite canvas
            cv2.imshow(config.WINDOW_NAME, frame)

            # 5. Handle Keyboard Input
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q') or key == 27:  # 'q' or ESC
                break
            elif key == ord('n') or key == 83:  # 'n' or Right Arrow
                self.shirt_service.next_shirt()
                self.overlay_engine.reset()
            elif key == ord('p') or key == 81:  # 'p' or Left Arrow
                self.shirt_service.prev_shirt()
                self.overlay_engine.reset()
            elif key == ord('s'):  # 's' for screenshot
                path = self.capture_service.save_capture(frame)
                print(f"[+] Screenshot captured: {path}")

        self.shutdown()

    def _run_synthetic_demo(self):
        """Runs a demonstration mode using an animated synthetic shopper avatar."""
        logger.info("Running synthetic demonstration test mode...")
        cv2.namedWindow(config.WINDOW_NAME, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(config.WINDOW_NAME, config.FRAME_WIDTH, config.FRAME_HEIGHT)

        start_time = time.time()
        for i in range(120):  # Run 120 synthetic frames
            t = time.time() - start_time
            # Synthetic camera frame
            frame = np.full((config.FRAME_HEIGHT, config.FRAME_WIDTH, 3), 40, dtype=np.uint8)

            # Simulated body swaying gently
            cx = int(config.FRAME_WIDTH // 2 + 30 * np.sin(t * 1.5))
            cy = int(config.FRAME_HEIGHT // 2 + 10 * np.cos(t * 1.5))
            sh_w = 230

            lm11 = {"x": cx - sh_w // 2, "y": cy - 100, "visibility": 0.98}
            lm12 = {"x": cx + sh_w // 2, "y": cy - 100, "visibility": 0.98}

            # Overlay garment
            curr_shirt = self.shirt_service.get_current_shirt()
            if curr_shirt and "image" in curr_shirt:
                frame, _ = self.overlay_engine.overlay_garment(
                    frame=frame,
                    garment_img=curr_shirt["image"],
                    lm11=lm11,
                    lm12=lm12
                )

            # UI overlays
            frame = draw_safe_zone(frame, compliant=True)
            frame = draw_header_bar(frame)
            frame = draw_footer_bar(frame, recommended_size="M", fit_status="Demo Mode")
            cv2.imshow(config.WINDOW_NAME, frame)
            if cv2.waitKey(20) & 0xFF == ord('q'):
                break

        cv2.destroyAllWindows()
        logger.info("Synthetic demonstration completed successfully.")

    def shutdown(self):
        """Releases all resources cleanly."""
        logger.info("Shutting down AURA Virtual Trial Room...")
        if self.cap is not None and self.cap.isOpened():
            self.cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    app = VirtualTrialRoomApp()
    app.run()

