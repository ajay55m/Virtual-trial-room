"""
End-to-End Validation Test Suite for:
1. Meta Segment Anything Model (SAM) Clothing Isolation & Agnostic Masking.
2. Open-Source Virtual Try-On Pipeline (IDM-VTON / Inpainting / Identity Fusion).
3. Meta Llama 3.2-Powered Style & Return Reduction Assistant.
"""
import sys
import os
import asyncio
from PIL import Image

# Ensure app path is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.sam_segmenter import sam_segmenter
from app.services.style_assistant import style_assistant
from app.services.tryon_synthesizer import tryon_synthesizer
from app.models.schemas import StyleAdviceRequest, AssistantChatRequest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_sam_segmentation():
    print("\n--- 1. Testing Meta SAM Segmentation & Agnostic Masking ---")
    test_img = Image.new("RGB", (720, 1080), color=(220, 180, 150))
    agnostic_img, agnostic_mask, meta = sam_segmenter.generate_garment_agnostic_mask(test_img, category="Upper")
    
    assert agnostic_img.size == (720, 1080), "Agnostic image dimensions mismatch"
    assert agnostic_mask.size == (720, 1080), "Agnostic mask dimensions mismatch"
    assert meta["mask_coverage_percent"] > 0, "SAM mask should cover garment region"
    assert meta["protected_face_box"][3] > 0, "SAM should protect upper head/face zone"
    print(f"[OK] SAM segmentation verified! Mask coverage: {meta['mask_coverage_percent']}%, Box: {meta['torso_box']}")

def test_tryon_pipeline_with_sam():
    print("\n--- 2. Testing Try-On Pipeline with SAM Integration ---")
    test_img = Image.new("RGB", (600, 800), color=(210, 160, 130))
    import io
    buf = io.BytesIO()
    test_img.save(buf, format="JPEG")
    user_bytes = buf.getvalue()

    result_url = tryon_synthesizer.synthesize(
        session_id="sess_test_pipeline",
        garment_id="garm_vf_tshirt",
        user_photo_bytes=user_bytes,
        selected_size="M"
    )
    assert result_url.startswith("/assets/"), f"Unexpected result URL: {result_url}"
    print(f"[OK] Try-on synthesis succeeded! Result asset: {result_url}")

def test_llama_return_reduction_advisor():
    print("\n--- 3. Testing Llama Style Advisor & Return Risk Engine ---")
    garment = {
        "id": "garm_001",
        "name": "Navy Satin Blazer",
        "category": "Upper",
        "stretchClass": "Low",
        "fabricComposition": "100% Wool & Silk Satin",
        "price": "$420"
    }

    # Case A: Size S selected when M is recommended (should yield higher return risk)
    advice_mismatch = asyncio.run(style_assistant.get_style_advice(
        session_id="sess_test_llama",
        garment=garment,
        selected_size="S",
        user_height=178.0,
        fit_intent="Regular"
    ))
    print(f"Size S Return Risk: {advice_mismatch.returnRiskScore}% ({advice_mismatch.returnRiskLevel} Risk)")
    print(f"Risk Driver: {advice_mismatch.primaryRiskFactor}")
    assert advice_mismatch.returnRiskScore >= 40, "Size mismatch should elevate return risk"

    # Case B: Size M selected (recommended, low return risk)
    advice_match = asyncio.run(style_assistant.get_style_advice(
        session_id="sess_test_llama",
        garment=garment,
        selected_size="M",
        user_height=178.0,
        fit_intent="Regular"
    ))
    print(f"Size M Return Risk: {advice_match.returnRiskScore}% ({advice_match.returnRiskLevel} Risk)")
    assert advice_match.returnRiskScore < advice_mismatch.returnRiskScore, "Matching size should lower return risk"
    assert len(advice_match.matchingItems) > 0, "Outfit matchmaker should provide complementary items"
    print(f"[OK] Return risk engine and outfit matchmaker verified! Matched {len(advice_match.matchingItems)} items.")

def test_assistant_chat():
    print("\n--- 4. Testing Llama Conversational Stylist ---")
    garment = {
        "id": "garm_vf_shirt",
        "name": "Crisp White Button-Down Shirt",
        "category": "Upper",
        "stretchClass": "Low",
        "fabricComposition": "100% Cotton Poplin"
    }
    chat_resp = asyncio.run(style_assistant.chat(
        session_id="sess_test_chat",
        garment=garment,
        selected_size="M",
        user_message="Will this shirt feel tight around the neck and shoulders?"
    ))
    print(f"Llama Stylist Reply: {chat_resp.reply}")
    assert len(chat_resp.reply) > 20, "Reply should be detailed"
    assert len(chat_resp.suggestedQuestions) > 0, "Should suggest follow-up questions"
    print(f"[OK] Llama Stylist Q&A verified! Model source: {chat_resp.modelSource}")

def test_fastapi_assistant_endpoints():
    print("\n--- 5. Testing FastAPI /v1/assistant Endpoints ---")
    
    # Advice endpoint
    res_adv = client.post("/v1/assistant/advice", json={
        "sessionId": "sess_api_test",
        "garmentId": "garm_001",
        "selectedSize": "L",
        "heightCm": 180.0
    })
    assert res_adv.status_code == 200, f"Advice endpoint failed: {res_adv.text}"
    adv_json = res_adv.json()
    assert "returnRiskScore" in adv_json
    print(f"[OK] POST /v1/assistant/advice -> HTTP 200 (Risk: {adv_json['returnRiskScore']}%)")

    # Chat endpoint
    res_chat = client.post("/v1/assistant/chat", json={
        "sessionId": "sess_api_test",
        "garmentId": "garm_001",
        "selectedSize": "L",
        "userMessage": "What shoes should I wear with this blazer?"
    })
    assert res_chat.status_code == 200, f"Chat endpoint failed: {res_chat.text}"
    chat_json = res_chat.json()
    assert "reply" in chat_json
    print(f"[OK] POST /v1/assistant/chat -> HTTP 200 (Reply: {chat_json['reply'][:60]}...)")

if __name__ == "__main__":
    test_sam_segmentation()
    test_tryon_pipeline_with_sam()
    test_llama_return_reduction_advisor()
    test_assistant_chat()
    test_fastapi_assistant_endpoints()
    print("\n========================================================")
    print("ALL TESTS PASSED: Meta SAM + IDM-VTON + Llama Stylist Verified!")
    print("========================================================\n")
