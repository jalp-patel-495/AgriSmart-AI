"""
AgriSmart AI – Unified Farmer Advisory & Agriculture Decision Engine
Coordinates disease detection, crop recommendation, irrigation scheduling, and yield estimation
into a clear, actionable, farmer-friendly decision payload.
"""
import sys
from pathlib import Path
from typing import Dict, Any, Optional, List, Union

# Ensure project root is in sys.path
root_dir = Path(__file__).resolve().parents[2]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from src.farmer_advisor.rules import (
    evaluate_disease_advisory,
    evaluate_irrigation_advisory,
    evaluate_yield_advisory,
    evaluate_crop_recommendation_advisory,
    compute_overall_priority
)

# Optional dynamic model imports (used only when raw features are passed)
try:
    from src.disease.predict import predict_disease
except ImportError:
    predict_disease = None

try:
    from src.crop_recommendation.predict import predict_crop
except ImportError:
    predict_crop = None

try:
    from src.irrigation.predict import predict_irrigation
except ImportError:
    predict_irrigation = None

try:
    from src.yield_prediction.predict import predict_yield
except ImportError:
    try:
        import importlib
        _ym = importlib.import_module("src.yield.predict")
        predict_yield = _ym.predict_yield
    except Exception:
        predict_yield = None


def generate_farmer_advice(
    crop: Optional[str] = None,
    disease_result: Optional[Dict[str, Any]] = None,
    irrigation_result: Optional[Dict[str, Any]] = None,
    yield_result: Optional[Dict[str, Any]] = None,
    crop_rec_result: Optional[Dict[str, Any]] = None,
    environmental_info: Optional[Dict[str, Any]] = None,
    image_path: Optional[str] = None,
    irrigation_features: Optional[Dict[str, Any]] = None,
    yield_features: Optional[Dict[str, Any]] = None,
    crop_rec_features: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Generates unified agricultural advice by combining validated model outputs and rules.

    Parameters:
        crop: Optional crop name override (e.g. 'Tomato', 'Wheat', 'Rice').
        disease_result: Pre-computed disease output {'crop': ..., 'disease': ..., 'confidence': ...}.
        irrigation_result: Pre-computed irrigation output {'irrigation_required': ..., 'priority': ..., 'confidence': ...}.
        yield_result: Pre-computed yield output {'predicted_yield': ..., 'unit': ...}.
        crop_rec_result: Pre-computed crop rec output {'recommended_crop': ..., 'confidence': ...}.
        environmental_info: Optional actual observations {'soil_moisture': ..., 'temperature': ..., 'humidity': ..., 'rainfall': ...}.
        image_path: Optional leaf image path to automatically trigger disease detection if disease_result is None.
        irrigation_features: Optional telemetry dict to trigger predict_irrigation if irrigation_result is None.
        yield_features: Optional acreage/weather dict to trigger predict_yield if yield_result is None.
        crop_rec_features: Optional N-P-K dict to trigger predict_crop if crop_rec_result is None.

    Returns:
        JSON-compatible dictionary matching the AgriSmart farmer advice format:
        {
            "farm_status": "Attention Required",
            "overall_priority": "HIGH",
            "crop": "Tomato",
            "disease": {"name": ..., "confidence": ...},
            "irrigation": {"required": ..., "priority": ..., "confidence": ...},
            "yield": {"estimated": ..., "unit": ...},
            "recommendations": [...],
            "warnings": [...],
            "status": "success"
        }
    """
    recommendations: List[str] = []
    warnings: List[str] = []

    # 1. Resolve Disease Detection Result
    if disease_result is None and image_path and predict_disease:
        try:
            disease_result = predict_disease(image_path)
        except Exception as e:
            warnings.append(f"Disease model inference failed: {str(e)}")

    # 2. Resolve Irrigation Result
    if irrigation_result is None and irrigation_features and predict_irrigation:
        try:
            irrigation_result = predict_irrigation(irrigation_features)
        except Exception as e:
            warnings.append(f"Irrigation model inference failed: {str(e)}")
    elif irrigation_result is None and environmental_info and predict_irrigation:
        # Check if environmental_info contains soil_moisture, temperature, humidity
        if "soil_moisture" in environmental_info or "moisture" in environmental_info:
            try:
                irrigation_result = predict_irrigation(environmental_info)
            except Exception:
                pass

    # 3. Resolve Yield Result
    if yield_result is None and yield_features and predict_yield:
        try:
            yield_result = predict_yield(yield_features)
        except Exception as e:
            warnings.append(f"Yield model inference failed: {str(e)}")

    # 4. Resolve Crop Recommendation Result
    if crop_rec_result is None and crop_rec_features and predict_crop:
        try:
            crop_rec_result = predict_crop(crop_rec_features)
        except Exception as e:
            warnings.append(f"Crop recommendation inference failed: {str(e)}")

    # 5. Evaluate Individual Advisory Components
    dis_info, dis_recs, dis_warns = evaluate_disease_advisory(disease_result)
    recommendations.extend(dis_recs)
    warnings.extend(dis_warns)

    irr_info, irr_recs, irr_warns = evaluate_irrigation_advisory(irrigation_result)
    recommendations.extend(irr_recs)
    warnings.extend(irr_warns)

    yield_info, yield_recs = evaluate_yield_advisory(yield_result)
    recommendations.extend(yield_recs)

    rec_crop, rec_recs, rec_warns = evaluate_crop_recommendation_advisory(crop_rec_result)
    recommendations.extend(rec_recs)
    warnings.extend(rec_warns)

    # 6. Environmental Context Notes (Only if actually supplied, no invented data)
    if environmental_info:
        env_notes = []
        if "soil_moisture" in environmental_info:
            env_notes.append(f"Soil Moisture: {environmental_info['soil_moisture']}%")
        if "temperature" in environmental_info:
            env_notes.append(f"Temperature: {environmental_info['temperature']}°C")
        if "humidity" in environmental_info:
            env_notes.append(f"Humidity: {environmental_info['humidity']}%")
        if "rainfall" in environmental_info:
            env_notes.append(f"Recent Rainfall: {environmental_info['rainfall']}mm")
        if "soil_pH" in environmental_info or "ph" in environmental_info:
            ph_val = environmental_info.get("soil_pH", environmental_info.get("ph"))
            env_notes.append(f"Soil pH: {ph_val}")

        if env_notes:
            recommendations.append(f"Field Telemetry Verified: {', '.join(env_notes)}.")

    # 7. Resolve Primary Crop Name
    final_crop = crop
    if not final_crop and disease_result and "crop" in disease_result and disease_result["crop"]:
        final_crop = str(disease_result["crop"]).capitalize()
    if not final_crop and rec_crop:
        final_crop = str(rec_crop).capitalize()
    if not final_crop and yield_features and "Crop" in yield_features:
        final_crop = str(yield_features["Crop"]).capitalize()
    if not final_crop:
        final_crop = "General Crop"

    # 8. Compute Overall Farm Status and Priority
    farm_status, overall_priority = compute_overall_priority(dis_info, irr_info)

    # Combined high disease + high irrigation warning
    if overall_priority == "CRITICAL":
        warnings.insert(
            0,
            "COMPOUND STRESS ALERT: High fungal/pathogen infection detected simultaneously with critical soil moisture depletion. Avoid overhead irrigation which spreads spores; prioritize immediate drip irrigation and leaf sanitation."
        )

    return {
        "farm_status": farm_status,
        "overall_priority": overall_priority,
        "crop": final_crop,
        "disease": {
            "name": dis_info.get("name", "Data unavailable"),
            "confidence": dis_info.get("confidence", 0.0)
        },
        "irrigation": {
            "required": irr_info.get("required", False),
            "priority": irr_info.get("priority", "Data unavailable"),
            "confidence": irr_info.get("confidence", 0.0)
        },
        "yield": {
            "estimated": yield_info.get("estimated", "Data unavailable"),
            "unit": yield_info.get("unit", "Tonnes/Ha")
        },
        "recommendations": recommendations,
        "warnings": warnings,
        "status": "success"
    }


if __name__ == "__main__":
    import json
    # Smoke test sample
    sample_advice = generate_farmer_advice(
        crop="Tomato",
        disease_result={"crop": "Tomato", "disease": "Early Blight", "confidence": 0.92},
        irrigation_result={"irrigation_required": True, "prediction": "YES", "priority": "HIGH", "confidence": 0.91},
        yield_result={"predicted_yield": 3.20, "unit": "Tonnes/Ha"},
        environmental_info={"soil_moisture": 22.0, "temperature": 29.5, "humidity": 78.0}
    )
    print("Farmer Advisor smoke test:")
    print(json.dumps(sample_advice, indent=4))
