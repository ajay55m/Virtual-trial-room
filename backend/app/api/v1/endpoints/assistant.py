import io
import os
import logging
from typing import Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from PIL import Image

class TokenUpdateRequest(BaseModel):
    token: str

from app.models.schemas import (
    StyleAdviceRequest,
    StyleAdviceResponse,
    AssistantChatRequest,
    AssistantChatResponse,
)
from app.services.style_assistant import style_assistant
from app.services.sam_segmenter import sam_segmenter
from app.api.v1.endpoints.catalog import CATALOG_ITEMS
from app.api.v1.endpoints.sessions import ACTIVE_SESSIONS

logger = logging.getLogger(__name__)
router = APIRouter()

def get_garment_by_id(garment_id: str) -> Optional[dict]:
    for g in CATALOG_ITEMS:
        if g.get("id") == garment_id:
            return g
    # Fallback placeholder garment
    return {
        "id": garment_id,
        "name": "Luxury Garment",
        "category": "Upper",
        "fabricComposition": "100% Premium Cotton",
        "stretchClass": "Medium",
        "price": "$120"
    }

@router.post("/advice", response_model=StyleAdviceResponse)
async def get_style_advice(request: StyleAdviceRequest):
    """
    Returns Llama-powered style advice, body proportion fit verdict,
    return risk scoring (0-100%), and tailored outfit matches.
    """
    garment = get_garment_by_id(request.garmentId)
    if not garment:
        raise HTTPException(status_code=404, detail="Garment not found")

    user_height = request.heightCm or 175.0
    if request.sessionId in ACTIVE_SESSIONS:
        user_height = ACTIVE_SESSIONS[request.sessionId].get("heightCm", user_height)

    advice = await style_assistant.get_style_advice(
        session_id=request.sessionId,
        garment=garment,
        selected_size=request.selectedSize,
        user_height=user_height,
        fit_intent=request.fitIntent or "Regular"
    )
    return advice

@router.post("/chat", response_model=AssistantChatResponse)
async def chat_with_assistant(request: AssistantChatRequest):
    """
    Conversational stylist powered by Meta Llama. Answers customer queries
    regarding sizing, draping, fabric care, and occasion matching.
    """
    garment = get_garment_by_id(request.garmentId)
    if not garment:
        raise HTTPException(status_code=404, detail="Garment not found")

    chat_resp = await style_assistant.chat(
        session_id=request.sessionId,
        garment=garment,
        selected_size=request.selectedSize,
        user_message=request.userMessage,
        chat_history=request.chatHistory
    )
    return chat_resp

@router.get("/status")
async def get_assistant_status():
    """
    Checks Hugging Face token authentication status and Meta Llama 3.2 availability.
    """
    return await style_assistant.check_connection()

@router.post("/token")
async def update_assistant_token(body: TokenUpdateRequest):
    """
    Validates and updates Hugging Face API token for Llama 3.2 and SAM models.
    """
    new_token = body.token.strip()
    if not new_token:
        raise HTTPException(status_code=400, detail="Token cannot be empty")
    
    style_assistant.update_token(new_token)
    status = await style_assistant.check_connection()
    return status

@router.post("/segment")
async def run_sam_segmentation(session_id: str, garment_id: str):
    """
    Executes Meta SAM to segment clothing and body regions from the active session capture.
    Returns agnostic mask statistics and preview paths.
    """
    if session_id not in ACTIVE_SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    user_bytes = ACTIVE_SESSIONS[session_id].get("captureBytes")
    if not user_bytes:
        raise HTTPException(status_code=400, detail="No photo captured for this session yet")

    try:
        user_img = Image.open(io.BytesIO(user_bytes)).convert("RGB")
        garment = get_garment_by_id(garment_id)
        cat = garment.get("category", "Upper") if garment else "Upper"

        agnostic_img, agnostic_mask, metadata = sam_segmenter.generate_garment_agnostic_mask(user_img, category=cat)

        captures_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "frontend", "public", "assets", "captures")
        )
        os.makedirs(captures_dir, exist_ok=True)

        mask_file = f"{session_id}_sam_mask.png"
        agnostic_file = f"{session_id}_sam_agnostic.jpg"
        agnostic_mask.save(os.path.join(captures_dir, mask_file))
        agnostic_img.save(os.path.join(captures_dir, agnostic_file), format="JPEG", quality=90)

        return {
            "status": "SUCCESS",
            "sessionId": session_id,
            "maskUrl": f"/assets/captures/{mask_file}",
            "agnosticImageUrl": f"/assets/captures/{agnostic_file}",
            "metadata": metadata
        }
    except Exception as e:
        logger.error(f"[SAM_ENDPOINT] Segmentation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
