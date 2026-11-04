import os
import sys
import unittest

# Ensure paths
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi.testclient import TestClient
from backend.main import app, analyze_garment_locally, standardize_garment_image
from services.meta_analyzer import get_execution_plan
from services.fast_tryon import split_garment_set, two_pass_tryon
from services.meta_validator import validate_with_llama_scout

class TestTwoPassPipeline(unittest.TestCase):
    def setUp(self):
        self.model_path = os.path.join(ROOT_DIR, "assets", "models", "model-3.jpg")
        self.garment_path = os.path.join(ROOT_DIR, "assets", "clothes", "kurta-01-men.jpg")
        self.assertTrue(os.path.exists(self.model_path), f"Missing model asset: {self.model_path}")
        self.assertTrue(os.path.exists(self.garment_path), f"Missing garment asset: {self.garment_path}")

        with open(self.model_path, "rb") as mf:
            self.model_bytes = mf.read()
        with open(self.garment_path, "rb") as gf:
            self.garment_bytes = gf.read()

        self.client = TestClient(app)

    def test_scope1_execution_planner(self):
        print("\n--- [TEST 1] Testing Scope 1 Execution Planner ---")
        analysis = analyze_garment_locally(self.garment_bytes, "kurta-01-men.jpg")
        print("Analysis output:", analysis)
        self.assertTrue(analysis["is_set"], "Expected is_set to be True for Bandhgala set")
        self.assertEqual(analysis["parts"], ["tops", "bottoms"])
        self.assertEqual(analysis["category"], "tops")
        self.assertEqual(analysis["execution_plan"]["mode"], "two_pass")
        print("[PASS] Scope 1 Execution Planner PASS")

    def test_scope2_garment_splitting(self):
        print("\n--- [TEST 2] Testing Scope 2 Garment Splitting ---")
        out_dir = os.path.join(BACKEND_DIR, "outputs")
        top_bytes, bot_bytes = split_garment_set(self.garment_bytes, "bandhgala_set", out_dir)
        self.assertGreater(len(top_bytes), 1000, "Garment top bytes too small")
        self.assertGreater(len(bot_bytes), 1000, "Garment bottom bytes too small")

        std_result = standardize_garment_image(self.garment_bytes, "test_bandhgala_key", is_set=True, garment_type="bandhgala_set")
        print("Standardize output:", std_result)
        self.assertIsNotNone(std_result["standardized_top_url"])
        self.assertIsNotNone(std_result["standardized_bottom_url"])
        print("[PASS] Scope 2 Garment Splitting PASS")

    def test_scope3_two_pass_tryon_and_validation(self):
        print("\n--- [TEST 3] Testing Scope 3 Two-Pass Try-On & Visual QA ---")
        out_dir = os.path.join(BACKEND_DIR, "outputs")
        res_bytes, out_path, is_cached = two_pass_tryon(
            customer_bytes=self.model_bytes,
            garment_bytes=self.garment_bytes,
            garment_type="bandhgala_set",
            output_dir=out_dir
        )
        self.assertTrue(os.path.exists(out_path), f"Output file does not exist: {out_path}")
        self.assertGreater(len(res_bytes), 5000, "Result bytes too small")

        # Validate with Llama 4 Scout / CV Validator
        report = validate_with_llama_scout(res_bytes, garment_type="bandhgala_set")
        print("Visual QA Report:", report)
        self.assertEqual(report.get("verdict"), "PASS", f"Expected verdict PASS, got: {report}")
        self.assertFalse(report.get("jeans_visible"), "Jeans should not be visible")
        self.assertFalse(report.get("flatlay_pasted"), "Product flat-lay must not be pasted")
        self.assertTrue(report.get("wearing_jacket"), "Person should be wearing the jacket")
        self.assertTrue(report.get("wearing_matching_trousers"), "Person should be wearing trousers")
        print("[PASS] Scope 3 Two-Pass Try-On & Validation PASS")

    def test_end_to_end_api_endpoints(self):
        print("\n--- [TEST 4] Testing End-to-End API Endpoints ---")
        # 1. Scope 1 endpoint
        res_analyze = self.client.post(
            "/api/analyze-garment",
            files={"garment": ("kurta-01-men.jpg", self.garment_bytes, "image/jpeg")}
        )
        self.assertEqual(res_analyze.status_code, 200)
        d_analyze = res_analyze.json()
        self.assertTrue(d_analyze["garment_data"]["is_set"])
        self.assertEqual(d_analyze["garment_data"]["parts"], ["tops", "bottoms"])

        # 2. Scope 2 endpoint
        res_std = self.client.post(
            "/api/standardize-garment",
            files={"garment": ("kurta-01-men.jpg", self.garment_bytes, "image/jpeg")}
        )
        self.assertEqual(res_std.status_code, 200)
        d_std = res_std.json()
        self.assertIn("standardized_top_url", d_std)
        self.assertIn("standardized_bottom_url", d_std)

        # 3. Scope 3 Try-On endpoint
        res_tryon = self.client.post(
            "/tryon",
            files={
                "person": ("model-3.jpg", self.model_bytes, "image/jpeg"),
                "garment": ("kurta-01-men.jpg", self.garment_bytes, "image/jpeg")
            },
            data={
                "garment_type": "bandhgala_set",
                "category": "tops"
            }
        )
        self.assertEqual(res_tryon.status_code, 200)
        d_tryon = res_tryon.json()
        self.assertEqual(d_tryon["status"], "completed")
        self.assertIn("result_url", d_tryon)

        # 4. Invalidate mask cache endpoint
        res_inv = self.client.post(
            "/api/invalidate-mask-cache",
            data={"person_id": "model-3"}
        )
        self.assertEqual(res_inv.status_code, 200)
        print("[PASS] End-to-End API Endpoints PASS")

if __name__ == "__main__":
    unittest.main()
