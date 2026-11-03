import os
import json
import base64
import logging
import requests
from typing import Optional, Dict, Any, List

logger = logging.getLogger("meta_client")
logging.basicConfig(level=logging.INFO)

META_BASE_URL = os.getenv("META_BASE_URL", "https://api.llama.com/v1").rstrip("/")
META_API_KEY = os.getenv("META_API_KEY", "")
META_MODEL_REASONING = os.getenv("META_MODEL_REASONING", "Muse Spark")
META_MODEL_FAST = os.getenv("META_MODEL_FAST", "Llama-4-Scout-17B-16E-Instruct-FP8")
META_MODEL_VISION = os.getenv("META_MODEL_VISION", "Llama-4-Maverick-17B-128E-Instruct-FP8")

def is_meta_configured() -> bool:
    return bool(os.getenv("META_API_KEY"))

def bytes_to_data_url(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{b64}"

def call_meta_chat(
    messages: List[Dict[str, Any]],
    model: Optional[str] = None,
    tools: Optional[List[Dict[str, Any]]] = None,
    response_format: Optional[Dict[str, str]] = None,
    temperature: float = 0.2,
    max_tokens: int = 1500,
    timeout: int = 30
) -> Dict[str, Any]:
    """
    Executes a POST request to the Meta Llama API (POST /v1/chat/completions).
    Powers Muse Spark reasoning, Llama 4 Scout fast validation, and Maverick vision.
    """
    api_key = os.getenv("META_API_KEY", "")
    if not api_key:
        raise ValueError("META_API_KEY is not set in environment or .env file.")

    target_model = model or META_MODEL_REASONING
    endpoint = f"{META_BASE_URL}/chat/completions"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload: Dict[str, Any] = {
        "model": target_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens
    }

    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"

    if response_format:
        payload["response_format"] = response_format

    logger.info(f"[META API] Invoking model='{target_model}' at {endpoint}...")
    resp = requests.post(endpoint, headers=headers, json=payload, timeout=timeout)
    
    if not resp.ok:
        logger.error(f"[META API ERROR] Status {resp.status_code}: {resp.text}")
        resp.raise_for_status()

    return resp.json()
