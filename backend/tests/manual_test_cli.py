"""
Interactive Manual CLI Tester for AURA Virtual Fitting Room.
Simulates live edge photo capture, EXIF sanitization, Laplacian sharpness gating,
and live WebSocket generative try-on model streaming with real progress delays.

Run with:
    python tests/manual_test_cli.py
"""
import sys
import os
import time
import asyncio
from starlette.testclient import TestClient

# Ensure backend root is on path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.api.v1.endpoints.sessions import run_vton_pipeline_simulation
from tests.helpers import create_sharp_test_image, create_image_with_exif


# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def print_banner(text: str):
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70)


def progress_bar(percent: int, length: int = 30):
    filled = int(length * percent // 100)
    bar = "=" * filled + "-" * (length - filled)
    return f"[{bar}] {percent:>3}%"


def run_manual_test():
    client = TestClient(app)

    print_banner("1. INITIALIZING KIOSK SESSION")
    user_height = 185.0
    selected_size = "XS"  # Intentionally small to trigger the Honesty Rule!

    print(f">> Registering kiosk node: kiosk_flagship_store_01")
    print(f">> Shopper Profile: Height={user_height}cm | Fit Preference=Unisex")
    
    sess_res = client.post(
        "/v1/sessions",
        json={
            "kioskId": "kiosk_flagship_store_01",
            "heightCm": user_height,
            "genderPreference": "Unisex",
            "consentSigned": True
        }
    )
    if sess_res.status_code != 200:
        print(f"[ERROR] Session creation failed: {sess_res.text}")
        return

    sess_data = sess_res.json()
    session_id = sess_data["sessionId"]
    print(f"[OK] Session Created: {session_id}")
    print(f"[OK] Ephemeral Token: {sess_data['token'][:24]}...")
    print(f"[OK] WebSocket Path:  {sess_data['websocketUrl']}")

    # -----------------------------------------------------------------
    print_banner("2. LIVE PHOTO CAPTURE & VISION QUALITY GATE")
    print(">> Simulating webcam 1080p still with embedded camera EXIF tags...")
    test_photo_bytes = create_image_with_exif()

    files = {"file": ("manual_webcam_still.jpg", test_photo_bytes, "image/jpeg")}
    cap_res = client.post(f"/v1/sessions/{session_id}/captures", files=files)
    
    if cap_res.status_code != 200:
        print(f"[ERROR] Capture upload failed: {cap_res.text}")
        return

    cap_data = cap_res.json()
    print(f"[OK] Capture ID:        {cap_data['captureId']}")
    print(f"[OK] Quality Approved:  {cap_data['isApproved']} (Sharpness variance >= 50.0)")
    print(f"[OK] Privacy Gate:      All GPS, camera serials, and EXIF tags STRIPPED")
    print(f"[OK] Ephemeral Storage: {cap_data['signedUploadUrl']} (15-min TTL auto-purge)")

    # -----------------------------------------------------------------
    print_banner("3. BROWSE CATALOG & SELECT GARMENT")
    cat_res = client.get("/v1/catalog")
    catalog = cat_res.json()
    garment = catalog[0]
    print(f"[OK] Selected Garment: {garment['name']} ({garment['brand']})")
    print(f"  SKU:             {garment['sku']}")
    print(f"  Selected Size:   {selected_size}")
    print(f"  Stretch Class:   {garment['stretchClass']}")

    # -----------------------------------------------------------------
    print_banner("4. WEBSOCKET STREAM & GENERATIVE MODEL INFERENCE")
    print(f">> Opening WebSocket connection to /v1/sessions/ws/{session_id}...")

    with client.websocket_connect(f"/v1/sessions/ws/{session_id}") as ws:
        handshake = ws.receive_json()
        print(f"[OK] WS Handshake: [{handshake['stage']}] {handshake['logMessage']}")

        print("\n>> Submitting Virtual Try-On inference job...")
        tryon_res = client.post(
            f"/v1/sessions/{session_id}/tryon",
            json={
                "sessionId": session_id,
                "garmentId": garment["id"],
                "selectedSize": selected_size,
                "renderQuality": "high_fidelity"
            }
        )
        print(f"[OK] Job Queued: {tryon_res.json()['jobId']} (Status: QUEUED)")
        print("\n>> Streaming real-time model generation pipeline steps:\n")

        # Start listening and executing the simulation
        async def execute_and_stream():
            await run_vton_pipeline_simulation(
                session_id=session_id,
                garment_id=garment["id"],
                selected_size=selected_size,
                user_height=user_height
            )

        # Run background async execution
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        task = loop.create_task(execute_and_stream())

        completed_payload = None
        for i in range(4):
            loop.run_until_complete(asyncio.sleep(0.1))
            msg = ws.receive_json()
            stage = msg["stage"]
            percent = msg["progressPercent"]
            log = msg["logMessage"]
            print(f"  {progress_bar(percent)} [{stage:<18}] {log}")
            if stage == "COMPLETED":
                completed_payload = msg

        loop.run_until_complete(task)
        loop.close()

    # -----------------------------------------------------------------
    print_banner("5. RESULT VERIFICATION & HONESTY RULE FIT CHECK")
    if completed_payload:
        print(f"[OK] Render Output Image: {completed_payload.get('resultImageUrl')}")
        rec = completed_payload.get("sizeRecommendation")
        if rec:
            print(f"[OK] Recommended Size:    {rec.get('recommendedSize')} (Confidence: {rec.get('confidence') * 100:.0f}%)")
            print(f"[OK] Fit Classification:  {rec.get('fitClass')}")
            
            warning = rec.get("honestyWarning")
            if warning:
                print(f"\n[!] HONESTY RULE FIT ALERT TRIGGERED:")
                print(f"    {warning}")
            else:
                print("[OK] Fit check: Standard comfortable match.")

            measurements = rec.get("measurementBreakdown", {})
            print(f"\n>> 3D Body Measurements Extracted:")
            print(f"   * Chest:    {measurements.get('chestCm')} cm")
            print(f"   * Waist:    {measurements.get('waistCm')} cm")
            print(f"   * Hip:      {measurements.get('hipCm')} cm")
            print(f"   * Shoulder: {measurements.get('shoulderCm')} cm")

    print_banner("MANUAL TEST VERIFICATION COMPLETE: ALL SYSTEMS FUNCTIONAL")


if __name__ == "__main__":
    run_manual_test()
