import os
import time
import uuid
import shutil
import logging
from pathlib import Path
from dotenv import load_dotenv

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from PIL import Image

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ai_tryon")

# Directory setup
BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"

# Load environment variables
load_dotenv(dotenv_path=ENV_PATH)
HF_SPACE = os.getenv("HF_SPACE", "yisol/IDM-VTON")
HF_TOKEN = os.getenv("HF_TOKEN")

UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"
ASSETS_DIR = BASE_DIR.parent / "assets"
FRONTEND_DIR = BASE_DIR.parent / "frontend"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="AI Virtual Trial Room Backend", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount outputs as static files
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")

# Mount assets directory if present
if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

# Mount frontend directory for kiosk convenience
if FRONTEND_DIR.exists():
    app.mount("/frontend", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


@app.get("/")
def read_root():
    """Health check / root endpoint"""
    return {
        "message": "AI Backend Running",
        "status": "online",
        "space": HF_SPACE,
        "token_configured": bool(HF_TOKEN),
    }


@app.get("/garments")
def list_garments():
    """Optional endpoint listing catalog garments from assets/clothes"""
    clothes_dir = ASSETS_DIR / "clothes"
    if not clothes_dir.exists():
        return {"garments": []}

    garments = []
    for f in sorted(clothes_dir.iterdir()):
        if f.suffix.lower() in [".jpg", ".jpeg", ".png", ".webp"]:
            garments.append({
                "id": f.stem,
                "name": f.stem.replace("_", " ").title(),
                "filename": f.name,
                "url": f"/assets/clothes/{f.name}"
            })
    return {"garments": garments}


@app.post("/tryon")
async def tryon(
    person: UploadFile = File(...),
    garment: UploadFile = File(...),
    category: str = Form("dresses"),
    garment_desc: str = Form("a beautiful outfit with elegant drape")
):
    """
    Virtual Try-On Endpoint:
    Receives person photo & garment image, calls IDM-VTON via gradio_client,
    saves the output image and returns the accessible URL.
    """
    person_ext = Path(person.filename or "person.jpg").suffix or ".jpg"
    garment_ext = Path(garment.filename or "garment.jpg").suffix or ".jpg"

    person_file_id = f"person_{uuid.uuid4().hex[:10]}{person_ext}"
    garment_file_id = f"garment_{uuid.uuid4().hex[:10]}{garment_ext}"

    person_path = UPLOAD_DIR / person_file_id
    garment_path = UPLOAD_DIR / garment_file_id

    # Save uploaded files
    try:
        with open(person_path, "wb") as f_p:
            content_p = await person.read()
            f_p.write(content_p)

        with open(garment_path, "wb") as f_g:
            content_g = await garment.read()
            f_g.write(content_g)

        logger.info(f"Saved uploads: {person_path.name} ({len(content_p)} bytes), {garment_path.name} ({len(content_g)} bytes)")
    except Exception as e:
        logger.error(f"Error saving uploads: {e}")
        return JSONResponse(status_code=500, content={"success": False, "error": f"Failed to save upload files: {str(e)}"})

    # Prepare gradio_client
    try:
        from gradio_client import Client, handle_file
    except ImportError:
        logger.error("gradio_client not installed.")
        return JSONResponse(status_code=500, content={"success": False, "error": "gradio_client is not installed on the server."})

    output_filename = f"tryon_{uuid.uuid4().hex[:12]}.jpg"
    final_output_path = OUTPUT_DIR / output_filename

    max_attempts = 2
    last_error = None

    for attempt in range(max_attempts):
        try:
            logger.info(f"Connecting to HF Space '{HF_SPACE}' (attempt {attempt + 1}/{max_attempts})...")
            
            client_kwargs = {}
            if HF_TOKEN:
                # Support modern gradio_client (token) and legacy (hf_token)
                try:
                    import inspect
                    sig = inspect.signature(Client.__init__)
                    if "token" in sig.parameters:
                        client_kwargs["token"] = HF_TOKEN
                    elif "hf_token" in sig.parameters:
                        client_kwargs["hf_token"] = HF_TOKEN
                    else:
                        client_kwargs["headers"] = {"Authorization": f"Bearer {HF_TOKEN}"}
                except Exception:
                    client_kwargs["token"] = HF_TOKEN

            client = Client(HF_SPACE, **client_kwargs)

            logger.info("Calling /tryon prediction on IDM-VTON...")
            result = client.predict(
                dict={
                    "background": handle_file(str(person_path)),
                    "layers": [],
                    "composite": None
                },
                garm_img=handle_file(str(garment_path)),
                garment_des=garment_desc,
                is_checked=True,        # auto-mask
                is_checked_crop=True,   # auto-crop
                denoise_steps=30,
                seed=42,
                api_name="/tryon"
            )

            logger.info(f"IDM-VTON prediction returned: {result}")

            # Extract generated image path from result
            res_img_path = None
            if isinstance(result, (list, tuple)) and len(result) > 0:
                res_img_path = result[0]
            elif isinstance(result, str):
                res_img_path = result
            elif isinstance(result, dict) and "image" in result:
                res_img_path = result["image"]

            if not res_img_path or not os.path.exists(res_img_path):
                raise ValueError(f"IDM-VTON returned invalid or missing output file: {result}")

            # Convert/copy to output directory as JPEG
            try:
                with Image.open(res_img_path) as im:
                    im.convert("RGB").save(str(final_output_path), "JPEG", quality=95)
            except Exception as cvt_err:
                logger.warning(f"PIL conversion failed ({cvt_err}), copying directly: {res_img_path}")
                shutil.copy(res_img_path, str(final_output_path))

            logger.info(f"Generated try-on saved to {final_output_path.name}")
            return {
                "success": True,
                "result_url": f"/outputs/{output_filename}",
                "message": "AI try-on generated successfully"
            }

        except Exception as e:
            last_error = e
            logger.warning(f"Try-on attempt {attempt + 1} encountered error: {e}")
            if attempt < max_attempts - 1:
                logger.info("HF Space may be sleeping or busy; waiting 5 seconds before retrying...")
                time.sleep(5)

    logger.error(f"All try-on attempts failed: {last_error}")
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": str(last_error)}
    )
