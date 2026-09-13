"""
Comprehensive Verification Script for 95-Class Crop Recommendation Module
Covers:
1. 20 Specific required crops evaluation
2. Validation that returned crops belong to the 95 supported classes
3. Alias handling and resolution
4. Edge cases & invalid inputs handling
5. Top-3 and Literature Profile validation
"""
import os
import sys
import json
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

# Add project root to sys.path
WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(WORKSPACE_ROOT))

from ai.src.crop_recommendation.predict import (
    predict_crop,
    resolve_crop_alias,
    get_crop_model_artifacts,
    get_crop_profile_metadata,
    _load_global_crop_profiles_and_aliases,
)

def run_tests():
    print("=" * 70)
    print("AGRISMART AI – 95-CLASS CROP RECOMMENDATION VERIFICATION")
    print("=" * 70)

    # 1. Verify Dataset & Artifacts
    model, scaler, encoder, class_names, version = get_crop_model_artifacts("95class")
    print(f"[*] Loaded Model Version: {version}")
    print(f"[*] Total Registered Classes: {len(class_names)}")
    assert len(class_names) == 95, f"Expected 95 classes, got {len(class_names)}"

    # 2. Check 20 Specifically Required Crops exist in the 95 class list
    REQUIRED_20_CROPS = [
        "Rice",
        "Wheat",
        "Maize / Corn",
        "Potato",
        "Tomato",
        "Apple",
        "Grape",
        "Peach",
        "Capsicum / Bell Pepper",
        "Cotton",
        "Sugarcane",
        "Groundnut",
        "Soybean",
        "Onion",
        "Mango",
        "Banana",
        "Coconut",
        "Turmeric",
        "Ginger",
        "Chickpea"
    ]

    canonical_classes_set = set(class_names)
    print("\n[TEST 1] Verifying 20 Required Crops Presence in 95 Classes:")
    missing_required = []
    for crop in REQUIRED_20_CROPS:
        if crop in canonical_classes_set:
            print(f"  [OK] Found canonical class: {crop}")
        else:
            resolved = resolve_crop_alias(crop, class_names)
            if resolved in canonical_classes_set:
                print(f"  [OK] Resolved alias '{crop}' -> '{resolved}'")
            else:
                missing_required.append(crop)
                print(f"  [FAIL] Missing required crop: {crop}")

    assert not missing_required, f"Missing crops: {missing_required}"
    print("[PASS] All 20 required crops present in canonical 95 classes.")

    # 3. Test Predictions on Archetype Soil/Climate Inputs
    print("\n[TEST 2] Evaluating Inference & Top-3 on 20 Diverse Agricultural Profiles:")
    test_profiles = [
        # (Name, N, P, K, Temp, Hum, pH, Rain)
        ("Warm Subtropical Rice/Paddy", 120, 80, 50, 32.0, 85.0, 5.8, 1500),
        ("Cool Temperate Wheat Zone", 50, 30, 20, 15.0, 40.0, 7.0, 500),
        ("Kharif Maize Zone", 110, 45, 40, 25.0, 65.0, 6.5, 750),
        ("Cool Winter Potato Soil", 60, 55, 45, 17.0, 55.0, 5.6, 550),
        ("Vegetable Tomato Land", 75, 70, 65, 23.0, 65.0, 6.6, 800),
        ("High-Altitude Apple Orchard", 85, 40, 60, 9.0, 55.0, 6.0, 1100),
        ("Vineyard Semi-Arid Grape", 70, 50, 40, 25.0, 45.0, 7.1, 600),
        ("Stone-Fruit Hill Peach", 80, 45, 50, 16.0, 55.0, 6.4, 850),
        ("Greenhouse Bell Pepper / Capsicum", 80, 50, 50, 22.0, 65.0, 6.5, 750),
        ("Black Cotton Soil Cotton", 95, 45, 55, 26.0, 65.0, 7.0, 800),
        ("Tropical Heavy Sugarcane", 85, 55, 50, 28.0, 80.0, 6.5, 1300),
        ("Light Loamy Groundnut", 75, 45, 60, 27.0, 55.0, 6.5, 600),
        ("Monsoon Legume Soybean", 80, 45, 50, 26.0, 65.0, 6.8, 800),
        ("Alluvial Loam Onion", 70, 40, 55, 20.0, 45.0, 6.6, 700),
        ("Tropical Orchard Mango", 80, 45, 55, 27.0, 65.0, 6.5, 1800),
        ("High-Humidity Banana Belt", 85, 45, 50, 28.0, 85.0, 6.8, 1800),
        ("Coastal Humid Coconut Sands", 75, 45, 55, 28.0, 80.0, 6.4, 2100),
        ("Warm Humid Turmeric", 85, 50, 55, 26.0, 80.0, 5.8, 1900),
        ("Monsoon Forest Ginger", 80, 50, 55, 24.0, 80.0, 6.2, 2200),
        ("Rabi Dryland Chickpea", 75, 50, 50, 18.0, 35.0, 6.8, 380),
    ]

    for name, n, p, k, temp, hum, ph, rain in test_profiles:
        res = predict_crop({
            "N": n, "P": p, "K": k,
            "temperature": temp, "humidity": hum,
            "ph": ph, "rainfall": rain
        })
        assert res["status"] == "success", f"Failed for {name}: {res}"
        rec = res["recommended_crop"]
        assert rec in canonical_classes_set, f"Predicted crop '{rec}' not in 95 canonical classes!"
        assert len(res["top_3"]) == 3, f"Expected top_3 to have 3 items, got {len(res['top_3'])}"
        assert res["confidence"] > 0, "Confidence score must be greater than 0"
        profile = res["crop_profile"]
        assert "scientific_name" in profile, "Missing scientific_name in crop_profile"
        assert "growing_season" in profile, "Missing growing_season in crop_profile"
        print(f"  [OK] {name:<35} -> Top 1: {rec} ({res['confidence']*100:.1f}%) | Top 2: {res['top_3'][1]['crop']} | Top 3: {res['top_3'][2]['crop']}")

    print("[PASS] All 20 test profiles produced valid 95-class predictions with verified Top-3.")

    # 4. Test Alias Handling
    print("\n[TEST 3] Verifying Crop Alias Resolution (English, Regional, Hindi/Gujarati):")
    aliases_to_test = [
        ("Corn", "Maize / Corn"),
        ("Bell Pepper", "Capsicum / Bell Pepper"),
        ("Eggplant", "Brinjal / Eggplant"),
        ("Rapeseed", "Mustard / Rapeseed"),
        ("Paddy", "Rice"),
        ("Makka", "Maize / Corn"),
        ("Aloo", "Potato"),
        ("Kapas", "Cotton"),
        ("Ganna", "Sugarcane"),
        ("Moongphali", "Groundnut"),
        ("Chana", "Chickpea"),
        ("Haldi", "Turmeric"),
        ("Adrak", "Ginger"),
        ("Nariyal", "Coconut"),
    ]

    for alias, expected in aliases_to_test:
        resolved = resolve_crop_alias(alias, class_names)
        print(f"  Alias '{alias}' resolved to: '{resolved}' (Expected: '{expected}')")
        assert resolved in canonical_classes_set, f"Resolved alias '{resolved}' not in canonical classes!"

    print("[PASS] Alias resolution successfully mapped variations to canonical classes.")

    # 5. Test Invalid & Missing Inputs Handling
    print("\n[TEST 4] Testing Invalid, Out-of-Range, and Missing Input Handling:")
    # Missing fields
    res_missing = predict_crop({"N": 50, "P": 40})
    assert res_missing["status"] == "error", "Expected error for missing fields"
    print(f"  [OK] Missing fields rejected: {res_missing['message']}")

    # Non-numeric fields
    res_non_num = predict_crop({"N": "invalid", "P": 40, "K": 20, "temperature": 25, "humidity": 60, "ph": 6.5, "rainfall": 100})
    assert res_non_num["status"] == "error", "Expected error for non-numeric field"
    print(f"  [OK] Non-numeric field rejected: {res_non_num['message']}")

    # Negative values
    res_neg = predict_crop({"N": -10, "P": 40, "K": 20, "temperature": 25, "humidity": 60, "ph": 6.5, "rainfall": 100})
    assert res_neg["status"] == "error", "Expected error for negative NPK"
    print(f"  [OK] Negative value rejected: {res_neg['message']}")

    # Extreme out-of-range pH
    res_ph = predict_crop({"N": 50, "P": 40, "K": 20, "temperature": 25, "humidity": 60, "ph": 15.0, "rainfall": 100})
    assert res_ph["status"] == "error", "Expected error for out-of-range pH"
    print(f"  [OK] Out of range pH rejected: {res_ph['message']}")

    print("[PASS] All edge cases and invalid inputs correctly handled without crashes.")

    # 6. Check Literature Profile Enrichment
    print("\n[TEST 5] Verifying Literature Agronomic Profile Enrichment:")
    for crop in ["Rice", "Tomato", "Apple", "Cotton", "Ginger"]:
        prof = get_crop_profile_metadata(crop)
        assert prof["crop_name"], f"Missing crop_name for {crop}"
        assert prof["scientific_name"] != "N/A", f"Missing scientific_name for {crop}"
        assert prof["growing_season"], f"Missing growing_season for {crop}"
        assert prof["water_requirement"], f"Missing water_requirement for {crop}"
        print(f"  [OK] {crop} profile: Sci={prof['scientific_name']}, Hindi={prof.get('hindi_name')}, Season={prof['growing_season']}, Water={prof['water_requirement']}")

    print("[PASS] Literature agronomic profiles properly enriched.")

    print("\n" + "=" * 70)
    print("ALL 95-CLASS CROP RECOMMENDATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
