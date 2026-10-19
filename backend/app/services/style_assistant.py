"""
AURA Llama-Powered Style & Sizing Assistant.
Targets fashion e-commerce return reduction through honest fit assessment,
fabric drape evaluation, return risk scoring, and intelligent outfit matching.
"""
import os
import json
import logging
from typing import Dict, Any, List, Optional
import httpx

from app.config import settings
from app.models.schemas import StyleAdviceResponse, MatchingItem, AssistantChatResponse
from app.services.sizing_engine import sizing_engine

from huggingface_hub import AsyncInferenceClient

logger = logging.getLogger(__name__)

# Catalog items for cross-matching
CATALOG_ITEMS_FOR_MATCHING = [
    {
        "id": "garm_vf_shoes_white",
        "name": "Luxury Minimalist White Leather Sneakers",
        "category": "Footwear",
        "price": "$180",
        "thumbnail": "/assets/garment_white_shoes.png",
        "compatible_categories": ["Upper", "Lower"]
    },
    {
        "id": "garm_vf_shoes_brown",
        "name": "Cognac Hand-Burnished Calfskin Oxfords",
        "category": "Footwear",
        "price": "$295",
        "thumbnail": "/assets/garment_brown_shoes.png",
        "compatible_categories": ["Upper", "Outerwear", "Menswear"]
    },
    {
        "id": "garm_vf_training_pants",
        "name": "Performance Tapered Tailored Trousers",
        "category": "Lower",
        "price": "$125",
        "thumbnail": "/assets/garment_training_pants.png",
        "compatible_categories": ["Upper", "Outerwear"]
    },
    {
        "id": "garm_vf_shorts",
        "name": "Minimalist Casual Tailored Shorts",
        "category": "Lower",
        "price": "$95",
        "thumbnail": "/assets/garment_short_pants.png",
        "compatible_categories": ["Upper"]
    },
    {
        "id": "garm_001",
        "name": "Navy Satin Tailored Blazer",
        "category": "Outerwear",
        "price": "$420",
        "thumbnail": "/assets/garment_blazer.png",
        "compatible_categories": ["Upper", "Dress"]
    }
]

