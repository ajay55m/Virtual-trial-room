"""
AURA Generative Virtual Try-On Synthesizer.
Integrates state-of-the-art Generative AI Diffusion (Hugging Face IDM-VTON 100% Free ZeroGPU)
and Fal.ai CatVTON, with automatic local fallback.
"""
import io
import os
import shutil
import base64
import logging
import tempfile
from typing import Optional
from PIL import Image, ImageFilter
import numpy as np
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

GARMENT_ASSET_MAP = {
    "garm_001": "garment_blazer.jpg",
    "garm_002": "garment_dress.jpg",
    "garm_003": "garment_jacket.jpg"
}

GARMENT_DESC_MAP = {
    "garm_001": "tailored navy satin blazer jacket",
    "garm_002": "elegant red silk sleeveless evening dress",
    "garm_003": "designer structured zip jacket"
}

FALLBACK_RESULT_MAP = {
    "garm_001": "/assets/tryon_blazer.jpg",
    "garm_002": "/assets/tryon_dress.jpg",
    "garm_003": "/assets/tryon_jacket.jpg"
}


class TryOnSynthesizer:
    def __init__(self):
        self.base_assets_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "public", "assets")
        )
        self.captures_dir = os.path.join(self.base_assets_path, "captures")
        os.makedirs(self.captures_dir, exist_ok=True)
        self._hf_client = None

    def _get_hf_client(self):
        """Lazy initialization of Gradio Client for yisol/IDM-VTON."""
        if self._hf_client is None:
            try:
                from gradio_client import Client
                hf_token = settings.HF_TOKEN or os.environ.get("HF_TOKEN")
                if hf_token:
                    os.environ["HF_TOKEN"] = hf_token
                logger.info("[TRYON_HF] Connecting to yisol/IDM-VTON on Hugging Face Spaces...")
                self._hf_client = Client("yisol/IDM-VTON")
                logger.info("[TRYON_HF] Successfully connected to IDM-VTON diffusion model.")
            except Exception as e:
                logger.error(f"[TRYON_HF] Failed connecting to Hugging Face IDM-VTON: {e}")
                self._hf_client = None
        return self._hf_client

    def _synthesize_with_hf(
        self,
        session_id: str,
        garment_id: str,
        user_photo_bytes: bytes,
        garment_path: str
    ) -> Optional[str]:
        """
        Executes free IDM-VTON generative diffusion inference via Hugging Face ZeroGPU Space.
        """
        try:
            client = self._get_hf_client()
            if not client:
                return None

            from gradio_client import handle_file

            # Write user photo to temporary file for handle_file
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp_user:
                tmp_user.write(user_photo_bytes)
                tmp_user_path = tmp_user.name

            try:
                description = GARMENT_DESC_MAP.get(garment_id, "tailored upper garment")
                logger.info(f"[TRYON_HF] Submitting IDM-VTON diffusion task for garment: '{description}'...")

                res = client.predict(
                    dict={"background": handle_file(tmp_user_path), "layers": [], "composite": None},
                    garm_img=handle_file(garment_path),
                    garment_des=description,
                    is_checked=True,
                    is_checked_crop=False,
                    denoise_steps=25,
                    seed=42,
                    api_name="/tryon"
                )

                # res is a tuple: (output_filepath, masked_image_output_filepath)
                if res and isinstance(res, (tuple, list)) and len(res) > 0 and res[0]:
                    output_path = res[0]
                    out_filename = f"{session_id}_tryon_{garment_id}.jpg"
                    dest_path = os.path.join(self.captures_dir, out_filename)

                    # Copy result into frontend captures directory
                    shutil.copyfile(output_path, dest_path)
                    logger.info(f"[TRYON_HF] Successfully generated photorealistic try-on result: {dest_path}")
                    return f"/assets/captures/{out_filename}"
                else:
                    logger.warning(f"[TRYON_HF] Invalid result from IDM-VTON: {res}")
            finally:
                if os.path.exists(tmp_user_path):
                    try:
                        os.unlink(tmp_user_path)
                    except Exception:
                        pass

        except Exception as e:
            logger.warning(f"[TRYON_HF] IDM-VTON execution failed: {e}. Falling back to secondary engine.")

        return None

    def _to_data_uri(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        return f"data:{mime_type};base64,{b64}"

    def _synthesize_with_fal(
        self,
        session_id: str,
        garment_id: str,
        user_photo_bytes: bytes,
        garment_bytes: bytes
    ) -> Optional[str]:
        """Executes Fal.ai CatVTON when credit balance is active."""
        fal_key = settings.FAL_KEY or os.environ.get("FAL_KEY")
        if not fal_key:
            return None

        try:
            import fal_client
            os.environ["FAL_KEY"] = fal_key

            logger.info(f"[TRYON_FAL] Submitting VTON job to Fal.ai...")
            user_uri = self._to_data_uri(user_photo_bytes)
            garment_uri = self._to_data_uri(garment_bytes)

            result = fal_client.subscribe(
                "fal-ai/cat-vton",
                arguments={
                    "person_image_url": user_uri,
                    "garment_image_url": garment_uri
                }
            )

            img_url = None
            if isinstance(result, dict):
                img_data = result.get("image")
                if isinstance(img_data, dict):
                    img_url = img_data.get("url")

            if img_url:
                with httpx.Client(timeout=30.0) as client:
                    res = client.get(img_url)
                    if res.status_code == 200:
                        out_filename = f"{session_id}_tryon_{garment_id}.jpg"
                        out_path = os.path.join(self.captures_dir, out_filename)
                        with open(out_path, "wb") as f:
                            f.write(res.content)
                        return f"/assets/captures/{out_filename}"

        except Exception as e:
            logger.warning(f"[TRYON_FAL] Fal execution skipped: {e}")

        return None

    def _synthesize_local(
        self,
        session_id: str,
        garment_id: str,
        user_img: Image.Image,
        garment_img: Image.Image,
        selected_size: str = "M"
    ) -> str:
        """Local geometric overlay fallback."""
        g_arr = np.array(garment_img, dtype=np.float32)
        is_bg = (g_arr[:, :, 0] > 230) & (g_arr[:, :, 1] > 230) & (g_arr[:, :, 2] > 230)
        alpha = (~is_bg).astype(np.uint8) * 255

        alpha_img = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(radius=1.5))
        garment_rgba = garment_img.convert("RGBA")
        garment_rgba.putalpha(alpha_img)

        bbox = garment_rgba.getbbox()
        garment_cropped = garment_rgba.crop(bbox) if bbox else garment_rgba

        u_w, u_h = user_img.size
        is_portrait = u_h > u_w

        size_scale_factors = {"XS": 0.94, "S": 0.97, "M": 1.0, "L": 1.04, "XL": 1.08}
        size_factor = size_scale_factors.get(selected_size.upper(), 1.0)

        if is_portrait:
            target_w = int(u_w * 0.52 * size_factor)
            pos_y = int(u_h * 0.26)
        else:
            target_w = int(u_w * 0.35 * size_factor)
            pos_y = int(u_h * 0.30)

        aspect = garment_cropped.height / garment_cropped.width
        target_h = int(target_w * aspect)
        garment_resized = garment_cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)
        pos_x = int((u_w - target_w) / 2)

        composite = user_img.copy()
        composite.paste(garment_resized, (pos_x, pos_y), garment_resized)
        final_rgb = composite.convert("RGB")

        out_filename = f"{session_id}_tryon_{garment_id}.jpg"
        out_path = os.path.join(self.captures_dir, out_filename)
        final_rgb.save(out_path, format="JPEG", quality=95, optimize=True)

        logger.info(f"[TRYON_LOCAL] Synthesized local result to {out_path}")
        return f"/assets/captures/{out_filename}"

    def synthesize(
        self,
        session_id: str,
        garment_id: str,
        user_photo_bytes: Optional[bytes] = None,
        selected_size: str = "M"
    ) -> str:
        """
        Synthesizes the selected garment onto the user's actual photo.
        Prioritizes:
        1. Free Hugging Face IDM-VTON Diffusion (when configured)
        2. Fal.ai CatVTON (if balance present)
        3. Local Engine fallback
        """
        try:
            # 1. Resolve user photo bytes
            if not user_photo_bytes or len(user_photo_bytes) < 100:
                demo_path = os.path.join(self.base_assets_path, "demo_person.jpg")
                if os.path.exists(demo_path):
                    with open(demo_path, "rb") as f:
                        user_photo_bytes = f.read()

            # 2. Resolve garment asset
            garment_file = GARMENT_ASSET_MAP.get(garment_id, "garment_blazer.jpg")
            garment_path = os.path.join(self.base_assets_path, garment_file)
            
            if not os.path.exists(garment_path):
                logger.warning(f"Garment asset not found at {garment_path}, using fallback.")
                return FALLBACK_RESULT_MAP.get(garment_id, "/assets/tryon_blazer.jpg")

            with open(garment_path, "rb") as f:
                garment_bytes = f.read()

            # 3. Primary: Hugging Face IDM-VTON Diffusion (100% Free)
            if settings.TRYON_PROVIDER == "huggingface" and user_photo_bytes:
                hf_res = self._synthesize_with_hf(
                    session_id=session_id,
                    garment_id=garment_id,
                    user_photo_bytes=user_photo_bytes,
                    garment_path=garment_path
                )
                if hf_res:
                    return hf_res

            # 4. Secondary: Fal.ai CatVTON
            if settings.TRYON_PROVIDER == "fal" and (settings.FAL_KEY or os.environ.get("FAL_KEY")):
                if user_photo_bytes:
                    fal_result = self._synthesize_with_fal(
                        session_id=session_id,
                        garment_id=garment_id,
                        user_photo_bytes=user_photo_bytes,
                        garment_bytes=garment_bytes
                    )
                    if fal_result:
                        return fal_result

            # 5. Local Fallback
            if user_photo_bytes:
                user_img = Image.open(io.BytesIO(user_photo_bytes)).convert("RGBA")
            else:
                user_img = Image.open(os.path.join(self.base_assets_path, "demo_person.jpg")).convert("RGBA")

            garment_img = Image.open(garment_path).convert("RGB")
            return self._synthesize_local(
                session_id=session_id,
                garment_id=garment_id,
                user_img=user_img,
                garment_img=garment_img,
                selected_size=selected_size
            )

        except Exception as e:
            logger.error(f"Error in TryOn synthesis: {e}", exc_info=True)
            return FALLBACK_RESULT_MAP.get(garment_id, "/assets/tryon_blazer.jpg")


tryon_synthesizer = TryOnSynthesizer()
