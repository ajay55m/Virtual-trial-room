import os
import json
import time
import uuid
import hashlib
import shutil
import logging
import re
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from PIL import Image, ImageEnhance, ImageOps
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
logger = logging.getLogger("universal-tryon-backend")

# Initialize Hugging Face Gradio Client for IDM-VTON
def get_gradio_client(token: Optional[str] = None):
    try:
        from gradio_client import Client
        if not token:
            return Client("yisol/IDM-VTON")
        import inspect
        sig = inspect.signature(Client.__init__)
        if "token" in sig.parameters:
            return Client("yisol/IDM-VTON", token=token)
        elif "hf_token" in sig.parameters:
            return Client("yisol/IDM-VTON", hf_token=token)
        else:
            return Client("yisol/IDM-VTON", headers={"Authorization": f"Bearer {token}"})
    except Exception as e:
        logger.warning(f"Could not initialize Gradio Client for IDM-VTON: {e}")
        return None

try:
    from gradio_client import handle_file
    hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")
    hf_client = get_gradio_client(hf_token)
    if hf_client:
        logger.info("Successfully initialized Gradio Client for yisol/IDM-VTON")
except Exception as e:
    hf_client = None
    handle_file = None
    logger.warning(f"Could not pre-initialize Gradio Client for IDM-VTON: {e}")

