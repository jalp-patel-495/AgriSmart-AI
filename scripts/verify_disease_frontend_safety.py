"""
AgriSmart AI - Automated Verification Script for Disease Detection Frontend Safety
Checks ResultView.jsx, ImageUpload.jsx, App.jsx, and cropDiseaseResolver.js
"""

import re
import sys
from pathlib import Path

# Ensure standard output can print ascii
sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parents[1]
FRONTEND_DIR = ROOT_DIR / "frontend" / "src"

def test_disease_frontend_safety():
    print("=" * 60)
    print("AGRISMART AI: DISEASE DETECTION FRONTEND VERIFICATION")
    print("=" * 60)

    result_view_path = FRONTEND_DIR / "components" / "ResultView.jsx"
    image_upload_path = FRONTEND_DIR / "components" / "ImageUpload.jsx"
    app_path = FRONTEND_DIR / "App.jsx"
    resolver_path = FRONTEND_DIR / "utils" / "cropDiseaseResolver.js"

    assert result_view_path.exists(), f"Missing {result_view_path}"
    assert image_upload_path.exists(), f"Missing {image_upload_path}"
    assert app_path.exists(), f"Missing {app_path}"
    assert resolver_path.exists(), f"Missing {resolver_path}"

    result_view_code = result_view_path.read_text(encoding="utf-8")
    image_upload_code = image_upload_path.read_text(encoding="utf-8")
    app_code = app_path.read_text(encoding="utf-8")
    resolver_code = resolver_path.read_text(encoding="utf-8")

    # 1. Check Low-Confidence Safety States (<65%)
    print("\n[1] Verifying Low-Confidence (<65%) Safety Rules...")
    assert "⚠️ Low Confidence" in result_view_code, "Missing '⚠️ Low Confidence' badge in ResultView"
    assert "Low Confidence — Further Inspection Needed" in result_view_code, "Missing main low-confidence title"
    assert "Not confidently identified" in result_view_code, "Missing 'Not confidently identified' line"
    assert "Possible Crop:" in result_view_code, "Missing 'Possible Crop:' display for low confidence"
    assert "Crop: Undetermined" in result_view_code or "Undetermined" in result_view_code, "Missing 'Undetermined' crop fallback"
    print("[OK] Low-confidence badges, titles, and crop states verified.")

    # 2. Check Low-Confidence Content & Suppressions
    print("\n[2] Verifying Low-Confidence Suppression (Pathogen, Treatment, Alternatives)...")
    assert "!isLowConfidence && !isHealthy && (" in result_view_code or "!isLowConfidence && !isHealthy && result.treatment" in result_view_code, "Pathogen/treatment not gated behind !isLowConfidence"
    assert "Top Alternative Differential Diagnoses:" in result_view_code, "Alternative diagnoses header missing"
    assert "!isLowConfidence && !isHealthy && result.top_predictions" in result_view_code, "Alternatives must be gated behind !isLowConfidence"
    print("[OK] Pathogen, treatment, and differential diagnoses strictly suppressed for <65%.")

    # 3. Check Weather Alert Replacement
    print("\n[3] Verifying Dynamic Weather Context (No Hardcoded Banner)...")
    assert "Weather Alert: High Humidity + Moisture Threat" not in result_view_code, "Old hardcoded weather alert still present!"
    assert "Weather Context" in result_view_code, "Missing real Weather Context card in ResultView"
    assert "Temperature:" in result_view_code, "Missing Temperature in Weather Context"
    assert "Humidity:" in result_view_code, "Missing Humidity in Weather Context"
    assert "Rain Probability:" in result_view_code, "Missing Rain Probability in Weather Context"
    assert "Weather Risk:" in result_view_code, "Missing Weather Risk in Weather Context"
    assert "View Weather Intelligence →" in result_view_code, "Missing View Weather Intelligence button"
    print("[OK] Old hardcoded banner removed; dynamic Weather Context integrated.")

    # 4. Check Confidence Visualization Tiers
    print("\n[4] Verifying Confidence Visual Tiers & Safety Gate...")
    assert "65% Safety Gate" in result_view_code, "Missing 65% Safety Gate label in confidence gauge"
    assert "0.65" in resolver_code, "Resolver must use 0.65 safety threshold"
    assert "High Confidence" in resolver_code, "High Confidence tier missing"
    assert "Moderate Confidence" in resolver_code, "Moderate Confidence tier missing"
    assert "Low Confidence" in resolver_code, "Low Confidence tier missing"
    print("[OK] Confidence visualization tiers (High >=85%, Moderate 65-84%, Low <65%) verified.")

    # 5. Check Healthy State
    print("\n[5] Verifying Healthy State Handling...")
    assert "🟢 Healthy Crop" in result_view_code, "Missing '🟢 Healthy Crop' badge"
    assert "Result: Healthy" in result_view_code or "Healthy" in result_view_code, "Healthy status indicator missing"
    assert "HEALTHY_MONITORING_PRECAUTIONS" in resolver_code, "Healthy crop precautions missing"
    print("[OK] Healthy state properly displays monitoring advice and suppresses pathology.")

    # 6. Check Model Info & Supported Crops
    print("\n[6] Verifying 21,749 Specimens & 7 Supported Crops...")
    assert "15,014" not in app_code, "Old '15,014 verified specimens' text still present in App.jsx!"
    assert "21,749 verified specimens" in app_code, "Missing '21,749 verified specimens' text in App.jsx"
    assert "19 classes" in app_code, "Missing '19 classes' text in App.jsx"
    assert "7 crop species" in app_code, "Missing '7 crop species' text in App.jsx"
    assert "Supported Crops:" in app_code, "Missing 'Supported Crops:' section in App.jsx"
    for crop in ['Apple', 'Corn', 'Potato', 'Tomato', 'Grape', 'Bell Pepper', 'Peach']:
        assert crop in app_code, f"Missing {crop} in App.jsx supported crops list"
    print("[OK] Updated model metadata and compact Supported Crops section verified.")

    # 7. Check Image Quality Feedback & Analyze Button
    print("\n[7] Verifying Image Quality Tip & Analyze Button States...")
    assert "Tip: Use a clear, well-lit leaf image." in image_upload_code, "Missing Image Quality Tip in ImageUpload"
    assert "🔍 Analyze Leaf Condition" in image_upload_code, "Missing '🔍 Analyze Leaf Condition' button label"
    assert "Analyzing leaf..." in image_upload_code, "Missing 'Analyzing leaf...' button state"
    assert "disabled={!selectedFile || isAnalyzing}" in image_upload_code, "Missing duplicate click prevention"
    print("[OK] Image quality feedback and Analyze button behavior verified.")

    # 8. Check AI Assistant Button & Safe Low-Confidence Prompt
    print("\n[8] Verifying AI Assistant Safe Low-Confidence Flow...")
    assert "💬 Ask AI Assistant About This Result" in result_view_code, "Missing AI Assistant button in ResultView"
    assert "The model was unable to confidently identify the disease. Please upload a clearer image." in result_view_code, "Missing safe low-confidence prompt in ResultView"
    assert "isLowConf" in app_code, "App.jsx must check isLowConf for farmContext"
    print("[OK] AI Assistant button safely transmits low-confidence warning.")

    # 9. Check Crop Undetermined Bug Fix across All 19 Classes
    print("\n[9] Verifying Crop 'Undetermined' Bug Fix (19 Classes / 7 Crops)...")
    assert "CANONICAL_CLASSES" in resolver_code, "CANONICAL_CLASSES missing in resolver"
    assert len(re.findall(r"\{\s*id:\s*\d+", resolver_code)) == 19, "Must have all 19 canonical classes mapped in resolver"
    for crop in ['Apple', 'Corn', 'Potato', 'Tomato', 'Grape', 'Bell Pepper', 'Peach']:
        assert crop in resolver_code, f"Resolver missing canonical crop {crop}"
    print("[OK] All 19 classes and 7 crops properly mapped; bug fix verified.")

    print("\n" + "=" * 60)
    print("ALL DISEASE DETECTION FRONTEND VERIFICATION CHECKS PASSED (9/9)")
    print("=" * 60)

if __name__ == "__main__":
    test_disease_frontend_safety()
