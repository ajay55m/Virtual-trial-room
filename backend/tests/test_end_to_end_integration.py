"""
Test Suite: Complete End-to-End User Journey Integration.
Covers Session Initialization -> Live Photo Capture Upload & Vision Quality Gate ->
Garment Catalog Selection -> Try-On Job Queuing -> WebSocket Stage Progression Stream ->
Render Result Verification & Honesty Rule Sizing Delivery -> Fleet Telemetry Check.
"""
import unittest
import asyncio
from unittest.mock import patch
from starlette.testclient import TestClient

from app.main import app
from app.api.v1.endpoints.sessions import run_vton_pipeline_simulation, ACTIVE_SESSIONS
from tests.helpers import create_sharp_test_image


class TestEndToEndKioskIntegration(unittest.TestCase):
    """
    Simulates the full physical kiosk fitting room journey:
    1. Consent & Session Onboarding
    2. Live Camera Capture & Automated Quality Gate
    3. Luxury Catalog Query
    4. Virtual Try-On Execution via WebSocket Stream
    5. Result Validation (Generated Image & Honesty Rule Sizing)
    6. Fleet Telemetry & Audit Health
    """

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_full_kiosk_live_photo_and_generation_workflow(self):
        # ---------------------------------------------------------
        # Step 1: Session Initiation
        # ---------------------------------------------------------
        session_payload = {
            "kioskId": "kiosk_flagship_store_01",
            "heightCm": 182.0,
            "genderPreference": "Unisex",
            "consentSigned": True,
        }
        sess_response = self.client.post("/v1/sessions", json=session_payload)
        self.assertEqual(sess_response.status_code, 200)
        sess_data = sess_response.json()
        session_id = sess_data["sessionId"]
        self.assertTrue(session_id.startswith("sess_"))
        self.assertEqual(sess_data["status"], "ACTIVE")

        # ---------------------------------------------------------
        # Step 2: Live Camera Still Photo Capture & Quality Gate
        # ---------------------------------------------------------
        # Simulate edge camera frame (sharp 1080p still)
        live_camera_bytes = create_sharp_test_image(width=1080, height=1920)
        files = {"file": ("live_kiosk_frame.jpg", live_camera_bytes, "image/jpeg")}

        cap_response = self.client.post(
            f"/v1/sessions/{session_id}/captures",
            files=files,
        )
        self.assertEqual(cap_response.status_code, 200)
        cap_data = cap_response.json()
        self.assertTrue(cap_data["isApproved"], "High-quality camera capture must be approved")
        self.assertEqual(cap_data["sessionId"], session_id)
        self.assertIn("captures/", cap_data["signedUploadUrl"])

        # Confirm session memory holds upload reference & sharpness score
        self.assertIn(session_id, ACTIVE_SESSIONS)
        self.assertIn("captureUrl", ACTIVE_SESSIONS[session_id])
        self.assertGreaterEqual(ACTIVE_SESSIONS[session_id]["sharpness"], 50.0)

        # ---------------------------------------------------------
        # Step 3: Catalog Query
        # ---------------------------------------------------------
        cat_response = self.client.get("/v1/catalog")
        self.assertEqual(cat_response.status_code, 200)
        catalog = cat_response.json()
        self.assertGreater(len(catalog), 0)

        # Select first garment
        selected_garment = catalog[0]
        garment_id = selected_garment["id"]

        # ---------------------------------------------------------
        # Step 4: Open WebSocket Connection for Live Event Stream
        # ---------------------------------------------------------
        with self.client.websocket_connect(f"/v1/sessions/ws/{session_id}") as ws:
            handshake = ws.receive_json()
            self.assertEqual(handshake["stage"], "CONNECTED")

            # -----------------------------------------------------
            # Step 5: Submit Virtual Try-On Job
            # -----------------------------------------------------
            with patch("asyncio.sleep", return_value=None):
                job_response = self.client.post(
                    f"/v1/sessions/{session_id}/tryon",
                    json={
                        "sessionId": session_id,
                        "garmentId": garment_id,
                        "selectedSize": "S",  # Intentionally smaller for 182cm height to test Honesty Rule
                        "renderQuality": "high_fidelity",
                    },
                )
            self.assertEqual(job_response.status_code, 200)
            job_data = job_response.json()
            self.assertEqual(job_data["status"], "QUEUED")

            # -----------------------------------------------------
            # Step 6: Stream Progression through All 4 Pipeline Stages
            # -----------------------------------------------------
            async def run_pipeline():
                with patch("asyncio.sleep", return_value=None):
                    await run_vton_pipeline_simulation(
                        session_id=session_id,
                        garment_id=garment_id,
                        selected_size="S",
                        user_height=182.0,
                    )

            asyncio.run(run_pipeline())

            stage_events = [ws.receive_json() for _ in range(4)]
            stage_names = [e["stage"] for e in stage_events]
            self.assertEqual(
                stage_names,
                ["POSE_EXTRACTION", "DENSEPOSE_SURFACE", "DIFFUSION_PASS", "COMPLETED"],
            )

            # -----------------------------------------------------
            # Step 7: Final Result Verification & Honesty Rule
            # -----------------------------------------------------
            completed_event = stage_events[-1]
            self.assertEqual(completed_event["progressPercent"], 100)
            self.assertIsNotNone(completed_event["resultImageUrl"])
            self.assertTrue(
                completed_event["resultImageUrl"].endswith(f"_tryon_{garment_id}.jpg"),
                "Result image must be the dynamically synthesized try-on on the user's actual photo",
            )

            # Verify Honesty Rule fit warning
            recommendation = completed_event["sizeRecommendation"]
            self.assertIsNotNone(recommendation)
            self.assertEqual(recommendation["recommendedSize"], "M")
            self.assertEqual(recommendation["fitClass"], "Slim")
            self.assertIsNotNone(
                recommendation["honestyWarning"],
                "Honesty Rule warning must alert shopper that selected Size S fits as Slim",
            )
            self.assertIn("Slim", recommendation["honestyWarning"])

        # ---------------------------------------------------------
        # Step 8: Telemetry Health & Diagnostic Verification
        # ---------------------------------------------------------
        telemetry_response = self.client.get("/v1/telemetry/metrics")
        self.assertEqual(telemetry_response.status_code, 200)
        metrics = telemetry_response.json()
        self.assertEqual(metrics["status"], "HEALTHY")
        self.assertIn("gpu", metrics)
        self.assertIn("storage", metrics)


if __name__ == "__main__":
    unittest.main()
