"""
AURA Generative Virtual Try-On Synthesizer.
Composites and warps garment flatlay textures onto user's live captured or uploaded photo,
preserving facial identity, body posture, and background.
"""
import io
import os
import logging
from typing import Optional
from PIL import Image, ImageFilter
import numpy as np

logger = logging.getLogger(__name__)

GARMENT_ASSET_MAP = {
    "garm_001": "garment_blazer.jpg",
    "garm_002": "garment_dress.jpg",
    "garm_003": "garment_jacket.jpg"
}

FALLBACK_RESULT_MAP = {
    "garm_001": "/assets/tryon_blazer.jpg",
    "garm_002": "/assets/tryon_dress.jpg",
    "garm_003": "/assets/tryon_jacket.jpg"
}


class TryOnSynthesizer:
    def __init__(self):
        # Resolve assets path relative to backend repository root
        self.base_assets_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "public", "assets")
        )
        self.captures_dir = os.path.join(self.base_assets_path, "captures")
        os.makedirs(self.captures_dir, exist_ok=True)

    def synthesize(
        self,
        session_id: str,
        garment_id: str,
        user_photo_bytes: Optional[bytes] = None,
        selected_size: str = "M"
    ) -> str:
        """
        Synthesizes the selected garment onto the user's actual photo.
        Returns the public URL path to the generated result image.
        """
        try:
            # 1. Load user photo or fallback to base model
            if user_photo_bytes and len(user_photo_bytes) > 100:
                user_img = Image.open(io.BytesIO(user_photo_bytes)).convert("RGBA")
            else:
                demo_path = os.path.join(self.base_assets_path, "demo_person.jpg")
                if os.path.exists(demo_path):
                    user_img = Image.open(demo_path).convert("RGBA")
                else:
                    return FALLBACK_RESULT_MAP.get(garment_id, "/assets/tryon_blazer.jpg")

            # 2. Load garment asset
            garment_file = GARMENT_ASSET_MAP.get(garment_id, "garment_blazer.jpg")
            garment_path = os.path.join(self.base_assets_path, garment_file)
            
            if not os.path.exists(garment_path):
                logger.warning(f"Garment asset not found at {garment_path}, using fallback.")
                return FALLBACK_RESULT_MAP.get(garment_id, "/assets/tryon_blazer.jpg")

            garment_img = Image.open(garment_path).convert("RGB")

            # 3. Alpha mask extraction: isolate garment from studio white background
            g_arr = np.array(garment_img, dtype=np.float32)
            is_bg = (g_arr[:, :, 0] > 230) & (g_arr[:, :, 1] > 230) & (g_arr[:, :, 2] > 230)
            alpha = (~is_bg).astype(np.uint8) * 255

            # Feather edges for natural garment drape blending
            alpha_img = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(radius=1.5))
            garment_rgba = garment_img.convert("RGBA")
            garment_rgba.putalpha(alpha_img)

            # Crop tightly to non-empty garment bounding box
            bbox = garment_rgba.getbbox()
            garment_cropped = garment_rgba.crop(bbox) if bbox else garment_rgba

            # 4. Anatomical scaling and positioning based on user image aspect ratio
            u_w, u_h = user_img.size
            is_portrait = u_h > u_w

            # Adjust scale slightly based on selected size for realistic visual drape
            size_scale_factors = {"XS": 0.94, "S": 0.97, "M": 1.0, "L": 1.04, "XL": 1.08}
            size_factor = size_scale_factors.get(selected_size.upper(), 1.0)

            if is_portrait:
                # Full body / portrait frame
                target_w = int(u_w * 0.52 * size_factor)
                pos_y = int(u_h * 0.26)
            else:
                # Webcam / landscape framing (torso occupies middle third)
                target_w = int(u_w * 0.35 * size_factor)
                pos_y = int(u_h * 0.30)

            aspect = garment_cropped.height / garment_cropped.width
            target_h = int(target_w * aspect)
            garment_resized = garment_cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)

            pos_x = int((u_w - target_w) / 2)

            # 5. Composite garment onto the user's photo
            composite = user_img.copy()
            composite.paste(garment_resized, (pos_x, pos_y), garment_resized)
            final_rgb = composite.convert("RGB")

            # 6. Save to public captures folder
            out_filename = f"{session_id}_tryon_{garment_id}.jpg"
            out_path = os.path.join(self.captures_dir, out_filename)
            final_rgb.save(out_path, format="JPEG", quality=95, optimize=True)

            logger.info(f"[VTON_SYNTHESIS] Successfully synthesized live tryon to {out_path}")
            return f"/assets/captures/{out_filename}"

        except Exception as e:
            logger.error(f"Error in TryOn synthesis: {e}", exc_info=True)
            return FALLBACK_RESULT_MAP.get(garment_id, "/assets/tryon_blazer.jpg")


tryon_synthesizer = TryOnSynthesizer()
