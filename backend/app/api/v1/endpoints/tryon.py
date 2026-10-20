"""
AURA Photoreal Try-On API Endpoints (Mode B).
Implements asynchronous job submission and polling:
- POST /v1/tryon -> returns job_id and initial QUEUED status
- GET /v1/tryon/{job_id} -> returns real-time progress, logs, result_url, or error
"""

import os
import io
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks, status
from pydantic import BaseModel, Field

from app.config import settings
from app.services.tryon_pipeline import tryon_pipeline
from app.services.tryon_synthesizer import GARMENT_ASSET_MAP, GARMENT_DESC_MAP

logger = logging.getLogger(__name__)

router = APIRouter()

# -------------------------------------------------------------------------
# In-Memory Job Store (Skips Redis/Celery until production scale)
# -------------------------------------------------------------------------

TRYON_JOBS: Dict[str, Dict[str, Any]] = {}


def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# -------------------------------------------------------------------------
# Response Models
# -------------------------------------------------------------------------

class TryOnSubmitResponse(BaseModel):
    job_id: str
    status: str = "QUEUED"
    poll_url: str
    created_at: str
    category: str
    provider: str


class TryOnJobStatusResponse(BaseModel):
    job_id: str
    status: str  # QUEUED, PROCESSING, COMPLETED, FAILED
    stage: str
    progress: int
    created_at: str
    updated_at: str
    result_url: Optional[str] = None
    error: Optional[str] = None
    provider: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None
    logs: List[str] = Field(default_factory=list)


# -------------------------------------------------------------------------
# Background Worker
# -------------------------------------------------------------------------

def _run_tryon_task(
    job_id: str,
    person_bytes: bytes,
    garment_bytes: bytes,
    category: str,
    description: Optional[str],
    provider_name: Optional[str]
):
    """Executes try-on pipeline in background worker and updates job store."""
    job = TRYON_JOBS.get(job_id)
    if not job:
        return

    job["status"] = "PROCESSING"
    job["updated_at"] = utc_iso()

    def progress_callback(stage: str, percent: int, msg: str):
        if job_id in TRYON_JOBS:
            j = TRYON_JOBS[job_id]
            j["stage"] = stage
            j["progress"] = percent
            j["updated_at"] = utc_iso()
            j["logs"].append(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] {msg}")

    try:
        result = tryon_pipeline.execute_pipeline(
            job_id=job_id,
            person_image_bytes=person_bytes,
            garment_image_bytes=garment_bytes,
            category=category,
            garment_description=description,
            provider_name=provider_name,
            progress_callback=progress_callback
        )

        job["status"] = "COMPLETED"
        job["stage"] = "COMPLETED"
        job["progress"] = 100
        job["result_url"] = result.get("result_url")
        job["provider"] = result.get("provider")
        job["metrics"] = {
            "face_similarity": result.get("face_similarity"),
            "latency_seconds": result.get("latency_seconds"),
            "is_demo": result.get("is_demo", False),
            **result.get("metadata", {})
        }
        job["updated_at"] = utc_iso()
        logger.info(f"[JOB {job_id}] Successfully finished! Result: {job['result_url']}")

    except Exception as e:
        logger.error(f"[JOB {job_id}] Execution failed: {e}", exc_info=True)
        job["status"] = "FAILED"
        job["stage"] = "FAILED"
        job["error"] = str(e)
        job["logs"].append(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] ERROR: {str(e)}")
        job["updated_at"] = utc_iso()


# -------------------------------------------------------------------------
# API Endpoints
# -------------------------------------------------------------------------

@router.post("", response_model=TryOnSubmitResponse, status_code=status.HTTP_202_ACCEPTED)
async def submit_tryon(
    background_tasks: BackgroundTasks,
    person_image: UploadFile = File(..., description="Shopper photo captured or uploaded"),
    garment_id: Optional[str] = Form(None, description="Catalog garment ID (e.g. garm_vf_sweater)"),
    garment_image: Optional[UploadFile] = File(None, description="Custom open-arm flatlay garment PNG"),
    category: str = Form("upper_body", description="upper_body, lower_body, or dresses"),
    garment_description: Optional[str] = Form(None, description="Garment description for diffusion conditioning"),
    provider: Optional[str] = Form(None, description="huggingface, fal, or fashn")
):
    """
    Submits a new virtual try-on inference job.
    Accepts person photo and garment (either via catalog garment_id or custom garment_image).
    Returns immediately with job_id and poll_url.
    """
    job_id = f"job_vton_{uuid.uuid4().hex[:10]}"
    person_bytes = await person_image.read()
    if not person_bytes or len(person_bytes) < 100:
        raise HTTPException(status_code=400, detail="Invalid or empty person_image.")

    # Resolve garment bytes
    garment_bytes = None
    resolved_desc = garment_description

    if garment_image:
        garment_bytes = await garment_image.read()
    elif garment_id:
        curr = os.path.abspath(os.path.dirname(__file__))
        assets_base = None
        while curr and os.path.dirname(curr) != curr:


            cand = os.path.join(curr, "frontend", "public", "assets")
            if os.path.exists(cand) and os.path.exists(os.path.join(cand, "garment_basic_sweater.png")):
                assets_base = cand
                break
            curr = os.path.dirname(curr)
        if not assets_base:
            assets_base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..", "frontend", "public", "assets"))



        asset_file = GARMENT_ASSET_MAP.get(garment_id, "garment_basic_sweater.png")
        asset_path = os.path.join(assets_base, asset_file)
        if not os.path.exists(asset_path):
            alt_path = asset_path.replace(".png", ".jpg")
            if os.path.exists(alt_path):
                asset_path = alt_path

        if os.path.exists(asset_path):
            with open(asset_path, "rb") as f:
                garment_bytes = f.read()

        if not resolved_desc:
            resolved_desc = GARMENT_DESC_MAP.get(garment_id, "tailored garment")

    if not garment_bytes:
        raise HTTPException(
            status_code=400,
            detail="Either a valid garment_id or an uploaded garment_image must be provided."
        )

    # Initialize job in store
    active_provider = provider or settings.TRYON_PROVIDER
    TRYON_JOBS[job_id] = {
        "job_id": job_id,
        "status": "QUEUED",
        "stage": "QUEUED",
        "progress": 0,
        "created_at": utc_iso(),
        "updated_at": utc_iso(),
        "result_url": None,
        "error": None,
        "provider": active_provider,
        "metrics": None,
        "logs": [f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] Job registered in queue."]
    }

    # Launch background worker
    background_tasks.add_task(
        _run_tryon_task,
        job_id,
        person_bytes,
        garment_bytes,
        category,
        resolved_desc,
        provider
    )

    return TryOnSubmitResponse(
        job_id=job_id,
        status="QUEUED",
        poll_url=f"/v1/tryon/{job_id}",
        created_at=TRYON_JOBS[job_id]["created_at"],
        category=category,
        provider=active_provider
    )


@router.get("/{job_id}", response_model=TryOnJobStatusResponse)
async def get_tryon_job(job_id: str):
    """
    Polls the status of an ongoing or completed try-on job.
    """
    job = TRYON_JOBS.get(job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Try-on job '{job_id}' not found."
        )

    return TryOnJobStatusResponse(
        job_id=job["job_id"],
        status=job["status"],
        stage=job.get("stage", "UNKNOWN"),
        progress=job.get("progress", 0),
        created_at=job["created_at"],
        updated_at=job["updated_at"],
        result_url=job.get("result_url"),
        error=job.get("error"),
        provider=job.get("provider"),
        metrics=job.get("metrics"),
        logs=job.get("logs", [])
    )
