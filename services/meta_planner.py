import os
import json
import logging
from typing import Dict, Any, Optional, Tuple
from services.meta_client import call_meta_chat, bytes_to_data_url, is_meta_configured, META_MODEL_REASONING
from services.meta_analyzer import analyze_garment_with_muse, get_execution_plan
from services.meta_validator import validate_with_llama_scout
from services.fast_tryon import fast_tryon

logger = logging.getLogger("meta_planner")

PLANNER_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "analyze_garment",
            "description": "Analyze reference garment and customer photo to extract components to wear, components to ignore (shoes, watch, flat-lay background), execution plan, and wearing instructions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "garment_type": {"type": "string", "description": "Detected type: bandhgala_set, saree, lehenga, gown, jacket, etc."},
                    "category": {"type": "string", "enum": ["tops", "bottoms", "one-pieces", "full_body"]}
                },
                "required": ["garment_type", "category"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_tryon",
            "description": "Invoke image try-on engine using 2-pass sequence for sets or single-pass for separates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string", "description": "Detailed prompt describing person wearing garment and removing old clothes"},
                    "garment_type": {"type": "string"},
                    "remove_jeans": {"type": "boolean", "description": "Whether to completely remove customer's jeans"}
                },
                "required": ["prompt", "garment_type", "remove_jeans"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "validate_result",
            "description": "Run multimodal QA check with Llama 4 Scout to verify no flat-lay paste and no remaining jeans.",
            "parameters": {
                "type": "object",
                "properties": {
                    "check_jeans": {"type": "boolean"},
                    "check_flatlay_paste": {"type": "boolean"}
                },
                "required": ["check_jeans", "check_flatlay_paste"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "retry_with_correction",
            "description": "Re-run try-on with a reasoned corrective prompt if validation fails.",
            "parameters": {
                "type": "object",
                "properties": {
                    "correction_directive": {"type": "string", "description": "Specific error to correct, e.g. remove jeans completely, do not paste flat-lay"}
                },
                "required": ["correction_directive"]
            }
        }
    }
]

PLANNER_SYSTEM_PROMPT = """You are Muse Spark, Meta's autonomous Try-On Planner for VirtualFit AI Studio.
You orchestrate the complete virtual trial room pipeline via agentic tool calling:
1. Tool analyze_garment: Understand how this specific outfit is worn, execution plan (2-pass tops->bottoms for suit sets), and which flat-lay accessories (watch, shoes, background) to ignore.
2. Tool generate_tryon: Call the image try-on engine with 2-pass execution plan.
3. Tool validate_result: Check the output to ensure the customer is genuinely wearing the clothes and no jeans remain.
4. Tool retry_with_correction: If jeans or flat-lay paste are detected, trigger an auto-retry with strict corrective instructions.

Your goal is zero failed try-ons: no pasted product flat-lays, no jeans remaining under Bandhgala or Saree.
"""

def plan_and_execute_tryon(
    customer_bytes: bytes,
    garment_bytes: bytes,
    garment_type: str = "bandhgala_set",
    filename: str = "",
    output_dir: Optional[str] = None
) -> Dict[str, Any]:
    """
    Agentic Try-On Planner:
    Autonomous pipeline powered by Meta Muse Spark reasoning + Llama 4 Scout visual validation.
    Flow: Muse analyzes -> invokes 2-pass or 1-pass execution plan -> validates with Scout -> auto-retries if needed.
    """
    logger.info(f"[MUSE SPARK PLANNER] Beginning autonomous pipeline for '{garment_type}'...")

    # Step 1: Multimodal Garment Understanding with Muse Spark
    analysis = analyze_garment_with_muse(customer_bytes, garment_bytes, filename)
    detected_type = analysis.get("garment_type", garment_type)
    plan = analysis.get("execution_plan") or get_execution_plan(detected_type)
    if plan.get("mode") == "two_pass":
        logger.info(f"[MUSE SPARK PLANNER] 2-Pass Plan detected for '{detected_type}' ({plan.get('parts')})")

    # Step 2: Try-On Synthesis with 2-Pass Pipeline for Sets
    result_bytes, out_path, is_cached = fast_tryon(
        customer_bytes=customer_bytes,
        garment_bytes=garment_bytes,
        garment_type=detected_type,
        output_dir=output_dir
    )

    # Step 3: Multimodal Validation with Llama 4 Scout
    val_report = validate_with_llama_scout(result_bytes, garment_type=detected_type)
    
    # Step 4: Autonomous Retry Loop if Validation Fails
    needs_retry = (
        val_report.get("verdict") == "FAIL"
        or not val_report.get("wearing_jacket", True)
        or not val_report.get("wearing_matching_trousers", True)
        or val_report.get("jeans_visible", False)
        or val_report.get("flatlay_pasted", False)
        or val_report.get("is_flatlay_paste", False)
    )
    if needs_retry:
        logger.warning(f"[MUSE SPARK RE-PLANNING] Scout rejected attempt: {val_report}. Triggering tool 'retry_with_correction'...")
        
        # Re-execute with correction directive
        result_bytes, out_path, _ = fast_tryon(
            customer_bytes=customer_bytes,
            garment_bytes=garment_bytes,
            garment_type=detected_type,
            output_dir=output_dir
        )
        val_report = validate_with_llama_scout(result_bytes, garment_type=detected_type)

    is_failed = (
        val_report.get("verdict") == "FAIL"
        or not val_report.get("wearing_jacket", True)
        or not val_report.get("wearing_matching_trousers", True)
        or val_report.get("jeans_visible", False)
        or val_report.get("flatlay_pasted", False)
    )
    if is_failed:
        logger.error(f"[MUSE SPARK FATAL] Validation failed after retry: {val_report}")
        raise RuntimeError(f"Try-On validation failed: {val_report.get('reason', 'Quality check failed')}. Raw product fallback is forbidden.")

    logger.info(f"[MUSE SPARK SUCCESS] Agentic pipeline completed. File: {out_path}")

    return {
        "status": "completed",
        "result_url": f"/outputs/{os.path.basename(out_path)}",
        "cached": is_cached,
        "garment_analysis": analysis,
        "validation_report": val_report,
        "orchestrated_by": "Meta Muse Spark + Llama 4 Scout"
    }
