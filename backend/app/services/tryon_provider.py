"""
AURA TryOnProvider Interface and Real Generative Model Integrations.
Complies with strict virtual trial room honesty requirements:
- Strictly executes real generative model inference.
- Never returns static pre-made fallback images.
- Implements transparent error handling and failure reporting.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
import io
import os
import base64
import tempfile
import time
import logging
from typing import Optional, Dict, Any
from PIL import Image
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


# -------------------------------------------------------------------------
# Custom Exceptions
# -------------------------------------------------------------------------

class TryOnError(Exception):
    """Base exception for all virtual try-on failures."""
    def __init__(self, message: str, provider: str = "unknown", details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.details = details or {}


class TryOnAuthError(TryOnError):
    """Raised when API credentials for the try-on provider are missing or invalid."""
    pass


class TryOnInferenceError(TryOnError):
    """Raised when the VTON generative model fails during inference."""
    pass


class TryOnTimeoutError(TryOnError):
    """Raised when inference exceeds maximum time limit."""
    pass


class FaceIdentityMismatchError(TryOnError):
    """Raised when post-generation identity verification detects face drift."""
    pass


# -------------------------------------------------------------------------
# Result Schema
# -------------------------------------------------------------------------

@dataclass
class TryOnResult:
    image_bytes: bytes
    provider_name: str
    latency_seconds: float
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_pil(self) -> Image.Image:
        return Image.open(io.BytesIO(self.image_bytes)).convert("RGB")


# -------------------------------------------------------------------------
# Abstract Interface
# -------------------------------------------------------------------------

class TryOnProvider(ABC):
    """
    Standard interface for all real virtual try-on models.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Returns the human-readable identifier of the provider."""
        pass

    @abstractmethod
    def try_on(
        self,
        person_image_bytes: bytes,
        garment_image_bytes: bytes,
        category: str = "upper_body",
        garment_description: Optional[str] = None
    ) -> TryOnResult:
        """
        Executes real photoreal try-on model inference.

        Args:
            person_image_bytes: Raw JPEG/PNG bytes of the shopper's validated capture.
            garment_image_bytes: Raw PNG bytes of the open-arm flatlay garment.
            category: One of "upper_body", "lower_body", "dresses".
            garment_description: Optional natural language description of the garment.

        Returns:
            TryOnResult with output JPEG bytes and execution metadata.

        Raises:
            TryOnAuthError: If provider credentials are invalid or missing.
            TryOnInferenceError: If model prediction fails or returns empty result.
            TryOnTimeoutError: If the remote space or API times out.
        """
        pass


# -------------------------------------------------------------------------
# Concrete Provider: Hugging Face IDM-VTON ZeroGPU
# -------------------------------------------------------------------------

class HuggingFaceIDMVTONProvider(TryOnProvider):
    """
    Inference client for yisol/IDM-VTON on Hugging Face Spaces (ZeroGPU).
    License: CC BY-NC-SA 4.0 (Non-commercial research).
    """

    def __init__(self, space_id: str = "yisol/IDM-VTON", hf_token: Optional[str] = None):
        self.space_id = space_id
        self.hf_token = hf_token or settings.HF_TOKEN or os.environ.get("HF_TOKEN") or ""
        self._client = None

    @property
    def name(self) -> str:
        return f"HuggingFace ({self.space_id})"

    def _get_client(self):
        if self._client is None:
            try:
                from gradio_client import Client
                token_arg = self.hf_token if self.hf_token else None
                logger.info(f"[HF_IDM_VTON] Connecting to {self.space_id}...")
                self._client = Client(self.space_id, token=token_arg)
                logger.info(f"[HF_IDM_VTON] Successfully connected to {self.space_id}.")
            except Exception as e:
                logger.error(f"[HF_IDM_VTON] Connection initialization failed: {e}")
                raise TryOnInferenceError(
                    message=f"Failed to connect to Hugging Face Space '{self.space_id}': {e}",
                    provider=self.name,
                    details={"space_id": self.space_id, "error": str(e)}
                )
        return self._client

    def try_on(
        self,
        person_image_bytes: bytes,
        garment_image_bytes: bytes,
        category: str = "upper_body",
        garment_description: Optional[str] = None
    ) -> TryOnResult:
        start_time = time.time()
        client = self._get_client()

        from gradio_client import handle_file

        tmp_person = None
        tmp_garment = None

        try:
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f_p:
                f_p.write(person_image_bytes)
                tmp_person = f_p.name

            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f_g:
                f_g.write(garment_image_bytes)
                tmp_garment = f_g.name

            desc = garment_description or "tailored garment"
            logger.info(
                f"[HF_IDM_VTON] Submitting try-on inference to {self.space_id}: category={category}, desc='{desc}'"
            )

            result = client.predict(
                dict={
                    "background": handle_file(tmp_person),
                    "layers": [],
                    "composite": handle_file(tmp_person)
                },
                garm_img=handle_file(tmp_garment),
                garment_des=desc,
                is_checked=True,
                is_checked_crop=False,
                denoise_steps=30,
                seed=42,
                api_name="/tryon"
            )

            if not result or not isinstance(result, (tuple, list)) or len(result) == 0:
                raise TryOnInferenceError(
                    message="IDM-VTON model returned an empty prediction response.",
                    provider=self.name,
                    details={"raw_result": str(result)}
                )

            output_file_path = result[0]
            if not output_file_path or not os.path.exists(output_file_path):
                raise TryOnInferenceError(
                    message=f"Generated output image path does not exist: {output_file_path}",
                    provider=self.name
                )

            with open(output_file_path, "rb") as out_f:
                out_bytes = out_f.read()

            latency = time.time() - start_time
            logger.info(f"[HF_IDM_VTON] Inference succeeded in {latency:.2f}s ({len(out_bytes)} bytes)")

            return TryOnResult(
                image_bytes=out_bytes,
                provider_name=self.name,
                latency_seconds=latency,
                metadata={
                    "category": category,
                    "description": desc,
                    "space_id": self.space_id,
                    "steps": 30
                }
            )

        except TryOnError:
            raise
        except Exception as e:
            latency = time.time() - start_time
            logger.error(f"[HF_IDM_VTON] Inference failed after {latency:.2f}s: {e}", exc_info=True)
            raise TryOnInferenceError(
                message=f"IDM-VTON execution failed: {e}",
                provider=self.name,
                details={"latency_seconds": latency, "error": str(e)}
            )
        finally:
            for path in [tmp_person, tmp_garment]:
                if path and os.path.exists(path):
                    try:
                        os.unlink(path)
                    except Exception:
                        pass


# -------------------------------------------------------------------------
# Concrete Provider: Fal.ai CatVTON
# -------------------------------------------------------------------------

class FalCatVTONProvider(TryOnProvider):
    """
    Inference client for fal-ai/cat-vton on Fal.ai.
    """

    def __init__(self, fal_key: Optional[str] = None):
        self.fal_key = fal_key or settings.FAL_KEY or os.environ.get("FAL_KEY") or ""

    @property
    def name(self) -> str:
        return "Fal.ai (CatVTON)"

    def try_on(
        self,
        person_image_bytes: bytes,
        garment_image_bytes: bytes,
        category: str = "upper_body",
        garment_description: Optional[str] = None
    ) -> TryOnResult:
        if not self.fal_key:
            raise TryOnAuthError(
                message="Fal.ai API key is missing. Set FAL_KEY in .env.",
                provider=self.name
            )

        start_time = time.time()
        os.environ["FAL_KEY"] = self.fal_key

        try:
            import fal_client

            person_b64 = f"data:image/jpeg;base64,{base64.b64encode(person_image_bytes).decode('utf-8')}"
            garment_b64 = f"data:image/png;base64,{base64.b64encode(garment_image_bytes).decode('utf-8')}"

            logger.info(f"[FAL_CATVTON] Submitting CatVTON inference to Fal.ai...")
            result = fal_client.subscribe(
                "fal-ai/cat-vton",
                arguments={
                    "person_image_url": person_b64,
                    "garment_image_url": garment_b64
                }
            )

            img_url = None
            if isinstance(result, dict):
                img_data = result.get("image")
                if isinstance(img_data, dict):
                    img_url = img_data.get("url")

            if not img_url:
                raise TryOnInferenceError(
                    message="Fal.ai returned no output image URL.",
                    provider=self.name,
                    details={"result": str(result)}
                )

            with httpx.Client(timeout=45.0) as client:
                resp = client.get(img_url)
                if resp.status_code != 200:
                    raise TryOnInferenceError(
                        message=f"Failed to download result image from Fal.ai URL: status {resp.status_code}",
                        provider=self.name
                    )
                out_bytes = resp.content

            latency = time.time() - start_time
            logger.info(f"[FAL_CATVTON] Inference succeeded in {latency:.2f}s ({len(out_bytes)} bytes)")

            return TryOnResult(
                image_bytes=out_bytes,
                provider_name=self.name,
                latency_seconds=latency,
                metadata={"url": img_url}
            )

        except TryOnError:
            raise
        except Exception as e:
            latency = time.time() - start_time
            logger.error(f"[FAL_CATVTON] Execution failed after {latency:.2f}s: {e}", exc_info=True)
            raise TryOnInferenceError(
                message=f"Fal.ai CatVTON failed: {e}",
                provider=self.name,
                details={"latency_seconds": latency, "error": str(e)}
            )


# -------------------------------------------------------------------------
# Concrete Provider: FASHN.ai (Apache 2.0 / Commercial SaaS)
# -------------------------------------------------------------------------

class FashnProvider(TryOnProvider):
    """
    Inference client for FASHN.ai Virtual Try-On API.
    License: Apache-2.0 / Commercial Retail.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.FASHN_API_KEY or os.environ.get("FASHN_API_KEY") or ""
        self.base_url = "https://api.fashn.ai/v1"

    @property
    def name(self) -> str:
        return "FASHN.ai (Commercial Retail)"

    def try_on(
        self,
        person_image_bytes: bytes,
        garment_image_bytes: bytes,
        category: str = "upper_body",
        garment_description: Optional[str] = None
    ) -> TryOnResult:
        if not self.api_key:
            raise TryOnAuthError(
                message="FASHN API key is missing. Set FASHN_API_KEY in .env.",
                provider=self.name
            )

        start_time = time.time()
        category_map = {
            "upper_body": "tops",
            "lower_body": "bottoms",
            "dresses": "one-pieces"
        }
        fashn_cat = category_map.get(category, "tops")

        person_b64 = f"data:image/jpeg;base64,{base64.b64encode(person_image_bytes).decode('utf-8')}"
        garment_b64 = f"data:image/png;base64,{base64.b64encode(garment_image_bytes).decode('utf-8')}"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        with httpx.Client(timeout=60.0) as client:
            submit_resp = client.post(
                f"{self.base_url}/run",
                headers=headers,
                json={
                    "model_image": person_b64,
                    "garment_image": garment_b64,
                    "category": fashn_cat,
                    "mode": "balanced"
                }
            )

            if submit_resp.status_code != 200:
                raise TryOnInferenceError(
                    message=f"FASHN submission failed with HTTP {submit_resp.status_code}: {submit_resp.text}",
                    provider=self.name
                )

            data = submit_resp.json()
            run_id = data.get("id")
            if not run_id:
                raise TryOnInferenceError(message="No run ID returned from FASHN API.", provider=self.name)

            # Poll for completion
            max_polls = 40
            for _ in range(max_polls):
                time.sleep(1.5)
                poll_resp = client.get(f"{self.base_url}/status/{run_id}", headers=headers)
                if poll_resp.status_code != 200:
                    continue
                p_data = poll_resp.json()
                status = p_data.get("status")
                if status == "completed":
                    output_urls = p_data.get("output", [])
                    if not output_urls:
                        raise TryOnInferenceError(message="FASHN completed but returned no output URLs.", provider=self.name)
                    img_resp = client.get(output_urls[0])
                    latency = time.time() - start_time
                    return TryOnResult(
                        image_bytes=img_resp.content,
                        provider_name=self.name,
                        latency_seconds=latency,
                        metadata={"run_id": run_id, "output_url": output_urls[0]}
                    )
                elif status == "failed":
                    error_msg = p_data.get("error", "Unknown FASHN error")
                    raise TryOnInferenceError(message=f"FASHN job failed: {error_msg}", provider=self.name)

            raise TryOnTimeoutError(message="FASHN try-on polling timed out after 60s.", provider=self.name)


# -------------------------------------------------------------------------
# Factory / Registry
# -------------------------------------------------------------------------

def get_tryon_provider(provider_type: Optional[str] = None) -> TryOnProvider:
    """
    Factory function returning the configured active TryOnProvider.
    """
    choice = (provider_type or settings.TRYON_PROVIDER or "huggingface").lower().strip()

    if choice in ["huggingface", "hf", "idm-vton", "idm_vton"]:
        return HuggingFaceIDMVTONProvider()
    elif choice in ["fal", "catvton", "cat-vton"]:
        return FalCatVTONProvider()
    elif choice in ["fashn", "fashn-ai", "fashn.ai"]:
        return FashnProvider()
    else:
        logger.warning(f"Unknown try-on provider '{choice}', defaulting to HuggingFace IDM-VTON.")
        return HuggingFaceIDMVTONProvider()
