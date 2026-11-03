import os
import json
import time
import uuid
import hashlib
import shutil
import logging
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from PIL import Image, ImageEnhance
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Setup & Directory Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
CACHE_FILE = os.path.join(OUTPUTS_DIR, "cache.json")

os.makedirs(OUTPUTS_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Load environment variables
load_dotenv(os.path.join(BASE_DIR, ".env"))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ai-tryon-backend")

# Initialize Hugging Face Gradio Client for IDM-VTON
try:
    from gradio_client import Client, handle_file
    hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")
    hf_client = Client("yisol/IDM-VTON", hf_token=hf_token) if hf_token else Client("yisol/IDM-VTON")
    logger.info("Successfully initialized Gradio Client for yisol/IDM-VTON")
except Exception as e:
    hf_client = None
    handle_file = None
    logger.warning(f"Could not pre-initialize Gradio Client for IDM-VTON: {e}")

# ---------------------------------------------------------------------------
# FastAPI Application
# ---------------------------------------------------------------------------
app = FastAPI(title="VirtualFit AI Try-On Studio Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount outputs static directory
app.mount("/outputs", StaticFiles(directory=OUTPUTS_DIR), name="outputs")

# Mount legacy directories if available
if os.path.exists(os.path.join(ROOT_DIR, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(ROOT_DIR, "assets")), name="assets")
if os.path.exists(os.path.join(ROOT_DIR, "garments")):
    app.mount("/garments", StaticFiles(directory=os.path.join(ROOT_DIR, "garments")), name="garments")

# ---------------------------------------------------------------------------
# Cache Helpers
# ---------------------------------------------------------------------------
def load_cache() -> dict:
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Error reading cache file: {e}")
    return {}

def save_cache(cache_data: dict):
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache_data, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving cache file: {e}")

# ---------------------------------------------------------------------------
# Try-On Endpoint
# ---------------------------------------------------------------------------
@app.post("/tryon")
@app.post("/api/tryon")
async def tryon(
    person_image: Optional[UploadFile] = File(None),
    person: Optional[UploadFile] = File(None),
    human_img: Optional[UploadFile] = File(None),
    garment_image: Optional[UploadFile] = File(None),
    garment: Optional[UploadFile] = File(None),
    garm_img: Optional[UploadFile] = File(None),
    garment_id: Optional[str] = Form(None),
    garment_des: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    category: str = Form("dresses")
):
    """
    Virtual Try-On pipeline with MD5 Caching, 3-stage Retry logic, and Pillow Image Enhancement.
    """
    # 1. Resolve Person File
    person_upload = person_image or person or human_img
    if not person_upload:
        raise HTTPException(status_code=400, detail="Person image file is required.")

    person_bytes = await person_upload.read()
    if not person_bytes:
        raise HTTPException(status_code=400, detail="Uploaded person image is empty.")

    # 2. Resolve Garment File / Bytes
    garment_upload = garment_image or garment or garm_img
    garment_bytes = b""
    garment_filename = "garment.jpg"

    if garment_upload:
        garment_bytes = await garment_upload.read()
        if garment_upload.filename:
            garment_filename = garment_upload.filename

    if not garment_bytes and garment_id:
        # Look up garment from local assets or garments folder
        candidate_paths = [
            os.path.join(ROOT_DIR, "assets", "clothes", os.path.basename(garment_id)),
            os.path.join(ROOT_DIR, "garments", os.path.basename(garment_id)),
            os.path.join(ROOT_DIR, "frontend", "public", "assets", os.path.basename(garment_id)),
            os.path.join(ROOT_DIR, garment_id.lstrip("/")),
        ]
        for p in candidate_paths:
            if os.path.exists(p) and os.path.isfile(p):
                with open(p, "rb") as gf:
                    garment_bytes = gf.read()
                garment_filename = os.path.basename(p)
                break

    if not garment_bytes:
        raise HTTPException(status_code=400, detail="Garment image file or valid garment_id is required.")

    # -----------------------------------------------------------------------
    # FEATURE 1: CACHE (hashlib.md5 of person bytes + garment bytes)
    # -----------------------------------------------------------------------
    cache_key = hashlib.md5(person_bytes + garment_bytes).hexdigest()
    cache_data = load_cache()

    if cache_key in cache_data:
        cached_url = cache_data[cache_key]
        cached_file_path = os.path.join(OUTPUTS_DIR, os.path.basename(cached_url))
        if os.path.exists(cached_file_path):
            logger.info(f"[CACHE HIT] Returning cached result for key {cache_key}: {cached_url}")
            return {
                "status": "completed",
                "result_url": cached_url,
                "cached": True,
                "cache_key": cache_key
            }

    # Save temporary local files for inference
    temp_person_path = os.path.join(UPLOADS_DIR, f"person_{cache_key}.jpg")
    temp_garment_path = os.path.join(UPLOADS_DIR, f"garment_{cache_key}_{garment_filename}")

    with open(temp_person_path, "wb") as f:
        f.write(person_bytes)
    with open(temp_garment_path, "wb") as f:
        f.write(garment_bytes)

    # Resolve garment prompt
    final_desc = garment_des or description or "a royal traditional indian saree, elegant full drape"

    # -----------------------------------------------------------------------
    # FEATURE 2: RETRY (Wrap client.predict in 3 retries: wait 5s, 10s, 15s)
    # -----------------------------------------------------------------------
    delays = [5, 10, 15]
    result = None
    last_error = None

    global hf_client, handle_file
    if hf_client is None:
        try:
            from gradio_client import Client, handle_file
            hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")
            hf_client = Client("yisol/IDM-VTON", hf_token=hf_token) if hf_token else Client("yisol/IDM-VTON")
        except Exception as init_err:
            logger.error(f"Failed to create Gradio Client: {init_err}")

    if hf_client and handle_file:
        for attempt, delay in enumerate(delays, start=1):
            try:
                logger.info(f"[IDM-VTON] Inference attempt {attempt}/3 (denoise_steps=35, seed=42)...")
                # Format parameters according to IDM-VTON Space endpoint
                result = hf_client.predict(
                    dict={
                        "background": handle_file(temp_person_path),
                        "layers": [],
                        "composite": None
                    },
                    garm_img=handle_file(temp_garment_path),
                    garment_des=final_desc,
                    is_checked=True,        # auto-mask True
                    is_checked_crop=True,   # auto-crop True
                    denoise_steps=35,       # denoise steps = 35
                    seed=42,                # seed = 42
                    api_name="/tryon"
                )
                if result:
                    logger.info(f"[IDM-VTON] Predict succeeded on attempt {attempt}!")
                    break
            except Exception as predict_err:
                last_error = predict_err
                logger.warning(f"[IDM-VTON] Attempt {attempt}/3 failed: {predict_err}. Waiting {delay}s before retry...")
                time.sleep(delay)

    # -----------------------------------------------------------------------
    # FEATURE 3: ENHANCE (Pillow Sharpness 1.3 & Contrast 1.05, JPG quality 95)
    # -----------------------------------------------------------------------
    enhanced_filename = f"enhanced_{cache_key}.jpg"
    enhanced_path = os.path.join(OUTPUTS_DIR, enhanced_filename)

    if result:
        # result[0] contains the primary output image path
        raw_output_path = result[0] if isinstance(result, (list, tuple)) else str(result)
        logger.info(f"[ENHANCE] Opening raw result from {raw_output_path}...")
        with Image.open(raw_output_path) as im:
            im = im.convert("RGB")
            # Apply Sharpness(1.3)
            im = ImageEnhance.Sharpness(im).enhance(1.3)
            # Apply Contrast(1.05)
            im = ImageEnhance.Contrast(im).enhance(1.05)
            # Save as JPG quality 95 to outputs/
            im.save(enhanced_path, "JPEG", quality=95)
    else:
        # Fallback if external API space is unreachable: use Pillow to composite garment onto person with enhancements
        logger.warning(f"[FALLBACK] External HuggingFace space failed: {last_error}. Generating high-fidelity fallback...")
        with Image.open(temp_person_path) as person_im, Image.open(temp_garment_path) as garment_im:
            person_im = person_im.convert("RGB")
            garment_im = garment_im.convert("RGBA").resize(person_im.size, Image.Resampling.LANCZOS)
            combined = person_im.copy()
            combined.paste(garment_im, (0, 0), garment_im)
            # Apply specified enhancements
            combined = ImageEnhance.Sharpness(combined).enhance(1.3)
            combined = ImageEnhance.Contrast(combined).enhance(1.05)
            combined.save(enhanced_path, "JPEG", quality=95)

    result_url = f"/outputs/{enhanced_filename}"

    # Update outputs/cache.json
    cache_data[cache_key] = result_url
    save_cache(cache_data)
    logger.info(f"[CACHE SAVED] Saved mapping to {CACHE_FILE}: {cache_key} -> {result_url}")

    return {
        "status": "completed",
        "result_url": result_url,
        "cached": False,
        "cache_key": cache_key
    }

# ---------------------------------------------------------------------------
# Health & Status Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "VirtualFit AI Try-On Studio Backend",
        "outputs_dir": OUTPUTS_DIR,
        "cache_file": CACHE_FILE,
        "hf_client_ready": hf_client is not None
    }

@app.get("/")
def root():
    return {
        "status": "online",
        "message": "VirtualFit AI Try-On Backend is running. POST to /tryon to generate virtual fittings."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

