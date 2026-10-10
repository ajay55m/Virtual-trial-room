"""
Test Suite: Generative Try-On Model Pipeline Integration, Multi-Stage Pipeline Execution,
WebSocket Progress Streaming, Celery GPU Worker Task, and 3D Sizing Engine.
"""
import unittest
import asyncio
from unittest.mock import patch
from starlette.testclient import TestClient

from app.main import app
from app.api.v1.endpoints.sessions import (
    run_vton_pipeline_simulation,
    ACTIVE_SESSIONS,
)
from app.workers.tryon_worker import process_vton_job
from app.services.sizing_engine import sizing_engine


class TestGenerateModelPipeline(unittest.TestCase):
    """
    Validates Generative Model Integration:
    1. Try-On Job submission via REST API (/v1/sessions/{id}/tryon)
    2. Multi-stage generative pipeline execution (Pose -> DensePose -> Diffusion -> Quality Gate)
    3. WebSocket real-time progress broadcasting (/v1/sessions/ws/{id})
    4. Model output verification (resultImageUrl, sizeRecommendation, Honesty Rule)
    5. Celery GPU Worker task execution (process_vton_job)
    6. 3D Anthropometric Sizing Regression & Honesty Warning Engine
    """

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        # Create fresh session for each test
        response = self.client.post(
            "/v1/sessions",
            json={
                "kioskId": "kiosk_vton_test_01",
                "heightCm": 178.0,
                "genderPreference": "Unisex",
                "consentSigned": True,
            },
        )
        self.assertEqual(response.status_code, 200)
        self.session_data = response.json()
        self.session_id = self.session_data["sessionId"]

    # -------------------------------------------------------------
    # 1. Try-On REST Job Submission Contract
    # -------------------------------------------------------------
    def test_submit_tryon_job_success(self):
        """Submit a valid try-on inference job returns 200, QUEUED status, and WebSocket URL."""
        with patch("asyncio.sleep", return_value=None):
            response = self.client.post(
                f"/v1/sessions/{self.session_id}/tryon",
                json={
                    "sessionId": self.session_id,
                    "garmentId": "garm_001",
                    "selectedSize": "M",
                    "renderQuality": "high_fidelity",
                },
            )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["jobId"].startswith("job_"))
        self.assertEqual(data["sessionId"], self.session_id)
        self.assertEqual(data["garmentId"], "garm_001")
        self.assertEqual(data["status"], "QUEUED")
        self.assertIn("/v1/sessions/ws/", data["websocketStream"])

    def test_submit_tryon_job_invalid_session_returns_404(self):
        """Submitting a try-on job for a non-existent session returns HTTP 404."""
        response = self.client.post(
            "/v1/sessions/sess_unknown_session_000/tryon",
            json={
                "sessionId": "sess_unknown_session_000",
                "garmentId": "garm_001",
                "selectedSize": "M",
            },
        )
        self.assertEqual(response.status_code, 404)
        self.assertIn("Session not found", response.json()["detail"])

    def test_submit_tryon_job_missing_fields_returns_422(self):
        """Submitting an incomplete try-on request returns HTTP 422 Unprocessable Entity."""
        response = self.client.post(
            f"/v1/sessions/{self.session_id}/tryon",
            json={"sessionId": self.session_id},
        )
        self.assertEqual(response.status_code, 422)

    # -------------------------------------------------------------
    # 2. WebSocket Stream & Generative Pipeline Stages
    # -------------------------------------------------------------
    def test_websocket_connect_handshake_and_keepalive(self):
        """WebSocket connection establishes cleanly and responds to keep-alive pings."""
        with self.client.websocket_connect(f"/v1/sessions/ws/{self.session_id}") as ws:
            handshake = ws.receive_json()
            self.assertEqual(handshake["stage"], "CONNECTED")
            self.assertEqual(handshake["progressPercent"], 0)
            self.assertIn("handshake established", handshake["logMessage"].lower())

            # Test ping/pong keepalive
            ws.send_text("ping")
            pong = ws.receive_text()
            self.assertEqual(pong, "pong")

    def test_generative_pipeline_executes_all_four_stages_over_websocket(self):
        """
        Executes the multi-stage generative try-on pipeline and verifies that
        the WebSocket client receives all 4 progression stages in strict sequence:
        Stage 1: POSE_EXTRACTION (25%)
        Stage 2: DENSEPOSE_SURFACE (50%)
        Stage 3: DIFFUSION_PASS (75%)
        Stage 4: COMPLETED (100%)
        """
        with self.client.websocket_connect(f"/v1/sessions/ws/{self.session_id}") as ws:
            handshake = ws.receive_json()
            self.assertEqual(handshake["stage"], "CONNECTED")

            # Execute the generative simulation with patched sleep for instantaneous execution
            async def run_pipeline():
                with patch("asyncio.sleep", return_value=None):
                    await run_vton_pipeline_simulation(
                        session_id=self.session_id,
                        garment_id="garm_001",
                        selected_size="M",
                        user_height=178.0,
                    )

            asyncio.run(run_pipeline())

            # Receive the 4 progress stages
            messages = [ws.receive_json() for _ in range(4)]

            # Stage 1: Pose Extraction & Agnostic Garment Masking
            stage1 = messages[0]
            self.assertEqual(stage1["stage"], "POSE_EXTRACTION")
            self.assertEqual(stage1["progressPercent"], 25)
            self.assertIn("mediapipe", stage1["logMessage"].lower())

            # Stage 2: DensePose UV Body Surface
            stage2 = messages[1]
            self.assertEqual(stage2["stage"], "DENSEPOSE_SURFACE")
            self.assertEqual(stage2["progressPercent"], 50)
            self.assertIn("densepose", stage2["logMessage"].lower())

            # Stage 3: PyTorch Diffusion UNet Pass
            stage3 = messages[2]
            self.assertEqual(stage3["stage"], "DIFFUSION_PASS")
            self.assertEqual(stage3["progressPercent"], 75)
            self.assertIn("unet", stage3["logMessage"].lower())

            # Stage 4: Completed with Quality Gate & Sizing
            stage4 = messages[3]
            self.assertEqual(stage4["stage"], "COMPLETED")
            self.assertEqual(stage4["progressPercent"], 100)
            self.assertIn("quality_gate", stage4["logMessage"].lower().replace(" ", "_"), "Final stage must pass quality gate")
            self.assertIsNotNone(stage4["resultImageUrl"], "Generated try-on image URL must be provided")
            self.assertTrue(
                stage4["resultImageUrl"].endswith(".jpg"),
                "Result image must point to a valid render asset",
            )
            self.assertIsNotNone(stage4["sizeRecommendation"], "Size recommendation must be attached")

            recommendation = stage4["sizeRecommendation"]
            self.assertIn(recommendation["recommendedSize"], ["XS", "S", "M", "L", "XL"])
            self.assertIn(recommendation["fitClass"], ["Slim", "Regular", "Relaxed"])
            self.assertIn("measurementBreakdown", recommendation)
            measurements = recommendation["measurementBreakdown"]
            self.assertGreater(measurements["chestCm"], 70.0)
            self.assertGreater(measurements["waistCm"], 50.0)

    # -------------------------------------------------------------
    # 3. Celery GPU Worker Task Integration
    # -------------------------------------------------------------
    def test_celery_gpu_worker_task_execution(self):
        """
        Directly executes the Celery GPU worker task (process_vton_job)
        simulating background task consumption on the worker cluster.
        """
        with patch("time.sleep", return_value=None):
            result = process_vton_job(
                session_id=self.session_id,
                garment_id="garm_002",
                selected_size="M",
                user_height_cm=175.0,
            )

        self.assertEqual(result["status"], "SUCCEEDED")
        self.assertEqual(result["sessionId"], self.session_id)
        self.assertEqual(result["garmentId"], "garm_002")
        self.assertEqual(result["selectedSize"], "M")
        self.assertIn("sizeRecommendation", result)
        self.assertIn("completedAt", result)

    # -------------------------------------------------------------
    # 4. Anthropometric 3D Sizing & Honesty Rule Engine
    # -------------------------------------------------------------
    def test_sizing_regression_standard_fit(self):
        """Standard height and matching size yield Regular fit with no warning."""
        measurements = sizing_engine.estimate_measurements(height_cm=175.0, gender="Unisex")
        rec = sizing_engine.calculate_recommendation(
            measurements=measurements,
            selected_size="M",
            stretch_class="Medium",
        )
        self.assertEqual(rec.recommendedSize, "M")
        self.assertEqual(rec.fitClass, "Regular")
        self.assertIsNone(rec.honestyWarning)

    def test_sizing_regression_honesty_rule_tight_fit_warning(self):
        """Selecting XS for a tall/broad person triggers the Honesty Rule tight fit warning."""
        measurements = sizing_engine.estimate_measurements(height_cm=195.0, gender="Unisex")
        rec = sizing_engine.calculate_recommendation(
            measurements=measurements,
            selected_size="XS",
            stretch_class="Low",
        )
        self.assertEqual(rec.fitClass, "Slim")
        self.assertIsNotNone(rec.honestyWarning)
        self.assertIn("may feel tight", rec.honestyWarning)

    def test_sizing_regression_honesty_rule_oversized_warning(self):
        """Selecting XL for a petite person triggers the Honesty Rule oversized drape warning."""
        measurements = sizing_engine.estimate_measurements(height_cm=152.0, gender="Female")
        rec = sizing_engine.calculate_recommendation(
            measurements=measurements,
            selected_size="XL",
            stretch_class="High",
        )
        self.assertEqual(rec.fitClass, "Relaxed")
        self.assertIsNotNone(rec.honestyWarning)
        self.assertIn("oversized drape", rec.honestyWarning)

    def test_sizing_calculate_rest_endpoint(self):
        """REST endpoint /v1/sizing/calculate computes measurements and recommendation."""
        response = self.client.post(
            "/v1/sizing/calculate",
            json={
                "heightCm": 180.0,
                "selectedSize": "S",
                "genderPreference": "Unisex",
                "stretchClass": "Medium",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("recommendedSize", data)
        self.assertIn("confidence", data)
        self.assertIn("measurementBreakdown", data)


if __name__ == "__main__":
    unittest.main()
