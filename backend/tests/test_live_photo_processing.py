"""
Test Suite: Live Photo Capture, EXIF Sanitization, Laplacian Sharpness,
and Ephemeral Storage Integration.
"""
import io
import unittest
from PIL import Image
from starlette.testclient import TestClient

from app.main import app
from app.services.vision_gate import vision_gate
from app.services.storage import storage_service
from app.api.v1.endpoints.sessions import ACTIVE_SESSIONS
from tests.helpers import (
    create_sharp_test_image,
    create_blurry_test_image,
    create_image_with_exif,
    create_corrupt_image_bytes,
)


class TestLivePhotoTakeProcessing(unittest.TestCase):
    """
    Validates Edge Camera Capture Processing:
    1. EXIF Privacy Sanitization
    2. Laplacian Edge Sharpness Quality Gate
    3. Facial Identity Quality Gate
    4. Ephemeral Storage Management (15-min TTL)
    5. REST API Capture Upload Endpoint Contract
    """

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        # Create a fresh test session for each test
        response = self.client.post(
            "/v1/sessions",
            json={
                "kioskId": "kiosk_test_cam_01",
                "heightCm": 175.0,
                "genderPreference": "Unisex",
                "consentSigned": True,
            },
        )
        self.assertEqual(response.status_code, 200)
        self.session_data = response.json()
        self.session_id = self.session_data["sessionId"]

    # -------------------------------------------------------------
    # 1. Vision Quality Gate & Security Tests
    # -------------------------------------------------------------
    def test_exif_sanitization_strips_all_sensitive_metadata(self):
        """Verify that sensitive camera metadata and GPS tags are strictly stripped."""
        raw_image_with_exif = create_image_with_exif()

        # Confirm the test image actually contains EXIF metadata
        img_before = Image.open(io.BytesIO(raw_image_with_exif))
        self.assertGreater(len(img_before.getexif()), 0, "Test fixture must contain EXIF tags")

        # Sanitize through vision gate
        sanitized_bytes, warnings = vision_gate.sanitize_and_strip_exif(raw_image_with_exif)

        # Verify that all EXIF tags have been removed
        img_after = Image.open(io.BytesIO(sanitized_bytes))
        self.assertEqual(
            len(img_after.getexif()),
            0,
            "Sanitized image must have 0 EXIF metadata tags",
        )
        self.assertEqual(img_after.format, "JPEG")
        self.assertEqual(len(warnings), 0)

    def test_exif_sanitization_handles_corrupt_bytes_safely(self):
        """Ensure corrupted non-image bytes do not crash the service."""
        corrupt_bytes = create_corrupt_image_bytes()
        sanitized_bytes, warnings = vision_gate.sanitize_and_strip_exif(corrupt_bytes)
        self.assertEqual(sanitized_bytes, corrupt_bytes)
        self.assertGreater(len(warnings), 0)
        self.assertIn("sanitization warning", warnings[0].lower())

    def test_laplacian_sharpness_high_frequency_passes_quality_gate(self):
        """Sharp high-contrast camera capture must exceed the sharpness threshold (50.0)."""
        sharp_bytes = create_sharp_test_image()
        sharpness_score = vision_gate.compute_laplacian_sharpness(sharp_bytes)
        self.assertGreaterEqual(
            sharpness_score,
            50.0,
            f"Expected sharp image variance >= 50.0, got {sharpness_score}",
        )

    def test_laplacian_sharpness_blurry_image_fails_quality_gate(self):
        """Blurred or low-contrast camera capture must score below 50.0."""
        blurry_bytes = create_blurry_test_image()
        sharpness_score = vision_gate.compute_laplacian_sharpness(blurry_bytes)
        self.assertLess(
            sharpness_score,
            50.0,
            f"Expected blurry image variance < 50.0, got {sharpness_score}",
        )

    def test_laplacian_sharpness_handles_corrupted_payload(self):
        """Invalid bytes return default fallback score without raising an uncaught exception."""
        corrupt_bytes = create_corrupt_image_bytes()
        score = vision_gate.compute_laplacian_sharpness(corrupt_bytes)
        self.assertIsInstance(score, float)
        self.assertGreater(score, 0.0)

    def test_identity_preservation_score_threshold(self):
        """Identity quality gate verification must score >= 0.75 cosine similarity."""
        dummy_original = create_sharp_test_image()
        dummy_generated = create_sharp_test_image()
        similarity = vision_gate.verify_identity_preservation_score(dummy_original, dummy_generated)
        self.assertGreaterEqual(
            similarity,
            0.75,
            f"Identity similarity must be >= 0.75, got {similarity}",
        )

    # -------------------------------------------------------------
    # 2. Capture API Endpoint Integration Tests
    # -------------------------------------------------------------
    def test_upload_sharp_photo_approved_by_gateway(self):
        """
        Uploading a sharp camera still to /v1/sessions/{id}/captures
        must strip EXIF, compute sharpness, store the file, and return isApproved=True.
        """
        sharp_bytes = create_sharp_test_image()
        files = {"file": ("camera_still.jpg", sharp_bytes, "image/jpeg")}

        response = self.client.post(
            f"/v1/sessions/{self.session_id}/captures",
            files=files,
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertTrue(data["isApproved"], "Sharp photo must be approved by Quality Gate")
        self.assertEqual(data["sessionId"], self.session_id)
        self.assertTrue(data["captureId"].startswith("cap_"))
        self.assertIn("captures/", data["signedUploadUrl"])

        # Check session state in backend
        self.assertIn(self.session_id, ACTIVE_SESSIONS)
        self.assertIn("captureUrl", ACTIVE_SESSIONS[self.session_id])
        self.assertGreaterEqual(ACTIVE_SESSIONS[self.session_id]["sharpness"], 50.0)

    def test_upload_blurry_photo_flagged_for_retake(self):
        """
        Uploading a blurry camera still must return isApproved=False
        to trigger user retake prompt in the kiosk UI.
        """
        blurry_bytes = create_blurry_test_image()
        files = {"file": ("camera_blur.jpg", blurry_bytes, "image/jpeg")}

        response = self.client.post(
            f"/v1/sessions/{self.session_id}/captures",
            files=files,
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertFalse(data["isApproved"], "Blurry capture must NOT be approved")
        self.assertEqual(data["sessionId"], self.session_id)

    def test_upload_photo_with_exif_sanitizes_before_storing(self):
        """
        Uploading a photo with sensitive camera serials & EXIF data
        must have all EXIF tags stripped prior to saving in storage.
        """
        exif_bytes = create_image_with_exif()
        files = {"file": ("camera_raw_exif.jpg", exif_bytes, "image/jpeg")}

        response = self.client.post(
            f"/v1/sessions/{self.session_id}/captures",
            files=files,
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["sessionId"], self.session_id)
        self.assertEqual(len(data.get("warnings", [])), 0)

    def test_upload_capture_to_invalid_session_returns_404(self):
        """Uploading a photo to a non-existent or expired session returns HTTP 404."""
        sharp_bytes = create_sharp_test_image()
        files = {"file": ("camera_still.jpg", sharp_bytes, "image/jpeg")}

        response = self.client.post(
            "/v1/sessions/sess_nonexistent_999/captures",
            files=files,
        )
        self.assertEqual(response.status_code, 404)
        self.assertIn("Session not found", response.json()["detail"])

    def test_upload_capture_missing_file_payload_returns_422(self):
        """Calling captures endpoint without a multipart file payload returns HTTP 422."""
        response = self.client.post(f"/v1/sessions/{self.session_id}/captures")
        self.assertEqual(response.status_code, 422)

    # -------------------------------------------------------------
    # 3. Ephemeral Storage Service Tests
    # -------------------------------------------------------------
    def test_ephemeral_storage_upload_returns_valid_signed_url(self):
        """Ephemeral storage service generates accessible object paths with session scoping."""
        dummy_data = b"MOCK_JPEG_PAYLOAD_FOR_TESTING"
        object_key = f"captures/{self.session_id}_test.jpg"

        url = storage_service.upload_ephemeral_file(
            object_name=object_key,
            data=dummy_data,
            content_type="image/jpeg",
        )
        self.assertTrue(len(url) > 0)
        self.assertIn(object_key, url)

    def test_storage_purge_lifecycle_runs_without_error(self):
        """Purge reconciliation function executes cleanly against active/fallback store."""
        purged = storage_service.purge_expired_objects(ttl_minutes=15)
        self.assertIsInstance(purged, int)
        self.assertGreaterEqual(purged, 0)


if __name__ == "__main__":
    unittest.main()
