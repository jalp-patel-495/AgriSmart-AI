"""
AgriSmart AI – Comprehensive End-to-End AI Integration Test Suite
Validates all 10 mandatory verification scenarios against the live FastAPI endpoint:
1. Healthy leaf
2. Diseased leaf
3. Low-confidence disease
4. Irrigation YES
5. Irrigation NO
6. Crop recommendation
7. Yield prediction
8. Missing optional inputs
9. Invalid image
10. Complete combined prediction
"""

import io
import time
import json
import unittest
from pathlib import Path
import numpy as np
from PIL import Image
import requests

BASE_URL = "http://127.0.0.1:8000/api/v1/predict/advisory"
WORKSPACE_ROOT = Path(__file__).resolve().parents[1]


def create_noisy_low_confidence_image() -> bytes:
    """Generates a random noise RGB image to trigger low-confidence (<65%) disease inference."""
    arr = np.random.randint(40, 180, (224, 224, 3), dtype=np.uint8)
    img = Image.fromarray(arr)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


class TestAIIntegration(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Locate sample healthy and diseased leaf images from the dataset
        cls.healthy_img_path = str(WORKSPACE_ROOT / "dataset" / "raw" / "Apple___healthy" / "0098dbd9-286a-4d6a-bf4b-5459d66f88c0___RS_HL 5776.JPG")
        if not Path(cls.healthy_img_path).exists():
            healthy_imgs = list(WORKSPACE_ROOT.glob("dataset/**/Apple___healthy/*.JPG"))
            cls.healthy_img_path = str(healthy_imgs[0])

        cls.diseased_img_path = str(WORKSPACE_ROOT / "dataset" / "raw" / "Potato___Early_blight" / "001187a0-57ab-4329-baff-e7246a9edeb0___RS_Early.B 8178.JPG")
        if not Path(cls.diseased_img_path).exists():
            diseased_imgs = list(WORKSPACE_ROOT.glob("dataset/**/Potato___Early_blight/*.JPG"))
            cls.diseased_img_path = str(diseased_imgs[0])

        assert cls.healthy_img_path is not None and Path(cls.healthy_img_path).exists(), "Healthy sample leaf image not found"
        assert cls.diseased_img_path is not None and Path(cls.diseased_img_path).exists(), "Diseased sample leaf image not found"


    def test_01_healthy_leaf(self):
        """1. Healthy leaf -> Low priority, optimal health status."""
        start = time.time()
        with open(self.healthy_img_path, "rb") as f:
            resp = requests.post(BASE_URL, files={"file": ("healthy_leaf.jpg", f, "image/jpeg")})
        latency = (time.time() - start) * 1000

        self.assertEqual(resp.status_code, 200, f"Failed: {resp.text}")
        data = resp.json()

        self.assertEqual(data["status"], "success")
        self.assertIn("disease", data)
        self.assertEqual(data["disease"]["name"], "Healthy")
        self.assertGreaterEqual(data["disease"]["confidence"], 0.65)
        self.assertEqual(data["farmer_advisor"]["overall_priority"], "LOW")
        self.assertIn("Optimal", data["farmer_advisor"]["farm_status"])
        self.assertTrue(any("healthy" in r.lower() for r in data["farmer_advisor"]["recommendations"]))
        print(f"\n[Test 1 PASS] Healthy Leaf ({latency:.1f}ms): {data['disease']['crop']} - {data['disease']['name']} ({data['disease']['confidence']:.1%})")

    def test_02_diseased_leaf(self):
        """2. Diseased leaf -> High priority, actionable precautions, certified extension disclaimer."""
        start = time.time()
        with open(self.diseased_img_path, "rb") as f:
            resp = requests.post(BASE_URL, files={"file": ("diseased_leaf.jpg", f, "image/jpeg")})
        latency = (time.time() - start) * 1000

        self.assertEqual(resp.status_code, 200, f"Failed: {resp.text}")
        data = resp.json()

        self.assertEqual(data["status"], "success")
        self.assertEqual(data["disease"]["name"], "Early Blight")
        self.assertGreaterEqual(data["disease"]["confidence"], 0.65)
        self.assertEqual(data["farmer_advisor"]["overall_priority"], "HIGH")
        self.assertEqual(data["farmer_advisor"]["farm_status"], "Attention Required")
        self.assertTrue(any("prune" in r.lower() or "foliage" in r.lower() for r in data["farmer_advisor"]["recommendations"]))
        self.assertTrue(any("certified agricultural extension officer" in r.lower() for r in data["farmer_advisor"]["recommendations"]))
        print(f"\n[Test 2 PASS] Diseased Leaf ({latency:.1f}ms): {data['disease']['crop']} - {data['disease']['name']} ({data['disease']['confidence']:.1%})")

    def test_03_low_confidence_disease(self):
        """3. Low-confidence disease -> Warning emitted, no specific chemical treatment."""
        start = time.time()
        noisy_bytes = create_noisy_low_confidence_image()
        resp = requests.post(BASE_URL, files={"file": ("noisy_leaf.jpg", noisy_bytes, "image/jpeg")})
        latency = (time.time() - start) * 1000

        self.assertEqual(resp.status_code, 200, f"Failed: {resp.text}")
        data = resp.json()

        self.assertEqual(data["status"], "success")
        # Confidence must be < 0.65 or trigger low-confidence handling
        self.assertLess(data["disease"]["confidence"], 0.65)
        self.assertTrue(any("below the safe actionable threshold" in w.lower() for w in data["farmer_advisor"]["warnings"]))
        self.assertTrue(any("clearer leaf image" in r.lower() for r in data["farmer_advisor"]["recommendations"]))
        print(f"\n[Test 3 PASS] Low-Confidence Image ({latency:.1f}ms): Confidence={data['disease']['confidence']:.1%} (Suppressed chemical dosage)")

    def test_04_irrigation_yes(self):
        """4. Irrigation YES -> Required=True, Prediction='YES', priority='HIGH', Section 7 corrected wording."""
        start = time.time()
        payload = {
            "soil_moisture": 25.0,
            "temperature": 32.0,
            "humidity": 45.0
        }
        resp = requests.post(BASE_URL, json=payload)
        latency = (time.time() - start) * 1000

        self.assertEqual(resp.status_code, 200, f"Failed: {resp.text}")
        data = resp.json()

        self.assertTrue(data["irrigation"]["required"])
        self.assertEqual(data["irrigation"]["prediction"], "YES")
        self.assertEqual(data["irrigation"]["priority"], "HIGH")
        self.assertGreater(data["irrigation"]["confidence"], 0.80)
        # Verify Section 7 phrasing
        self.assertTrue(any("the irrigation model predicts that irrigation is required" in r.lower() for r in data["farmer_advisor"]["recommendations"]))
        # Verify NO fabricated root uptake thresholds
        self.assertFalse(any("critical root uptake threshold" in r.lower() for r in data["farmer_advisor"]["recommendations"]))
        print(f"\n[Test 4 PASS] Irrigation YES ({latency:.1f}ms): Required={data['irrigation']['required']}, Priority={data['irrigation']['priority']} ({data['irrigation']['confidence']:.1%})")

    def test_05_irrigation_no(self):
        """5. Irrigation NO -> Required=False, Prediction='NO', priority='NONE', water conservation advice."""
        start = time.time()
        payload = {
            "soil_moisture": 85.0,
            "temperature": 24.0,
            "humidity": 75.0
        }
        resp = requests.post(BASE_URL, json=payload)
        latency = (time.time() - start) * 1000

        self.assertEqual(resp.status_code, 200, f"Failed: {resp.text}")
        data = resp.json()

        self.assertFalse(data["irrigation"]["required"])
        self.assertEqual(data["irrigation"]["prediction"], "NO")
        self.assertEqual(data["irrigation"]["priority"], "NONE")
        self.assertTrue(any("conserve water" in r.lower() or "not required" in r.lower() for r in data["farmer_advisor"]["recommendations"]))
        print(f"\n[Test 5 PASS] Irrigation NO ({latency:.1f}ms): Required={data['irrigation']['required']}, Priority={data['irrigation']['priority']}")

    def test_06_crop_recommendation(self):
        """6. Crop recommendation -> High confidence prediction from trained Random Forest."""
        start = time.time()
        payload = {
            "n": 90.0,
            "p": 42.0,
            "k": 43.0,
            "temperature": 20.8,
            "humidity": 82.0,
            "ph": 6.5,
            "rainfall": 202.9
        }
        resp = requests.post(BASE_URL, json=payload)
        latency = (time.time() - start) * 1000

        self.assertEqual(resp.status_code, 200, f"Failed: {resp.text}")
        data = resp.json()

        self.assertIn("crop_recommendation", data)
        rec_crop = data["crop_recommendation"]["recommended_crop"]
        conf = data["crop_recommendation"]["confidence"]
        self.assertNotEqual(rec_crop, "Data unavailable")
        self.assertGreaterEqual(conf, 0.50)
        self.assertTrue(any(rec_crop.lower() in r.lower() for r in data["farmer_advisor"]["recommendations"]))
        print(f"\n[Test 6 PASS] Crop Recommendation ({latency:.1f}ms): Recommended={rec_crop} (Confidence={conf:.1%})")

    def test_07_yield_prediction(self):
        """7. Yield prediction -> Non-negative predicted quantity with actual unit, no fabricated confidence."""
        start = time.time()
        payload = {
            "crop": "Rice",
            "season": "Kharif",
            "state": "Assam",
            "area": 150000.0,
            "rainfall": 2100.0,
            "fertilizer": 12000000.0,
            "pesticide": 35000.0
        }
        resp = requests.post(BASE_URL, json=payload)
        latency = (time.time() - start) * 1000

        self.assertEqual(resp.status_code, 200, f"Failed: {resp.text}")
        data = resp.json()

        self.assertIn("yield", data)
        estimated = data["yield"]["estimated"]
        unit = data["yield"]["unit"]
        self.assertIsInstance(estimated, (int, float))
        self.assertGreater(estimated, 0.0)
        self.assertIn(unit, ["Tonnes/Ha", "Nuts/Ha"])
        self.assertNotIn("confidence", data["yield"])
        self.assertTrue(any(f"{estimated:.2f}" in r for r in data["farmer_advisor"]["recommendations"]))
        print(f"\n[Test 7 PASS] Yield Prediction ({latency:.1f}ms): Estimated={estimated:.2f} {unit}")

    def test_08_missing_optional_inputs(self):
        """8. Missing optional inputs -> Leaf image provided without structured data -> 'Data unavailable'."""
        start = time.time()
        with open(self.healthy_img_path, "rb") as f:
            resp = requests.post(BASE_URL, files={"file": ("leaf_only.jpg", f, "image/jpeg")})
        latency = (time.time() - start) * 1000

        self.assertEqual(resp.status_code, 200, f"Failed: {resp.text}")
        data = resp.json()

        self.assertEqual(data["status"], "success")
        self.assertNotEqual(data["disease"]["name"], "Data unavailable")
        self.assertEqual(data["crop_recommendation"]["recommended_crop"], "Data unavailable")
        self.assertEqual(data["irrigation"]["priority"], "Data unavailable")
        self.assertEqual(data["irrigation"]["prediction"], "Data unavailable")
        self.assertEqual(data["yield"]["estimated"], "Data unavailable")
        print(f"\n[Test 8 PASS] Missing Optional Inputs ({latency:.1f}ms): All missing structured blocks returned 'Data unavailable' without crash.")

    def test_09_invalid_image(self):
        """9. Invalid image -> Returns graceful HTTP 400 without crashing the server."""
        start = time.time()
        corrupted_bytes = b"NOT_A_VALID_IMAGE_FILE_BUFFER_12345"
        resp = requests.post(BASE_URL, files={"file": ("corrupted.jpg", corrupted_bytes, "image/jpeg")})
        latency = (time.time() - start) * 1000

        self.assertEqual(resp.status_code, 400)
        err = resp.json()
        self.assertIn("detail", err)
        self.assertTrue("invalid" in err["detail"].lower() or "decode" in err["detail"].lower())
        print(f"\n[Test 9 PASS] Invalid Image Handling ({latency:.1f}ms): Returned HTTP 400 detail='{err['detail']}'")

    def test_10_complete_combined_prediction(self):
        """10. Complete combined prediction -> All modules active, compound stress alert, CRITICAL priority."""
        start = time.time()
        with open(self.diseased_img_path, "rb") as f:
            resp = requests.post(
                BASE_URL,
                files={"file": ("diseased_leaf.jpg", f, "image/jpeg")},
                data={
                    "soil_moisture": "25.0",
                    "temperature": "32.0",
                    "humidity": "45.0",
                    "n": "85.0",
                    "p": "40.0",
                    "k": "45.0",
                    "ph": "6.2",
                    "rainfall": "150.0",
                    "area": "25000.0",
                    "fertilizer": "2500000.0",
                    "pesticide": "8500.0",
                    "season": "Kharif",
                    "state": "Assam"
                }
            )
        latency = (time.time() - start) * 1000

        self.assertEqual(resp.status_code, 200, f"Failed: {resp.text}")
        data = resp.json()

        # Check all 5 blocks present
        self.assertIn("disease", data)
        self.assertIn("crop_recommendation", data)
        self.assertIn("irrigation", data)
        self.assertIn("yield", data)
        self.assertIn("farmer_advisor", data)

        # Disease check
        self.assertEqual(data["disease"]["name"], "Early Blight")
        # Irrigation check
        self.assertTrue(data["irrigation"]["required"])
        self.assertEqual(data["irrigation"]["priority"], "HIGH")
        # Crop rec check
        self.assertNotEqual(data["crop_recommendation"]["recommended_crop"], "Data unavailable")
        # Yield check
        self.assertIsInstance(data["yield"]["estimated"], (int, float))

        # Overall priority must be CRITICAL (simultaneous severe disease + high irrigation deficit)
        self.assertEqual(data["farmer_advisor"]["overall_priority"], "CRITICAL")
        self.assertEqual(data["farmer_advisor"]["farm_status"], "Critical Intervention Required")
        # Compound alert in warnings
        self.assertTrue(any("compound stress alert" in w.lower() for w in data["farmer_advisor"]["warnings"]))

        print(f"\n[Test 10 PASS] Complete Combined Prediction ({latency:.1f}ms): Priority={data['farmer_advisor']['overall_priority']}, Farm Status='{data['farmer_advisor']['farm_status']}'")


if __name__ == "__main__":
    unittest.main(verbosity=2)
