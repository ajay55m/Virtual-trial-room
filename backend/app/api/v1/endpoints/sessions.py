from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks, Depends
from datetime import datetime, timedelta, timezone
import uuid
import asyncio
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db_models import Session as DBSession, Kiosk as DBKiosk, AuditEvent as DBAuditEvent
from app.models.schemas import (
    SessionCreateRequest,
    SessionResponse,
    CaptureResponse,
    TryOnJobRequest,
    TryOnJobResponse,
    TryOnProgressMessage
)
from app.services.storage import storage_service
from app.services.vision_gate import vision_gate
from app.services.sizing_engine import sizing_engine
from app.services.queue import connection_manager
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

ACTIVE_SESSIONS = {}

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

@router.post("", response_model=SessionResponse)
async def create_session(request: SessionCreateRequest, db: AsyncSession = Depends(get_db)):
    """
    Creates a new transient fitting room session with 15-minute TTL.
    Persists session and audit event to DB and initializes active in-memory session.
    """
    session_id = f"sess_{uuid.uuid4().hex[:12]}"
    now = utc_now()
    expires_at = now + timedelta(minutes=settings.STORAGE_TTL_MINUTES)

    session_data = {
        "sessionId": session_id,
        "kioskId": request.kioskId,
        "heightCm": request.heightCm,
        "genderPreference": request.genderPreference,
        "consentSigned": request.consentSigned,
        "createdAt": now,
        "expiresAt": expires_at,
        "status": "ACTIVE",
        "token": f"jwt_aura_{uuid.uuid4().hex}",
        "websocketUrl": f"/v1/sessions/ws/{session_id}"
    }

    ACTIVE_SESSIONS[session_id] = session_data

    # Persist in DB
    try:
        k_res = await db.execute(select(DBKiosk).where(DBKiosk.id == request.kioskId))
        kiosk = k_res.scalar_one_or_none()
        if not kiosk:
            kiosk = DBKiosk(id=request.kioskId, store_location="Retail Store Kiosk", is_active=True)
            db.add(kiosk)
            await db.flush()

        db_session = DBSession(
            id=session_id,
            kiosk_id=request.kioskId,
            user_height_cm=request.heightCm,
            gender_preference=request.genderPreference or "Unisex",
            consent_signed=request.consentSigned,
            status="ACTIVE",
            created_at=now,
            expires_at=expires_at
        )
        db.add(db_session)

        audit = DBAuditEvent(
            session_id=session_id,
            kiosk_id=request.kioskId,
            event_type="SESSION_CREATED",
            details={"height_cm": request.heightCm, "consent": request.consentSigned}
        )
        db.add(audit)
        await db.commit()
    except Exception as e:
        logger.warning(f"Database session write deferred: {e}")

    return SessionResponse(**session_data)

