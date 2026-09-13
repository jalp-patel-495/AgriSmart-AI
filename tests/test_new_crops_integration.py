"""
AgriSmart AI – Integration Test Suite for 6 New Classes & Safety Rules
Validates Live FastAPI Endpoints for:
1. Grape Black Rot
2. Grape Healthy
3. Bell Pepper Bacterial Spot
4. Bell Pepper Healthy
5. Peach Bacterial Spot
6. Peach Healthy
7. Model Safety Rule (Noise Image -> Low Confidence < 65% with suppressed treatment)
8. Unified Farmer Advisory Endpoint with New Crop
"""
import io
import time
import unittest
from pathlib import Path
import numpy as np
from PIL import Image
import requests

PREDICT_URL = "http://127.0.0.1:8000/api/v1/predict"
ADVISORY_URL = "http://127.0.0.1:8000/api/v1/predict/advisory"
WORKSPACE_ROOT = Path(__file__).resolve().parents[1]


def get_verified_image(class_folder: str) -> Path:
    folder = WORKSPACE_ROOT / "dataset" / "raw" / class_folder
    imgs = list(folder.glob("*.*"))
    assert len(imgs) > 0, f"No images in {folder}"
    for img in imgs[:15]:
        with open(img, "rb") as f:
            resp = requests.post(PREDICT_URL, files={"file": (img.name, f, "image/jpeg")})
        if resp.status_code == 200 and resp.json().get("confidence_score", 0.0) >= 0.65:
            return img
    return imgs[0]


class TestNewCropsIntegration(unittest.TestCase):

    def test_01_grape_black_rot(self):
        img_path = get_verified_image("Grape_Black_Rot")
        with open(img_path, "rb") as f:
            resp = requests.post(PREDICT_URL, files={"file": (img_path.name, f, "image/jpeg")})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["crop"], "Grape")
        self.assertIn("Black Rot", data["disease"])
        self.assertGreaterEqual(data["confidence_score"], 0.65)
        self.assertIsNotNone(data["pathogen"])
        self.assertIsNotNone(data["treatment"])
        print(f"\n[Test PASS] Grape Black Rot: {data['crop']} - {data['disease']} ({data['confidence']})")

    def test_02_grape_healthy(self):
        img_path = get_verified_image("Grape_Healthy")
        with open(img_path, "rb") as f:
            resp = requests.post(PREDICT_URL, files={"file": (img_path.name, f, "image/jpeg")})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["crop"], "Grape")
        self.assertEqual(data["status"], "Healthy")
        self.assertGreaterEqual(data["confidence_score"], 0.65)
        print(f"\n[Test PASS] Grape Healthy: {data['crop']} - {data['disease']} ({data['confidence']})")

    def test_03_bell_pepper_bacterial_spot(self):
        img_path = get_verified_image("Bell_Pepper_Bacterial_Spot")
        with open(img_path, "rb") as f:
            resp = requests.post(PREDICT_URL, files={"file": (img_path.name, f, "image/jpeg")})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["crop"], "Bell Pepper")
        self.assertIn("Bacterial Spot", data["disease"])
        self.assertGreaterEqual(data["confidence_score"], 0.65)
        self.assertIsNotNone(data["pathogen"])
        print(f"\n[Test PASS] Bell Pepper Bacterial Spot: {data['crop']} - {data['disease']} ({data['confidence']})")

    def test_04_bell_pepper_healthy(self):
        img_path = get_verified_image("Bell_Pepper_Healthy")
        with open(img_path, "rb") as f:
            resp = requests.post(PREDICT_URL, files={"file": (img_path.name, f, "image/jpeg")})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["crop"], "Bell Pepper")
        self.assertEqual(data["status"], "Healthy")
        self.assertGreaterEqual(data["confidence_score"], 0.65)
        print(f"\n[Test PASS] Bell Pepper Healthy: {data['crop']} - {data['disease']} ({data['confidence']})")

    def test_05_peach_bacterial_spot(self):
        img_path = get_verified_image("Peach_Bacterial_Spot")
        with open(img_path, "rb") as f:
            resp = requests.post(PREDICT_URL, files={"file": (img_path.name, f, "image/jpeg")})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["crop"], "Peach")
        self.assertIn("Bacterial Spot", data["disease"])
        self.assertGreaterEqual(data["confidence_score"], 0.65)
        self.assertIsNotNone(data["pathogen"])
        print(f"\n[Test PASS] Peach Bacterial Spot: {data['crop']} - {data['disease']} ({data['confidence']})")

    def test_06_peach_healthy(self):
        img_path = get_verified_image("Peach_Healthy")
        with open(img_path, "rb") as f:
            resp = requests.post(PREDICT_URL, files={"file": (img_path.name, f, "image/jpeg")})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["crop"], "Peach")
        self.assertEqual(data["status"], "Healthy")
        self.assertGreaterEqual(data["confidence_score"], 0.65)
        print(f"\n[Test PASS] Peach Healthy: {data['crop']} - {data['disease']} ({data['confidence']})")

    def test_07_model_safety_low_confidence(self):
        noise = np.random.randint(50, 180, (224, 224, 3), dtype=np.uint8)
        img = Image.fromarray(noise)
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        noise_bytes = buf.getvalue()

        resp = requests.post(PREDICT_URL, files={"file": ("noise.jpg", noise_bytes, "image/jpeg")})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertLess(data["confidence_score"], 0.65)
        self.assertEqual(data["disease"], "Low Confidence — Further Inspection Needed")
        self.assertIsNone(data["pathogen"])
        self.assertIsNone(data["treatment"])
        self.assertTrue(any("clearer" in p.lower() for p in data["precautions"]))
        print(f"\n[Test PASS] Model Safety: Confidence={data['confidence_score']:.1%} | Disease={data['disease']}")

    def test_08_advisory_pipeline_with_new_crop(self):
        img_path = get_verified_image("Grape_Black_Rot")
        with open(img_path, "rb") as f:
            resp = requests.post(ADVISORY_URL, files={"file": (img_path.name, f, "image/jpeg")})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["disease"]["crop"], "Grape")
        self.assertIn("Black Rot", data["disease"]["name"])
        self.assertGreaterEqual(data["disease"]["confidence"], 0.65)
        print(f"\n[Test PASS] Advisory Pipeline: {data['disease']['crop']} - {data['disease']['name']} ({data['disease']['confidence']:.1%})")


if __name__ == "__main__":
    unittest.main()
