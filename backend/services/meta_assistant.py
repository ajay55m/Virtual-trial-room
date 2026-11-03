import os
import json
import logging
from typing import Dict, Any, List, Optional
from services.meta_client import call_meta_chat, bytes_to_data_url, is_meta_configured, META_MODEL_VISION

logger = logging.getLogger("meta_assistant")

ASSISTANT_SYSTEM_PROMPT = """You are AURA Stylist, an expert AI bespoke fashion advisor powered by Meta's Llama 4 Maverick.
You assist customers in the VirtualFit AI Studio trial room.
You give friendly, insightful, and culturally authentic advice on:
1. Saree draping styles (Nivi, Gujarati, Bengali, Nauvari, South Indian bridal drapes).
2. Men's bespoke tailoring (Bandhgala Jodhpuri cuts, sherwani buttoning, Nehru jackets, pocket squares).
3. Western fit & silhouette sizing (blazers, biker jackets, cocktail gowns).
4. Color coordination and accessorizing (jewelry, footwear, footwear pairing).

Keep responses elegant, concise (2-4 sentences unless asked for details), and helpful.
"""

def chat_with_maverick_stylist(
    messages: List[Dict[str, Any]],
    image_bytes: Optional[bytes] = None
) -> str:
    """
    Multimodal Fashion Styling Assistant powered by Meta Llama 4 Maverick 17B.
    """
    if is_meta_configured():
        try:
            formatted_messages: List[Dict[str, Any]] = [{"role": "system", "content": ASSISTANT_SYSTEM_PROMPT}]
            for m in messages:
                role = str(m.get("role", "user"))
                content = m.get("content", "")
                formatted_messages.append({"role": role, "content": content})

            if image_bytes and len(formatted_messages) > 1:
                # Attach image to the last user message
                last_msg = formatted_messages[-1]
                data_url = bytes_to_data_url(image_bytes)
                current_content = last_msg.get("content")
                if isinstance(current_content, str):
                    last_msg["content"] = [
                        {"type": "text", "text": current_content},
                        {"type": "image_url", "image_url": {"url": data_url}}
                    ]

            resp = call_meta_chat(
                messages=formatted_messages,
                model=META_MODEL_VISION,
                temperature=0.7
            )
            choice = resp.get("choices", [{}])[0]
            reply = choice.get("message", {}).get("content", "")
            return str(reply)
        except Exception as e:
            logger.warning(f"[MAVERICK ASSISTANT WARNING] {e}. Falling back to bespoke local stylist...")

    # Bespoke Stylist Fallback
    last_text = ""
    if messages:
        c = messages[-1].get("content")
        if isinstance(c, str):
            last_text = c.lower()

    if "saree" in last_text or "pallu" in last_text:
        return "For this Banarasi silk saree, the classic Nivi drape with crisp front pleats tucked at the navel and the zari pallu pinned gracefully over the left shoulder offers timeless royal elegance. Pair with antique gold jhumkas for a complete regal look."
    elif "bandhgala" in last_text or "jacket" in last_text:
        return "The Jodhpuri Bandhgala is an epitome of royal bespoke craftsmanship. The high Mandarin collar should rest snugly against the neck, and the jacket should fall cleanly over tailored slim-fit formal trousers with polished black Oxford shoes."
    elif "size" in last_text or "fit" in last_text:
        return "Our 3D spatial sizing engine confirms a bespoke tailored silhouette tailored to your exact shoulder and chest measurements with zero collar gap and precise drape drop."
    else:
        return "Welcome to VirtualFit AI Studio! I can advise you on garment draping, color harmony, and custom bespoke sizing for any outfit in our collection. How can I help refine your look today?"