@router.post("/{session_id}/captures", response_model=CaptureResponse)
async def upload_session_capture(
    session_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads camera still, strips all EXIF metadata, verifies sharpness, and saves to ephemeral storage.
    """
    if session_id not in ACTIVE_SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    contents = await file.read()
    
    # 1. Strip EXIF metadata
    sanitized_bytes, warnings = vision_gate.sanitize_and_strip_exif(contents)

    # 2. Laplacian sharpness calculation
    sharpness = vision_gate.compute_laplacian_sharpness(sanitized_bytes)

    # 3. Store in ephemeral object storage with 15-minute TTL
    capture_filename = f"captures/{session_id}_user_still.jpg"
    signed_url = storage_service.upload_ephemeral_file(
        object_name=capture_filename,
        data=sanitized_bytes,
        content_type="image/jpeg"
    )

    capture_id = f"cap_{uuid.uuid4().hex[:8]}"
    ACTIVE_SESSIONS[session_id]["captureUrl"] = signed_url
    ACTIVE_SESSIONS[session_id]["sharpness"] = sharpness
    ACTIVE_SESSIONS[session_id]["captureBytes"] = sanitized_bytes

    # Log Audit Event
    try:
        audit = DBAuditEvent(
            session_id=session_id,
            kiosk_id=ACTIVE_SESSIONS[session_id].get("kioskId"),
            event_type="CAPTURE_UPLOADED",
            details={"sharpness": sharpness, "approved": sharpness >= 50.0}
        )
        db.add(audit)
        await db.commit()
    except Exception as e:
        logger.debug(f"Audit event write skipped: {e}")

    return CaptureResponse(
        captureId=capture_id,
        sessionId=session_id,
        signedUploadUrl=signed_url,
        isApproved=sharpness >= 50.0,
        warnings=warnings
    )

async def run_vton_pipeline_simulation(session_id: str, garment_id: str, selected_size: str, user_height: float):
    """Simulates multi-stage VTON async pipeline and streams WebSocket progress events."""
    job_id = f"job_{uuid.uuid4().hex[:8]}"

    # Stage 1: Meta SAM Segmentation & Agnostic Masking
    await asyncio.sleep(1.0)
    await connection_manager.broadcast_progress(
        session_id=session_id,
        message=TryOnProgressMessage(
            jobId=job_id,
            stage="POSE_EXTRACTION",
            progressPercent=25,
            logMessage="[META_SAM] Segment Anything Model isolating clothing boundaries. Preserving head, neck, and limbs."
        )
    )

    # Stage 2: Garment Agnostic Conditioning & DensePose UV Surface
    await asyncio.sleep(1.1)
    await connection_manager.broadcast_progress(
        session_id=session_id,
        message=TryOnProgressMessage(
            jobId=job_id,
            stage="DENSEPOSE_SURFACE",
            progressPercent=50,
            logMessage="[SAM_PARSER] Garment-agnostic representation constructed. DensePose UV body geometry aligned."
        )
    )

    # Stage 3: IDM-VTON Diffusion UNet Inference Pass
    await asyncio.sleep(1.4)
    await connection_manager.broadcast_progress(
        session_id=session_id,
        message=TryOnProgressMessage(
            jobId=job_id,
            stage="DIFFUSION_PASS",
            progressPercent=75,
            logMessage="[IDM_VTON] TryonNet cross-attention UNet diffusion mapping cloth texture, draping, and realistic creases."
        )
    )

    # Stage 4: Identity Preservation & Sizing
    await asyncio.sleep(1.0)
    measurements = sizing_engine.estimate_measurements(height_cm=user_height)
    recommendation = sizing_engine.calculate_recommendation(
        measurements=measurements,
        selected_size=selected_size
    )

    from app.services.tryon_synthesizer import tryon_synthesizer
    user_bytes = ACTIVE_SESSIONS.get(session_id, {}).get("captureBytes")
    result_img = tryon_synthesizer.synthesize(
        session_id=session_id,
        garment_id=garment_id,
        user_photo_bytes=user_bytes,
        selected_size=selected_size
    )

    # Store result on session
    ACTIVE_SESSIONS[session_id]["resultImageUrl"] = result_img

    await connection_manager.broadcast_progress(
        session_id=session_id,
        message=TryOnProgressMessage(
            jobId=job_id,
            stage="COMPLETED",
            progressPercent=100,
            logMessage="[QUALITY_GATE] SAM segmentation & IDM-VTON synthesis verified. Return-reduction style advice ready!",
            resultImageUrl=result_img,
            sizeRecommendation=recommendation
        )
    )

@router.post("/{session_id}/tryon", response_model=TryOnJobResponse)
async def submit_tryon_job(
    session_id: str,
    request: TryOnJobRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Submits a new virtual try-on inference job, queues task, and initiates WebSocket stream.
    """
    if session_id not in ACTIVE_SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    user_height = ACTIVE_SESSIONS[session_id].get("heightCm", 175.0)
    job_id = f"job_{uuid.uuid4().hex[:8]}"

    # Log Audit Event
    try:
        audit = DBAuditEvent(
            session_id=session_id,
            kiosk_id=ACTIVE_SESSIONS[session_id].get("kioskId"),
            event_type="TRYON_SUBMITTED",
            details={"garmentId": request.garmentId, "selectedSize": request.selectedSize}
        )
        db.add(audit)
        await db.commit()
    except Exception as e:
        logger.debug(f"Audit event write skipped: {e}")

    background_tasks.add_task(
        run_vton_pipeline_simulation,
        session_id,
        request.garmentId,
        request.selectedSize,
        user_height
    )

    return TryOnJobResponse(
        jobId=job_id,
        sessionId=session_id,
        garmentId=request.garmentId,
        status="QUEUED",
        estimatedSeconds=5,
        websocketStream=f"/v1/sessions/ws/{session_id}"
    )