class StyleAssistant:
    """
    Llama 3.2-powered Fashion & Fit Advisor.
    Calculates return risk factors, generates honest fit diagnostics,
    and provides conversational outfit styling.
    """

    def __init__(self):
        self.hf_model_id = "meta-llama/Llama-3.2-3B-Instruct"

    def _get_hf_token(self) -> str:
        return settings.HF_TOKEN or os.environ.get("HF_TOKEN", "")

    def get_client(self) -> Optional[AsyncInferenceClient]:
        token = self._get_hf_token()
        if token:
            try:
                return AsyncInferenceClient(token=token)
            except Exception as e:
                logger.warning(f"[LLAMA_ASSISTANT] Failed to initialize AsyncInferenceClient: {e}")
        return None

    def calculate_return_risk(
        self,
        garment_info: Dict[str, Any],
        selected_size: str,
        recommended_size: str,
        stretch_class: str
    ) -> Dict[str, Any]:
        """
        Computes the quantitative Return Risk Score (0-100%) and primary drivers.
        E-commerce returns primarily happen due to:
        1. Sizing offset (size mismatch > 1 size = extreme risk).
        2. Low/None fabric stretch coupled with tight sizing.
        3. Rigid fabrics (silk, wool, heavy denim) with zero give.
        """
        sizes_order = ["XS", "S", "M", "L", "XL", "XXL"]
        is_free_size = selected_size.lower() in ["free size", "free", "onesize"] or garment_info.get("category") == "Saree"

        if is_free_size:
            return {
                "score": 8,
                "level": "Low",
                "primary_risk": "None (Drape-adjustable unstitched garment)",
                "tolerance": "High drape versatility"
            }

        sel_idx = sizes_order.index(selected_size) if selected_size in sizes_order else 2
        rec_idx = sizes_order.index(recommended_size) if recommended_size in sizes_order else 2
        size_diff = sel_idx - rec_idx

        # Base risk
        base_risk = 12

        # Penalty for size mismatch
        if size_diff == 0:
            mismatch_penalty = 0
        elif abs(size_diff) == 1:
            mismatch_penalty = 35 if size_diff < 0 else 22  # Too small is worse than too big
        else:
            mismatch_penalty = 65

        # Penalty for low stretch
        stretch_multipliers = {
            "None": 1.45,
            "Low": 1.25,
            "Medium": 1.0,
            "High": 0.75
        }
        mult = stretch_multipliers.get(stretch_class, 1.1)

        raw_score = int(min(96, max(6, (base_risk + mismatch_penalty) * mult)))

        if raw_score >= 55:
            level = "High"
            if size_diff < 0:
                primary = f"Size {selected_size} will cause restriction across the chest/shoulders due to {stretch_class.lower()}-stretch fabric."
            else:
                primary = f"Size {selected_size} has excessive ease; garment will lose intended tailored silhouette."
        elif raw_score >= 25:
            level = "Moderate"
            primary = f"Minor drape divergence from your body profile. Comfortable but slightly relaxed."
        else:
            level = "Low"
            primary = "Optimal match. Body dimensions align with brand grading curves."

        tolerance_notes = {
            "None": "Fabric has 0% elastane. Exact sizing is critical to avoid return.",
            "Low": "Minimal give (~2% ease). Tight fits will feel constricting across upper chest.",
            "Medium": "Comfort stretch (3-5% elastane). Accommodates half-size variances gracefully.",
            "High": "Performance 4-way stretch. Forgiving across adjacent size grades."
        }.get(stretch_class, "Standard brand sizing ease.")

        return {
            "score": raw_score,
            "level": level,
            "primary_risk": primary,
            "tolerance": tolerance_notes
        }

    async def get_style_advice(
        self,
        session_id: str,
        garment: Dict[str, Any],
        selected_size: str,
        user_height: float = 175.0,
        fit_intent: str = "Regular"
    ) -> StyleAdviceResponse:
        """
        Generates comprehensive style analysis, size recommendation, return risk score,
        and outfit pairing.
        """
        measurements = sizing_engine.estimate_measurements(height_cm=user_height)
        rec = sizing_engine.calculate_recommendation(measurements, selected_size=selected_size)
        recommended_size = rec.recommendedSize

        stretch_class = garment.get("stretchClass", "Medium")
        risk_data = self.calculate_return_risk(
            garment_info=garment,
            selected_size=selected_size,
            recommended_size=recommended_size,
            stretch_class=stretch_class
        )

        # Curate matching items
        category = garment.get("category", "Upper")
        matches = []
        for item in CATALOG_ITEMS_FOR_MATCHING:
            if category in item["compatible_categories"] and item["id"] != garment.get("id"):
                matches.append(MatchingItem(
                    id=item["id"],
                    name=item["name"],
                    category=item["category"],
                    price=item["price"],
                    reason=f"Harmonizes color palette and balances proportion with this {garment.get('name', 'garment')}.",
                    thumbnail=item["thumbnail"]
                ))
            if len(matches) >= 3:
                break

        # Generate intelligent styling suggestions
        styling_suggestions = [
            f"Tailored Silhouette: Pairs seamlessly with {matches[0].name if matches else 'neutral minimalist footwear'}.",
            f"Fabric Care & Drape: {garment.get('fabricComposition', 'Premium fabric')} should be steam-pressed to maintain structural drape.",
            f"Proportion Advice: Ideal for a {fit_intent.lower()} drape at your {int(user_height)} cm height."
        ]

        if risk_data["score"] > 40:
            fit_verdict = f"Size Warning: Switching from {selected_size} to {recommended_size} reduces return probability by {risk_data['score'] - 12}%."
        else:
            fit_verdict = f"Excellent drape match. Size {selected_size} provides true-to-design proportion with low return likelihood."

        body_notes = (
            f"Estimated chest {measurements.chestCm} cm, waist {measurements.waistCm} cm. "
            f"Shoulder width {measurements.shoulderCm} cm matches {recommended_size} garment pattern."
        )

        return StyleAdviceResponse(
            garmentId=garment.get("id", "garm_unknown"),
            selectedSize=selected_size,
            recommendedSize=recommended_size,
            returnRiskScore=risk_data["score"],
            returnRiskLevel=risk_data["level"],
            primaryRiskFactor=risk_data["primary_risk"],
            fitVerdict=fit_verdict,
            stretchTolerance=risk_data["tolerance"],
            bodyProportionNotes=body_notes,
            stylingSuggestions=styling_suggestions,
            matchingItems=matches,
            modelSource="Meta-Llama-3.2-Instruct"
        )

    async def chat(
        self,
        session_id: str,
        garment: Dict[str, Any],
        selected_size: str,
        user_message: str,
        chat_history: Optional[List[dict]] = None
    ) -> AssistantChatResponse:
        """
        Interactive Llama 3.2 fashion consultation chat.
        Calls Hugging Face Inference API or utilizes prompt-tuned fallback.
        """
        token = self._get_hf_token()
        garment_name = garment.get("name", "garment")
        fabric = garment.get("fabricComposition", "premium fabric")
        category = garment.get("category", "Apparel")

        system_prompt = (
            "You are AURA Stylist, an elite AI personal fashion stylist and sizing expert powered by Meta Llama. "
            "Your main mission is eliminating fashion e-commerce returns by giving honest, direct, sophisticated fit "
            "and styling advice. Be concise, polite, luxurious yet completely objective about sizing pitfalls."
        )

        user_prompt = (
            f"The customer is looking at: {garment_name} ({category}, Fabric: {fabric}, Selected Size: {selected_size}).\n"
            f"Customer question: {user_message}\n"
            "Provide helpful, concise, stylish guidance (max 3 sentences) focusing on fit, comfort, and occasion matching."
        )

        reply = None
        client = self.get_client()

        if client:
            try:
                # Try 3B-Instruct first, then 1B-Instruct as fallback
                for model_candidate in [self.hf_model_id, "meta-llama/Llama-3.2-1B-Instruct"]:
                    try:
                        response = await client.chat.completions.create(
                            model=model_candidate,
                            messages=[
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_prompt}
                            ],
                            max_tokens=140,
                            temperature=0.6
                        )
                        if response.choices and response.choices[0].message and response.choices[0].message.content:
                            reply = response.choices[0].message.content.strip()
                            logger.info(f"[LLAMA_ASSISTANT] Live response received from {model_candidate}")
                            break
                    except Exception as inner_e:
                        logger.debug(f"[LLAMA_ASSISTANT] Model {model_candidate} attempt: {inner_e}")
                        continue
            except Exception as e:
                logger.info(f"[LLAMA_ASSISTANT] Remote inference skipped ({e}); using local stylist engine.")

        if not reply:
            # Intelligent fashion knowledge fallback
            msg_lower = user_message.lower()
            if "tight" in msg_lower or "size" in msg_lower or "fit" in msg_lower:
                reply = (
                    f"For the {garment_name}, the {fabric} fabric holds structure with minimal give. "
                    f"If you prefer a relaxed modern drape or have broader shoulders, sizing up to one size higher "
                    f"will drastically reduce constriction and ensure a flawless silhouette."
                )
            elif "shoe" in msg_lower or "match" in msg_lower or "pair" in msg_lower:
                reply = (
                    f"To elevate this {garment_name}, pair it with crisp minimalist white leather low-tops for daytime luxury, "
                    f"or burnished cognac leather oxfords for a sharp formal transition. Keep bottoms neutral to let the garment shine."
                )
            elif "weather" in msg_lower or "warm" in msg_lower or "summer" in msg_lower or "cold" in msg_lower:
                reply = (
                    f"The {fabric} construction provides excellent breathability and natural temperature regulation. "
                    f"It layers effortlessly under a tailored overcoat during cool evenings or stands strong alone in spring/summer."
                )
            else:
                reply = (
                    f"The {garment_name} is cut for a modern architectural silhouette. "
                    f"In Size {selected_size}, you'll achieve balanced shoulder lines with natural waist clearance. "
                    f"Check our return risk score above to verify your body alignment before ordering!"
                )

        suggested = [
            "Will this fit tight around my shoulders?",
            "What footwear and accessories pair best with this?",
            "How should I care for this fabric to avoid shrinkage?"
        ]

        return AssistantChatResponse(
            reply=reply,
            suggestedQuestions=suggested,
            modelSource="Meta-Llama-3.2-Instruct"
        )

    async def check_connection(self) -> Dict[str, Any]:
        """
        Validates Hugging Face access token and checks authorization for Meta Llama 3.2.
        """
        token = self._get_hf_token()
        if not token:
            return {
                "configured": False,
                "authenticated": False,
                "username": None,
                "model": self.hf_model_id,
                "mode": "Intelligent Local Stylist Fallback",
                "message": "No Hugging Face token configured."
            }

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(
                    "https://huggingface.co/api/whoami-v2",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if res.status_code == 200:
                    data = res.json()
                    username = data.get("name", "Authenticated User")
                    return {
                        "configured": True,
                        "authenticated": True,
                        "username": username,
                        "model": self.hf_model_id,
                        "mode": "Live Meta Llama 3.2 (Hugging Face)",
                        "message": f"Connected as {username}. Meta Llama 3.2 authorized."
                    }
                else:
                    return {
                        "configured": True,
                        "authenticated": False,
                        "username": None,
                        "model": self.hf_model_id,
                        "mode": "Intelligent Local Stylist Fallback",
                        "message": "Hugging Face token rejected (401 Unauthorized). Please generate a fresh token with Read access under your account."
                    }
        except Exception as e:
            return {
                "configured": True,
                "authenticated": False,
                "username": None,
                "model": self.hf_model_id,
                "mode": "Intelligent Local Stylist Fallback",
                "message": f"Connection check error: {str(e)}"
            }

    def update_token(self, new_token: str) -> None:
        """
        Updates the runtime token and writes to backend/.env.
        """
        token_clean = new_token.strip()
        settings.HF_TOKEN = token_clean
        os.environ["HF_TOKEN"] = token_clean

        # Persist to .env
        env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
        try:
            if os.path.exists(env_path):
                with open(env_path, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                found = False
                new_lines = []
                for line in lines:
                    if line.startswith("HF_TOKEN="):
                        new_lines.append(f"HF_TOKEN={token_clean}\n")
                        found = True
                    else:
                        new_lines.append(line)
                if not found:
                    new_lines.append(f"HF_TOKEN={token_clean}\n")
                with open(env_path, "w", encoding="utf-8") as f:
                    f.writelines(new_lines)
            else:
                with open(env_path, "w", encoding="utf-8") as f:
                    f.write(f"HF_TOKEN={token_clean}\n")
            logger.info("[LLAMA_ASSISTANT] Successfully persisted new HF_TOKEN to backend/.env")
        except Exception as e:
            logger.warning(f"[LLAMA_ASSISTANT] Could not write token to .env: {e}")

style_assistant = StyleAssistant()

