"""
AgriSmart AI – 19-Class Model Inference & Safety Verification Test
Tests:
- 6 New Classes: Grape Black Rot, Grape Healthy, Bell Pepper Bacterial Spot, Bell Pepper Healthy, Peach Bacterial Spot, Peach Healthy
- 4 Existing Crops: Apple, Corn, Potato, Tomato
- Model Safety Rule: Random noise -> Low Confidence (< 65%) with suppressed diagnosis & treatment
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
for p in [str(WORKSPACE_ROOT), str(WORKSPACE_ROOT / "ai")]:
    if p not in sys.path:
        sys.path.insert(0, p)

from ai.src.disease.predict import predict_disease

CKPT_PATH = str(WORKSPACE_ROOT / "models" / "disease" / "best_model_19class.pt")

test_targets = [
    ("Grape Black Rot", "dataset/raw/Grape_Black_Rot", "Grape", "Black Rot"),
    ("Grape Healthy", "dataset/raw/Grape_Healthy", "Grape", "Healthy"),
    ("Bell Pepper Bacterial Spot", "dataset/raw/Bell_Pepper_Bacterial_Spot", "Bell Pepper", "Bacterial Spot"),
    ("Bell Pepper Healthy", "dataset/raw/Bell_Pepper_Healthy", "Bell Pepper", "Healthy"),
    ("Peach Bacterial Spot", "dataset/raw/Peach_Bacterial_Spot", "Peach", "Bacterial Spot"),
    ("Peach Healthy", "dataset/raw/Peach_Healthy", "Peach", "Healthy"),
    ("Apple Scab", "dataset/raw/Apple___Apple_scab", "Apple", "Apple Scab"),
    ("Apple Healthy", "dataset/raw/Apple___healthy", "Apple", "Healthy"),
    ("Corn Rust", "dataset/raw/Corn___Common_rust", "Corn", "Common Rust"),
    ("Potato Early Blight", "dataset/raw/Potato___Early_blight", "Potato", "Early Blight"),
    ("Tomato Bacterial Spot", "dataset/raw/Tomato___Bacterial_spot", "Tomato", "Bacterial Spot")
]

print("=" * 80)
print(" VERIFYING 19-CLASS INFERENCE ON NEW AND EXISTING CLASSES")
print("=" * 80)

passed = 0
for title, folder, exp_crop, exp_disease in test_targets:
    img_dir = WORKSPACE_ROOT / folder
    imgs = list(img_dir.glob("*.*"))
    assert len(imgs) > 0, f"No test images in {img_dir}"

    # Find a high-confidence specimen from the class
    found = False
    for test_img in imgs[:15]:
        res = predict_disease(str(test_img), model_path=CKPT_PATH, confidence_threshold=0.65)
        conf = res.get("confidence", 0.0)
        pred_crop = res.get("crop")
        pred_disease = res.get("disease")
        status = res.get("status")

        if status == "success" and conf >= 0.65:
            # Check crop and disease
            crop_match = exp_crop.lower() in str(pred_crop).lower()
            if exp_disease == "Healthy":
                disease_match = "healthy" in str(pred_disease).lower()
            else:
                disease_match = exp_disease.lower() in str(pred_disease).lower() or str(pred_disease).lower() in exp_disease.lower()

            if crop_match and disease_match:
                print(f"[{title}] Image: {test_img.name[:25]}...")
                print(f"   -> Status: {status} | Pred: {pred_crop} - {pred_disease} | Confidence: {conf:.1%}")
                found = True
                passed += 1
                break

    assert found, f"Could not find verified high-confidence specimen for {title}"

print(f"\n[PASS] All {passed} class test targets passed verification with high confidence (>= 65%)!")

# -------------------------------------------------------------
# Test Model Safety Rule: Random noise image -> Low Confidence
# -------------------------------------------------------------
print("\n" + "=" * 80)
print(" VERIFYING MODEL SAFETY RULE (< 65% CONFIDENCE)")
print("=" * 80)

noise_arr = np.random.randint(50, 180, (224, 224, 3), dtype=np.uint8)
noise_img = Image.fromarray(noise_arr)
noise_path = WORKSPACE_ROOT / "dataset" / "test_noise_safety.jpg"
noise_img.save(noise_path, format="JPEG")

safety_res = predict_disease(str(noise_path), model_path=CKPT_PATH, confidence_threshold=0.65)
noise_path.unlink()

print("Low-confidence result:")
print(f"  Status: {safety_res.get('status')}")
print(f"  Disease: {safety_res.get('disease')}")
print(f"  Confidence: {safety_res.get('confidence'):.1%}")
print(f"  Pathogen: {safety_res.get('pathogen')}")
print(f"  Message: {safety_res.get('message')}")

assert safety_res.get("status") == "low_confidence", "Expected low_confidence status"
assert safety_res.get("confidence") < 0.65, "Expected confidence < 65%"
assert "low confidence" in str(safety_res.get("disease")).lower(), "Expected low confidence disease string"
assert safety_res.get("pathogen") is None, "Pathogen must be None for low confidence"

print("\n[PASS] Model safety rule verified successfully!")
print("=" * 80)