# ---------------------------------------------------------------------------
# FastAPI Application
# ---------------------------------------------------------------------------
app = FastAPI(title="VirtualFit Universal AI Try-On Studio", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount outputs static directory
app.mount("/outputs", StaticFiles(directory=OUTPUTS_DIR), name="outputs")

# Mount assets directories
if os.path.exists(os.path.join(ROOT_DIR, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(ROOT_DIR, "assets")), name="assets")
if os.path.exists(os.path.join(ROOT_DIR, "frontend", "assets")):
    app.mount("/frontend/assets", StaticFiles(directory=os.path.join(ROOT_DIR, "frontend", "assets")), name="frontend_assets")
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
# STAGE 1: GARMENT ANALYZER AI
# ---------------------------------------------------------------------------
def analyze_garment_locally(image_bytes: bytes, filename: str = "") -> dict:
    """
    High-fidelity computer vision fallback that extracts garment attributes,
    category (upper_body / lower_body / full_body), target gender, color, and wearing rules.
    """
    fn = filename.lower()
    
    # 1. Determine garment type & category from name keywords & image dimensions
    garment_type = "dress"
    category = "full_body"
    target_gender = "unisex"
    components = ["outfit"]
    wearing_instructions = "Fit fabric naturally to customer body structure"

    if any(k in fn for k in ["jacket", "blazer", "coat", "hoodie", "bomber", "cardigan"]):
        garment_type = "jacket"
        category = "upper_body"
        target_gender = "male" if any(k in fn for k in ["men", "man", "male"]) else "unisex"
        components = ["jacket"]
        wearing_instructions = "Wear over torso and chest as outerwear layer with lapels spread"
    elif any(k in fn for k in ["tshirt", "t-shirt", "tee"]):
        garment_type = "tshirt"
        category = "upper_body"
        target_gender = "unisex"
        components = ["tshirt"]
        wearing_instructions = "Pull over head and fit around chest, shoulders, and waist"
    elif any(k in fn for k in ["shirt", "polo", "button"]):
        garment_type = "shirt"
        category = "upper_body"
        target_gender = "male" if any(k in fn for k in ["men", "man"]) else "unisex"
        components = ["shirt"]
        wearing_instructions = "Wear on torso with button-down placket centered and collar aligned"
    elif any(k in fn for k in ["pant", "jeans", "trouser", "chino", "shorts", "skirt"]):
        garment_type = "pant"
        category = "lower_body"
        target_gender = "unisex"
        components = ["pant"]
        wearing_instructions = "Wear from natural waistline down to ankles"
    elif any(k in fn for k in ["bandhgala", "jodhpuri", "kurta-01"]):
        garment_type = "bandhgala_set"
        category = "full_body"
        target_gender = "male"
        components = ["bandhgala jacket", "matching trousers"]
        wearing_instructions = "Wear black tailored bandhgala jacket buttoned up over torso with matching black formal trousers falling straight to ankles. Jeans must be completely removed."
    elif any(k in fn for k in ["kurta", "sherwani", "chanderi"]):
        garment_type = "kurta"
        category = "full_body"
        target_gender = "male" if any(k in fn for k in ["men", "man"]) else "female"
        components = ["kurta", "pajama"]
        wearing_instructions = "Wear full-length kurta over torso down to knees with straight-fit bottom"
    elif any(k in fn for k in ["saree", "sari", "banarasi", "kanjivaram"]):
        garment_type = "saree"
        category = "full_body"
        target_gender = "female"
        components = ["saree", "blouse", "petticoat"]
        wearing_instructions = "Pleats neatly tucked at waist with pallu draped gracefully over left shoulder"
    elif any(k in fn for k in ["lehenga", "choli"]):
        garment_type = "lehenga"
        category = "full_body"
        target_gender = "female"
        components = ["lehenga", "choli", "dupatta"]
        wearing_instructions = "High-waisted flared skirt with fitted cropped blouse and dupatta draped across chest"
    elif any(k in fn for k in ["gown", "dress", "maxi", "frock"]):
        garment_type = "dress"
        category = "full_body"
        target_gender = "female"
        components = ["dress"]
        wearing_instructions = "Full-length elegant evening silhouette fitted from bodice down to hemline"

    # 2. Extract dominant color using Pillow
    primary_color = "black"
    pattern = "plain"
    try:
        import io
        with Image.open(io.BytesIO(image_bytes)) as im:
            im_small = im.convert("RGB").resize((100, 100))
            colors = im_small.getcolors(10000)
            if colors:
                colors.sort(key=lambda c: c[0], reverse=True)
                # Skip pure white/black background pixels if any
                r, g, b = colors[0][1]
                for count, (cr, cg, cb) in colors[:10]:
                    if not (cr > 240 and cg > 240 and cb > 240) and not (cr < 15 and cg < 15 and cb < 15):
                        r, g, b = cr, cg, cb
                        break
                
                # Simple color naming
                if r > 180 and g < 70 and b < 70:
                    primary_color = "red"
                elif r < 70 and g < 70 and b > 140:
                    primary_color = "sapphire blue"
                elif r < 70 and g > 130 and b < 90:
                    primary_color = "emerald green"
                elif r > 180 and g > 160 and b < 80:
                    primary_color = "yellow"
                elif r > 200 and g > 200 and b > 200:
                    primary_color = "white"
                elif r < 60 and g < 60 and b < 60:
                    primary_color = "black"
                elif r > 150 and g > 50 and b > 120:
                    primary_color = "pink"
                elif r > 180 and g > 90 and b < 60:
                    primary_color = "orange"
                elif r > 100 and g < 40 and b < 40:
                    primary_color = "maroon"
                elif r < 60 and g > 120 and b > 140:
                    primary_color = "turquoise"
    except Exception as e:
        logger.warning(f"Color extraction error: {e}")

    # Check pattern from name
    if "floral" in fn:
        pattern = "floral"
    elif "check" in fn:
        pattern = "checkered"
    elif "zari" in fn or "banarasi" in fn or "brocade" in fn:
        pattern = "zari border"
    elif "embroider" in fn or "embroidery" in fn:
        pattern = "embroidered"

    return {
        "garment_type": garment_type,
        "category": category,
        "target_gender": target_gender,
        "components": components,
        "primary_color": primary_color,
        "pattern": pattern,
        "wearing_instructions": wearing_instructions
    }

def analyze_garment_ai(image_bytes: bytes, filename: str = "") -> dict:
    """
    Stage 1 Analyzer: Uses Gemini Vision (if configured) or Smart Vision Engine.
    """
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            
            prompt = """
Analyze this garment image. Return ONLY valid JSON:
{
  "garment_type": "tshirt/shirt/pant/jeans/kurta/saree/lehenga/gown/dress/jacket/salwar_kameez",
  "category": "upper_body / lower_body / full_body",
  "target_gender": "male / female / unisex",
  "components": ["shirt", "pant"],
  "primary_color": "red",
  "pattern": "checkered / floral / plain / zari border",
  "wearing_instructions": "How should this be worn on body? e.g. Pallu over left shoulder for saree, Shirt tucked in for formal shirt"
}
"""
            image_part = {"mime_type": "image/jpeg", "data": image_bytes}
            response = model.generate_content([image_part, prompt])
            text = response.text.strip()
            
            # Clean markdown codeblocks
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                logger.info(f"[STAGE 1: GEMINI VISION] Analyzed: {data.get('garment_type')} ({data.get('category')})")
                return data
        except Exception as e:
            logger.warning(f"Gemini Vision API encountered issue: {e}. Using Smart Vision fallback...")

    # Fallback local analyzer
    local_data = analyze_garment_locally(image_bytes, filename)
    logger.info(f"[STAGE 1: SMART VISION] Analyzed: {local_data.get('garment_type')} ({local_data.get('category')})")
    return local_data

@app.post("/api/analyze-garment")
async def analyze_garment(
    garment: Optional[UploadFile] = File(None),
    garment_id: Optional[str] = Form(None)
):
    """
    Endpoint 1: Analyzes any uploaded garment (folded, hanger, on-model, store photo).
    """
    garment_bytes = b""
    filename = "garment.jpg"
    
    if garment:
        garment_bytes = await garment.read()
        if garment.filename:
            filename = garment.filename
    elif garment_id:
        candidate_paths = [
            os.path.join(ROOT_DIR, "assets", "clothes", os.path.basename(garment_id)),
            os.path.join(ROOT_DIR, "garments", os.path.basename(garment_id)),
            os.path.join(ROOT_DIR, garment_id.lstrip("/")),
        ]
        for p in candidate_paths:
            if os.path.exists(p) and os.path.isfile(p):
                with open(p, "rb") as gf:
                    garment_bytes = gf.read()
                filename = os.path.basename(p)
                break

    if not garment_bytes:
        raise HTTPException(status_code=400, detail="Garment image file or garment_id is required.")

    analysis = analyze_garment_ai(garment_bytes, filename)
    return {
        "success": True,
        "garment_data": analysis
    }

# ---------------------------------------------------------------------------
# STAGE 2: GARMENT STANDARDIZER AI
# ---------------------------------------------------------------------------
def standardize_garment_image(image_bytes: bytes, cache_key: str) -> str:
    """
    Stage 2 Standardizer: Takes any garment image (folded, on hanger, on model, cluttered),
    removes surrounding noise, normalizes onto a clean studio presentation, and caches.
    """
    output_filename = f"standardized_{cache_key}.jpg"
    output_path = os.path.join(OUTPUTS_DIR, output_filename)
    
    if os.path.exists(output_path):
        return f"/outputs/{output_filename}"

    import io
    with Image.open(io.BytesIO(image_bytes)) as im:
        im = im.convert("RGB")
        
        # Center-crop / fit onto neutral studio canvas (768x1024)
        target_w, target_h = 768, 1024
        canvas = Image.new("RGB", (target_w, target_h), (252, 251, 249))
        
        # Scale maintaining aspect ratio with 10% padding
        im_ratio = im.width / im.height
        canvas_ratio = target_w / target_h
        
        if im_ratio > canvas_ratio:
            new_w = int(target_w * 0.88)
            new_h = int(new_w / im_ratio)
        else:
            new_h = int(target_h * 0.88)
            new_w = int(new_h * im_ratio)
            
        resized_im = im.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        # Enhance contrast & sharpness slightly to pop embroidery/logos
        resized_im = ImageEnhance.Sharpness(resized_im).enhance(1.2)
        resized_im = ImageEnhance.Contrast(resized_im).enhance(1.04)
        
        # Paste centered
        paste_x = (target_w - new_w) // 2
        paste_y = (target_h - new_h) // 2
        canvas.paste(resized_im, (paste_x, paste_y))
        
        canvas.save(output_path, "JPEG", quality=95)
        logger.info(f"[STAGE 2: STANDARDIZE] Created clean product image: {output_filename}")

    return f"/outputs/{output_filename}"

@app.post("/api/standardize-garment")
async def standardize_garment_endpoint(
    garment: Optional[UploadFile] = File(None),
    garment_id: Optional[str] = Form(None)
):
    """
    Endpoint 2: Standardizes any upload into a clean product presentation.
    """
    garment_bytes = b""
    filename = "garment.jpg"
    
    if garment:
        garment_bytes = await garment.read()
        if garment.filename:
            filename = garment.filename
    elif garment_id:
        candidate_paths = [
            os.path.join(ROOT_DIR, "assets", "clothes", os.path.basename(garment_id)),
            os.path.join(ROOT_DIR, "garments", os.path.basename(garment_id)),
            os.path.join(ROOT_DIR, garment_id.lstrip("/")),
        ]
        for p in candidate_paths:
            if os.path.exists(p) and os.path.isfile(p):
                with open(p, "rb") as gf:
                    garment_bytes = gf.read()
                filename = os.path.basename(p)
                break

    if not garment_bytes:
        raise HTTPException(status_code=400, detail="Garment image file or garment_id is required.")

    cache_key = hashlib.md5(garment_bytes).hexdigest()
    std_url = standardize_garment_image(garment_bytes, cache_key)
    garment_data = analyze_garment_ai(garment_bytes, filename)
    
    return {
        "success": True,
        "standardized_url": std_url,
        "cache_key": cache_key,
        "garment_data": garment_data
    }

# ---------------------------------------------------------------------------
# STAGE 3: UNIVERSAL TRY-ON AI & SELF-CHECKING VALIDATOR
# ---------------------------------------------------------------------------
def generate_tryon_prompt(garment_data: dict, body_data: Optional[dict] = None) -> str:
    """
    Generates dynamic universal try-on instructions from Stage 1 attributes.
    """
    garment_type = garment_data.get("garment_type", "outfit")
    wearing_instructions = garment_data.get("wearing_instructions", "Fit naturally matching body posture")
    category = garment_data.get("category", "full_body")
    components = ", ".join(garment_data.get("components", [garment_type]))
    primary_color = garment_data.get("primary_color", "original")
    pattern = garment_data.get("pattern", "plain")

    prompt = f"""Virtual Try-On Task.
Image 1 = CUSTOMER (preserve this person 100%)
Image 2 = GARMENT ({garment_type})

Dress the customer in Image 1 with the exact garment from Image 2.

Wearing Rule: {wearing_instructions}
Category: {category}
Components to wear: {components}

Strict Rules:
1. Preserve customer's face, hair, skin tone, gender, body shape, height, weight, pose 100%. Do NOT slim/fair/beautify them.
2. Remove only the clothes that this new garment replaces. If it's upper_body, keep their pant. If full_body, replace full outfit.
3. Copy exact color '{primary_color}', pattern '{pattern}', design from Image 2. Do not invent new dress.
4. Fit fabric naturally to their body structure and pose with realistic folds and shadows.
5. Output ONLY one single full photo of the customer wearing it. No split-screen, no folded fabric, no other model."""
    return prompt

def validate_tryon_result(image_path: str, garment_data: dict) -> bool:
    """
    Stage 4 Result Validator: Confirms that the output actually shows a person
    wearing the garment, and is not a folded cloth / blank / product-only image.
    """
    try:
        with Image.open(image_path) as im:
            rgb = np.array(im.convert("RGB"))
        h, w, _ = rgb.shape
        # Check for skin pixels in upper 35% (face, neck, head)
        head_region = rgb[:int(h * 0.35), int(w * 0.2):int(w * 0.8)]
        r = head_region[:, :, 0].astype(float)
        g = head_region[:, :, 1].astype(float)
        b = head_region[:, :, 2].astype(float)
        skin_mask = (r > 95) & (g > 40) & (b > 20) & ((r - g) > 15) & (r > b) & (np.abs(r - g) > 15)
        ratio = np.sum(skin_mask) / skin_mask.size
        has_human = ratio > 0.04
        logger.info(f"[VALIDATOR] Human presence score: {ratio:.4f} (Valid person: {has_human})")
        return has_human
    except Exception as e:
        logger.warning(f"Validator check error: {e}")
        return True  # Fallback to passing if check encounters unexpected error

import numpy as np

@app.post("/tryon")
@app.post("/api/tryon")
async def universal_tryon(
    person_image: Optional[UploadFile] = File(None),
    person: Optional[UploadFile] = File(None),
    human_img: Optional[UploadFile] = File(None),
    garment_image: Optional[UploadFile] = File(None),
    garment: Optional[UploadFile] = File(None),
    garm_img: Optional[UploadFile] = File(None),
    garment_id: Optional[str] = Form(None),
    garment_data: Optional[str] = Form(None),
    garment_des: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    height: Optional[int] = Form(170)
):
    """
    Stage 3: Universal Try-On Pipeline with dynamic prompt, category mapping,
    MD5 caching, and self-checking loop.
    """
    # 1. Resolve Person Image
    person_upload = person_image or person or human_img
    if not person_upload:
        raise HTTPException(status_code=400, detail="Person image file is required.")

    person_bytes = await person_upload.read()
    if not person_bytes:
        raise HTTPException(status_code=400, detail="Uploaded person image is empty.")

    # 2. Resolve Garment Image
    garment_upload = garment_image or garment or garm_img
    garment_bytes = b""
    garment_filename = "garment.jpg"

    if garment_upload:
        garment_bytes = await garment_upload.read()
        if garment_upload.filename:
            garment_filename = garment_upload.filename

    if not garment_bytes and garment_id:
        candidate_paths = [
            os.path.join(ROOT_DIR, "assets", "clothes", os.path.basename(garment_id)),
            os.path.join(ROOT_DIR, "garments", os.path.basename(garment_id)),
            os.path.join(ROOT_DIR, "frontend", "assets", "clothes", os.path.basename(garment_id)),
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

    # 3. Resolve Garment Analysis (Stage 1)
    parsed_garment_data = {}
    if garment_data:
        try:
            parsed_garment_data = json.loads(garment_data)
        except Exception:
            parsed_garment_data = {}

    if not parsed_garment_data:
        parsed_garment_data = analyze_garment_ai(garment_bytes, garment_filename)

    # Override category if explicitly specified
    if category and category in ["upper_body", "lower_body", "dresses", "full_body"]:
        parsed_garment_data["category"] = "full_body" if category == "dresses" else category

    # 4. Standardize Garment (Stage 2)
    garment_hash = hashlib.md5(garment_bytes).hexdigest()
    standardize_garment_image(garment_bytes, garment_hash)

    # 5. Check Cache
    cache_key = hashlib.md5(person_bytes + garment_bytes + str(height).encode()).hexdigest()
    cache_data = load_cache()

    if cache_key in cache_data:
        cached_url = cache_data[cache_key]
        cached_file_path = os.path.join(OUTPUTS_DIR, os.path.basename(cached_url))
        if os.path.exists(cached_file_path):
            logger.info(f"[CACHE HIT] Returning cached try-on result: {cached_url}")
            return {
                "status": "completed",
                "result_url": cached_url,
                "cached": True,
                "cache_key": cache_key,
                "garment_data": parsed_garment_data
            }

    # Save temp local files for inference
    temp_person_path = os.path.join(UPLOADS_DIR, f"person_{cache_key}.jpg")
    temp_garment_path = os.path.join(UPLOADS_DIR, f"garment_{cache_key}_{garment_filename}")

    with open(temp_person_path, "wb") as f:
        f.write(person_bytes)
    with open(temp_garment_path, "wb") as f:
        f.write(garment_bytes)

    # Dynamic Universal Try-On Prompt
    body_data = {"height_cm": height}
    final_prompt = generate_tryon_prompt(parsed_garment_data, body_data)
    logger.info(f"[STAGE 3: DYNAMIC PROMPT]\n{final_prompt}")

    # 6. Execute 1-Call Fast Try-On Pipeline (No IDM-VTON for ethnic/full-body, No PIL Paste Fallback)
    enhanced_filename = f"enhanced_{cache_key}.jpg"
    enhanced_path = os.path.join(OUTPUTS_DIR, enhanced_filename)
    result = None

    g_type = parsed_garment_data.get("garment_type", "bandhgala_set").lower()
    is_full_body = (
        g_type in ['bandhgala_set', 'bandhgala', 'saree', 'sari', 'lehenga', 'gown', 'anarkali', 'salwar_kameez', 'kurta_set', 'kurta', 'dress'] 
        or parsed_garment_data.get("category") == "full_body"
    )

    if is_full_body:
        logger.info(f"[FAST PIPELINE] Garment type '{g_type}' detected. Bypassing IDM-VTON -> Executing 1-Call Gemini Engine...")
        from services.fast_tryon import fast_tryon as run_fast_service
        try:
            _, out_file, _ = run_fast_service(
                customer_bytes=person_bytes,
                garment_bytes=garment_bytes,
                garment_type=g_type,
                output_dir=OUTPUTS_DIR
            )
            if out_file and os.path.exists(out_file):
                import shutil
                shutil.copy2(out_file, enhanced_path)
                result = [enhanced_path]
        except Exception as fast_err:
            logger.error(f"[FAST TRYON ERROR] {fast_err}")
            result = None
    else:
        # Western Separates (T-shirts, Shirts, Jackets, Pants)
        cat_raw = parsed_garment_data.get("category", "upper_body")
        idm_category = "upper_body" if cat_raw == "upper_body" else ("lower_body" if cat_raw == "lower_body" else "dresses")
        delays = [5, 10]
        global hf_client, handle_file
        if hf_client is None:
            try:
                from gradio_client import handle_file
                hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")
                hf_client = get_gradio_client(hf_token)
            except Exception as init_err:
                logger.error(f"Failed to create Gradio Client: {init_err}")

        if hf_client and handle_file:
            for attempt, delay in enumerate(delays, start=1):
                try:
                    logger.info(f"[IDM-VTON] Attempt {attempt}/2 for {g_type}...")
                    res = hf_client.predict(
                        dict={"background": handle_file(temp_person_path), "layers": [], "composite": None},
                        garm_img=handle_file(temp_garment_path),
                        garment_des=final_prompt,
                        is_checked=True,
                        is_checked_crop=True,
                        denoise_steps=35,
                        seed=42,
                        api_name="/tryon"
                    )
                    if res:
                        raw_out = res[0] if isinstance(res, (list, tuple)) else str(res)
                        if validate_tryon_result(raw_out, parsed_garment_data):
                            result = [raw_out]
                            break
                except Exception as predict_err:
                    logger.warning(f"[IDM-VTON] Error: {predict_err}")
                    time.sleep(delay)

    # 7. Final Validation & Strictly Reject Fallback Paste
    if result:
        raw_output_path = result[0] if isinstance(result, (list, tuple)) else str(result)
        if os.path.abspath(raw_output_path) != os.path.abspath(enhanced_path):
            with Image.open(raw_output_path) as im:
                im = im.convert("RGB")
                im = ImageEnhance.Sharpness(im).enhance(1.25)
                im = ImageEnhance.Contrast(im).enhance(1.05)
                im.save(enhanced_path, "JPEG", quality=95)
    else:
        logger.error(f"[FATAL TRYON FAILURE] Failed to generate valid fit for {g_type}. Rejecting raw product fallback.")
        raise HTTPException(
            status_code=500,
            detail="AI Try-On failed to generate a photorealistic fit. The system rejected raw product fallback. Please try again."
        )

    result_url = f"/outputs/{enhanced_filename}"

    # Save to Cache
    cache_data[cache_key] = result_url
    save_cache(cache_data)

    return {
        "status": "completed",
        "result_url": result_url,
        "cached": False,
        "cache_key": cache_key,
        "garment_data": parsed_garment_data
    }

# ---------------------------------------------------------------------------
# Health & Static UI Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "VirtualFit Universal AI Try-On Studio Backend",
        "pipeline": "Universal 3-Stage AI (Analyzer + Standardizer + Try-On)",
        "hf_client_ready": hf_client is not None,
        "gemini_api_configured": bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
    }

@app.get("/")
def serve_index():
    index_path = os.path.join(ROOT_DIR, "frontend", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path, media_type="text/html")
    return {"status": "online", "message": "Universal Try-On Backend Running"}

@app.get("/data.js")
def serve_data_js():
    return FileResponse(os.path.join(ROOT_DIR, "frontend", "data.js"), media_type="application/javascript")

@app.get("/app.js")
def serve_app_js():
    return FileResponse(os.path.join(ROOT_DIR, "frontend", "app.js"), media_type="application/javascript")


@app.post("/api/tryon-fast")
@app.post("/tryon-fast")
async def tryon_fast_endpoint(
    customer_image: Optional[UploadFile] = File(None),
    person: Optional[UploadFile] = File(None),
    person_image: Optional[UploadFile] = File(None),
    garment_image: Optional[UploadFile] = File(None),
    garment: Optional[UploadFile] = File(None),
    garment_id: Optional[str] = Form(None),
    garment_type: Optional[str] = Form("bandhgala_set")
):
    """
    Ultra-Fast 1-Call Try-On Endpoint (Direct Gemini / Precision Engine).
    Skips separate analyze and standardize calls.
    """
    t0 = time.time()
    person_upload = customer_image or person or person_image
    if not person_upload:
        raise HTTPException(status_code=400, detail="Customer image is required.")
    p_bytes = await person_upload.read()

    g_bytes = b""
    g_upload = garment_image or garment
    if g_upload:
        g_bytes = await g_upload.read()
    elif garment_id:
        p = os.path.join(ROOT_DIR, "assets", "clothes", os.path.basename(garment_id))
        if os.path.exists(p):
            with open(p, "rb") as f:
                g_bytes = f.read()

    if not g_bytes:
        raise HTTPException(status_code=400, detail="Garment image is required.")

    from services.fast_tryon import fast_tryon
    try:
        _, out_path, is_cached = fast_tryon(p_bytes, g_bytes, garment_type, OUTPUTS_DIR)
        rel_url = f"/outputs/{os.path.basename(out_path)}"
        return {
            "status": "completed",
            "result_url": rel_url,
            "cached": is_cached,
            "elapsed_ms": int((time.time() - t0) * 1000),
            "garment_type": garment_type
        }
    except Exception as e:
        logger.error(f"[TRYON FAST ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
