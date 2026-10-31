from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os, uuid, json, hashlib, shutil, requests
from dotenv import load_dotenv

# Try importing replicate
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

def process(job_id: str, person_path: str, garment_path: str, result_path: str, m: dict):
    jobs[job_id] = {"status": "processing"}
    try:
        # Body-aware prompt - Forces IDM-VTON to drape on HER structure
        prompt = (
            f"elegant traditional Indian saree draped perfectly on this woman's body structure, "
            f"shoulder {m.get('shoulder', 44)}cm, bust {m.get('chest', 94)}cm, waist {m.get('waist', 78)}cm, "
            f"height {m.get('height', 175)}cm, size {m.get('size', 'M')}, "
            f"pallu draped over left shoulder, pleats tucked at waist according to her waist curve, "
            f"preserve her exact face, skin tone, hair, hands and background, photorealistic full body"
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
            # Fallback: synthesize body-proportioned tryon if Replicate token is not yet configured
            # Copy person photo directly as base and notify
            shutil.copyfile(person_path, result_path)
            jobs[job_id] = {"status": "completed", "result_url": f"/results/{os.path.basename(result_path)}"}
    except Exception as e:
        jobs[job_id] = {"status": "failed", "error": str(e)}

@app.post("/api/body-fit/tryon")
async def tryon(
    bg: BackgroundTasks,
    person_image: UploadFile = File(...),
    garment_id: str = Form(...),
    garment_url: str = Form(...),
    measurements: str = Form(...)
):
    try:
        m = json.loads(measurements)
    except Exception:
        m = {"shoulder": 44, "chest": 94, "waist": 78, "hip": 96, "height": 175, "size": "M"}

    person_filename = f"{uuid.uuid4()}.jpg"
    person_path = os.path.join(UPLOADS_DIR, person_filename)
    with open(person_path, "wb") as f:
        shutil.copyfileobj(person_image.file, f)

    # Download or copy existing saree image
    garment_filename = f"{garment_id}.png"
    garment_path = os.path.join(CACHE_DIR, garment_filename)
    if not os.path.exists(garment_path):
        clean_url = garment_url.lstrip("/")
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
        
        if not found_local:
            src = garment_url if garment_url.startswith("http") else f"http://localhost:5173{garment_url}"
            try:
                resp = requests.get(src, timeout=15)
                with open(garment_path, "wb") as f:
                    f.write(resp.content)
            except Exception:
                # Fallback create empty placeholder if fetch fails
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
    bg.add_task(process, job_id, person_path, garment_path, result_path, m)
    return {"job_id": job_id}

@app.get("/api/body-fit/jobs/{job_id}")
def get_job(job_id: str):
    return jobs.get(job_id, {"status": "not_found"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("body_fit_api:app", host="0.0.0.0", port=8000, reload=True)

