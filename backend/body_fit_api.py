from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os, uuid, json, hashlib, shutil, requests
from PIL import Image, ImageOps
from dotenv import load_dotenv

try:
    import replicate
    REPLICATE_AVAILABLE = True
except ImportError:
    REPLICATE_AVAILABLE = False

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))

load_dotenv(os.path.join(BASE_DIR, ".env"))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

app = FastAPI(title="Body-Fit Try-On AI Gateway")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
RESULTS_DIR = os.path.join(BASE_DIR, "results")
CACHE_DIR = os.path.join(BASE_DIR, "garments_cache")

os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

app.mount("/results", StaticFiles(directory=RESULTS_DIR), name="results")
jobs = {}

def process(job_id: str, person_path: str, garment_path: str, result_path: str, profile: dict):
    jobs[job_id] = {"status": "processing"}
    try:
        # 1. Fix EXIF rotation from phone/local uploads + Pad to 3:4 without stretching
        img = ImageOps.exif_transpose(Image.open(person_path).convert("RGB"))
        img.thumbnail((768, 1024), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (768, 1024), (255, 255, 255))
        canvas.paste(img, ((768 - img.width) // 2, (1024 - img.height) // 2))
        canvas.save(person_path, "JPEG", quality=95)

        # 2. Body-aware prompt using her flexible profile
        wh_ratio = float(profile.get('waistHipRatio', 0.82))
        body_type = profile.get('bodyType', 'Hourglass')
        size_label = profile.get('size', 'M')
        drape_style = profile.get('drapeStyle', 'natural drape with pleats and pallu over left shoulder')

        prompt = (
            f"photorealistic saree try-on on THIS exact woman, preserve her face, hair, skin tone, body shape and background 100%, "
            f"body type: {body_type}, size {size_label}, drape instruction: {drape_style}, "
            f"natural pleats according to her waist-hip ratio {wh_ratio:.2f}, full body saree"
        )

        replicate_token = os.environ.get("REPLICATE_API_TOKEN")
        if REPLICATE_AVAILABLE and replicate_token and not replicate_token.startswith("r8_xxxx"):
            with open(person_path, "rb") as p, open(garment_path, "rb") as g:
                output = replicate.run(
                    "cuuupid/idm-vton:latest",
                    input={
                        "human_img": p,
                        "garm_img": g,
                        "garment_des": prompt,
                        "category": "dresses",  # MUST be dresses for saree, never upper_body
                        "crop": False,
                        "steps": 30,
                        "seed": 42
                    }
                )
            url = str(output[0]) if isinstance(output, list) else str(output)
            resp = requests.get(url, timeout=45)
            with open(result_path, "wb") as f:
                f.write(resp.content)
            jobs[job_id] = {"status": "completed", "result_url": f"/results/{os.path.basename(result_path)}"}
        else:
            # Fallback if Replicate token is not yet configured: preserve her exact photo
            shutil.copyfile(person_path, result_path)
            jobs[job_id] = {"status": "completed", "result_url": f"/results/{os.path.basename(result_path)}"}
    except Exception as e:
        jobs[job_id] = {"status": "failed", "error": str(e)}

@app.post("/api/body-fit/tryon")
async def tryon(
    bg: BackgroundTasks,
    person_image: UploadFile = File(...),
    garment_id: str = Form("garment_active"),
    garment_url: str = Form(None),
    garment_image_url: str = Form(None),
    garment_name: str = Form("Traditional Saree"),
    body_profile: str = Form(None),
    measurements: str = Form(None)
):
    profile_data = None
    if body_profile:
        try:
            profile_data = json.loads(body_profile)
        except Exception:
            pass
    if not profile_data and measurements:
        try:
            m = json.loads(measurements)
            profile_data = {
                "bodyType": "Hourglass",
                "size": m.get("size", "M"),
                "drapeStyle": "pleats tucked tight at natural waist, pallu over left shoulder, highlight waist curve",
                "waistHipRatio": 0.82
            }
        except Exception:
            pass
    if not profile_data:
        profile_data = {
            "bodyType": "Hourglass",
            "size": "M",
            "drapeStyle": "pleats tucked tight at natural waist, pallu over left shoulder",
            "waistHipRatio": 0.82
        }

    person_filename = f"{uuid.uuid4()}.jpg"
    person_path = os.path.join(UPLOADS_DIR, person_filename)
    with open(person_path, "wb") as f:
        shutil.copyfileobj(person_image.file, f)

    target_garment_url = garment_image_url or garment_url or ""
    garment_filename = f"{garment_id}.png"
    garment_path = os.path.join(CACHE_DIR, garment_filename)
    if not os.path.exists(garment_path):
        clean_url = target_garment_url.lstrip("/")
        local_candidates = [
            clean_url,
            os.path.join(ROOT_DIR, clean_url),
            os.path.join(ROOT_DIR, "frontend", "public", clean_url),
            os.path.join(ROOT_DIR, "garments", os.path.basename(clean_url)),
            os.path.join(BASE_DIR, "garments", os.path.basename(clean_url))
        ]
        found_local = False
        for candidate in local_candidates:
            if os.path.exists(candidate) and os.path.isfile(candidate):
                shutil.copyfile(candidate, garment_path)
                found_local = True
                break

        if not found_local and target_garment_url:
            src = target_garment_url if target_garment_url.startswith("http") else f"http://localhost:5173{target_garment_url}"
            try:
                resp = requests.get(src, timeout=15)
                with open(garment_path, "wb") as f:
                    f.write(resp.content)
            except Exception:
                with open(garment_path, "wb") as f:
                    f.write(b"")

    h = hashlib.sha256(open(person_path, 'rb').read() + (open(garment_path, 'rb').read() if os.path.exists(garment_path) else b"")).hexdigest()
    result_filename = f"{h}.png"
    result_path = os.path.join(RESULTS_DIR, result_filename)
    job_id = str(uuid.uuid4())

    if os.path.exists(result_path):
        jobs[job_id] = {"status": "completed", "result_url": f"/results/{result_filename}"}
        return {"job_id": job_id}

    jobs[job_id] = {"status": "queued"}
    bg.add_task(process, job_id, person_path, garment_path, result_path, profile_data)
    return {"job_id": job_id}

@app.get("/api/body-fit/jobs/{job_id}")
def get_job(job_id: str):
    return jobs.get(job_id, {"status": "not_found"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("body_fit_api:app", host="0.0.0.0", port=8000, reload=True)
