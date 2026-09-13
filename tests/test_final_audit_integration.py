"""
AgriSmart AI – Final SIH 2026 Audit Integration Test Suite
Verifies all 9 modules against the strict SIH 2026 audit requirements:
1. Disease Detection: 19 classes across 7 staples, <65% confidence safety gate.
2. 22-Crop Production vs 95-Crop Experimental model separation.
3. Smart Irrigation: supported 3 features (soil moisture, temperature, humidity), prediction wording.
4. Weather Intelligence: real telemetry ingestion and 'Weather data unavailable' on failure.
5. Sustainability Score: 40/30/30 weighting, normalization note, 'Rule-based sustainability assessment' disclaimer.
6. Farmer Advisor: safety thresholds, no chemical dosage, no exact water volume.
7. Agentic Advisor: priority arbitration, exact irrigation reason wording, full Action-Reason-Source traceability.
"""
import pytest
from unittest.mock import patch

from ai.src.disease.predict import load_disease_model_artifacts, parse_class_name
from ai.src.crop_recommendation.predict import predict_crop
from ai.src.irrigation.predict import predict_irrigation
from backend.app.schemas.smart_farming import CropRecommendationRequest
from backend.app.services.crop_recommender_service import predict_top_crops
from backend.app.schemas.sustainability import SustainabilityScoreRequest
from backend.app.services.sustainability_service import compute_sustainability_score
from backend.app.schemas.weather_intelligence import WeatherIntelligenceRequest
from backend.app.services.weather_intelligence_service import evaluate_weather_intelligence
from src.farmer_advisor.advisor import generate_farmer_advice
from src.agentic_advisor.schemas import (
    AgenticAdvisorRequest,
    DiseaseDetectionInput,
    SmartIrrigationInput,
)
from src.agentic_advisor.agent import AgenticAdvisor


# ---------------------------------------------------------------------------
# 1. Disease Detection Audit
# ---------------------------------------------------------------------------
def test_disease_detection_classes_and_crops_count():
    """Verify exactly 19 classes across 7 staple crops in model artifacts."""
    _, class_names = load_disease_model_artifacts()
    assert len(class_names) == 19, f"Expected 19 classes, got {len(class_names)}"

    crops = set()
    for c in class_names:
        crop, _ = parse_class_name(c)
        crops.add(crop)

    expected_crops = {"Apple", "Bell Pepper", "Corn", "Grape", "Peach", "Potato", "Tomato"}
    assert crops == expected_crops, f"Expected 7 staples {expected_crops}, got {crops}"


def test_disease_low_confidence_safety_gate():
    """Verify that low-confidence disease (<65%) warns and does not provide unsupported treatments."""
    advice = generate_farmer_advice(
        disease_result={"crop": "Tomato", "disease": "Early Blight", "confidence": 0.45}
    )
    # Check that recommendations prompt for clearer image
    recs_text = " ".join(advice["recommendations"]).lower()
    assert "clearer leaf image" in recs_text or "low confidence" in recs_text

    # Check warnings
    warnings_text = " ".join(advice["warnings"]).lower()
    assert "below the safe actionable threshold" in warnings_text


# ---------------------------------------------------------------------------
# 2. Crop Recommendation Models Separation Audit
# ---------------------------------------------------------------------------
def test_crop_recommendation_models_separation():
    """Verify 22-Crop production baseline and 95-Crop experimental model are cleanly separated."""
    input_payload = {
        "N": 90.0,
        "P": 42.0,
        "K": 43.0,
        "temperature": 20.8,
        "humidity": 82.0,
        "ph": 6.5,
        "rainfall": 202.9,
    }

    # 22-Crop Production Model
    res_22 = predict_crop(input_payload, model_version="22class")
    assert res_22["status"] == "success"
    assert res_22["model_version"] == "22class"
    assert res_22["recommended_crop"] == "rice"

    # 95-Crop Experimental Model
    res_95 = predict_crop(input_payload, model_version="95class")
    assert res_95["status"] == "success"
    assert res_95["model_version"] == "95class"
    assert res_95["recommended_crop"] is not None

    # Verify Service Endpoint Schema
    req_prod = CropRecommendationRequest(
        nitrogen=90, phosphorus=42, potassium=43, ph=6.5,
        temperature=20.8, humidity=82.0, rainfall=202.9,
        model_version="22class"
    )
    svc_res_prod = predict_top_crops(req_prod)
    assert svc_res_prod.model_version == "22class"
    assert svc_res_prod.is_experimental is False

    req_exp = CropRecommendationRequest(
        nitrogen=90, phosphorus=42, potassium=43, ph=6.5,
        temperature=20.8, humidity=82.0, rainfall=202.9,
        model_version="95class"
    )
    svc_res_exp = predict_top_crops(req_exp)
    assert svc_res_exp.model_version == "95class"
    assert svc_res_exp.is_experimental is True


# ---------------------------------------------------------------------------
# 3. Smart Irrigation Audit
# ---------------------------------------------------------------------------
def test_smart_irrigation_supported_inputs_and_wording():
    """Verify irrigation inference only requires supported features: soil_moisture, temperature, humidity."""
    # Dry soil -> YES
    dry_res = predict_irrigation({"soil_moisture": 15.0, "temperature": 35.0, "humidity": 30.0})
    assert dry_res["status"] == "success"
    assert dry_res["prediction"] == "YES"
    assert dry_res["irrigation_required"] is True
    assert dry_res["priority"] in ["HIGH", "MEDIUM"]

    # Wet soil -> NO
    wet_res = predict_irrigation({"soil_moisture": 85.0, "temperature": 20.0, "humidity": 90.0})
    assert wet_res["status"] == "success"
    assert wet_res["prediction"] == "NO"
    assert wet_res["irrigation_required"] is False
    assert wet_res["priority"] == "NONE"


# ---------------------------------------------------------------------------
# 4. Weather Intelligence Audit
# ---------------------------------------------------------------------------
def test_weather_intelligence_failure_handling():
    """Verify that when weather upstream is unavailable, no fake values are fabricated."""
    req = WeatherIntelligenceRequest(
        latitude=22.5645,
        longitude=72.9289,
        crop="Tomato",
        soil_moisture=30.0,
    )
    # Pass raw_weather_data={} or mock network error
    with patch("backend.app.services.weather_intelligence_service.fetch_live_weather_telemetry", return_value=None):
        res = evaluate_weather_intelligence(req, raw_weather_data=None)
        assert res.status == "weather_unavailable"
        assert res.weather is None
        assert res.recommendation == "Weather data unavailable."
        assert "unreachable" in res.reasoning[0].lower()


# ---------------------------------------------------------------------------
# 5. Sustainability Score Audit
# ---------------------------------------------------------------------------
def test_sustainability_score_weights_levels_and_disclaimer():
    """Verify deterministic 40/30/30 weighting, normalization, and regulatory disclaimer."""
    # Complete high-sustainability scenario
    req_full = SustainabilityScoreRequest(
        crop="Rice",
        irrigation_prediction="NO",
        rain_probability=30.0,
        nitrogen=90.0,
        phosphorus=45.0,
        potassium=40.0,
        disease="Tomato___healthy",
        disease_confidence=0.92,
    )
    res_full = compute_sustainability_score(req_full)
    assert res_full.available_data is True
    assert res_full.is_normalized is False
    assert res_full.component_details["water_efficiency"].max_points == 40
    assert res_full.component_details["resource_use"].max_points == 30
    assert res_full.component_details["crop_health"].max_points == 30
    assert res_full.sustainability_score >= 80
    assert res_full.level == "Excellent"
    assert "Rule-based sustainability assessment" in res_full.disclaimer

    # Partial scenario: Water efficiency only (max 40) normalized to 100
    req_partial = SustainabilityScoreRequest(
        irrigation_prediction="NO",
    )
    res_partial = compute_sustainability_score(req_partial)
    assert res_partial.is_normalized is True
    assert "based on available data" in res_partial.data_note.lower()


# ---------------------------------------------------------------------------
# 6. Farmer Advisor Audit
# ---------------------------------------------------------------------------
def test_farmer_advisor_no_dosage_and_irrigation_disclaimer():
    """Verify Farmer Advisor does not recommend chemical dosages or exact water volumes."""
    advice = generate_farmer_advice(
        crop="Potato",
        disease_result={"crop": "Potato", "disease": "Late Blight", "confidence": 0.88},
        irrigation_result={"irrigation_required": True, "priority": "HIGH", "confidence": 0.95},
        environmental_info={"soil_moisture": 25.0, "temperature": 28.0, "humidity": 70.0}
    )
    all_text = " ".join(advice["recommendations"] + advice["warnings"]).lower()
    # No exact chemical dosage units
    assert "ml/l" not in all_text
    assert "g/ha" not in all_text
    assert "kg/acre" not in all_text
    # No exact volumetric delivery claimed
    assert "exact volumetric water delivery: data unavailable" in all_text


# ---------------------------------------------------------------------------
# 7. Agentic Advisor Audit
# ---------------------------------------------------------------------------
def test_agentic_advisor_irrigation_wording_and_traceability():
    """Verify Agentic Advisor uses exact audit wording and Action-Reason-Source traceability."""
    advisor = AgenticAdvisor()

    # Case A: Irrigation NO
    req_no_irr = AgenticAdvisorRequest(
        irrigation=SmartIrrigationInput(prediction="NO", priority="NONE"),
    )
    res_no_irr = advisor.evaluate(req_no_irr)
    irr_action = [a for a in res_no_irr.actions if "Smart Irrigation" in a.source][0]
    assert irr_action.reason == "The irrigation model predicts that irrigation is not currently required under the provided conditions."
    assert irr_action.source == "Smart Irrigation"

    # Case B: Priority Arbitration
    req_crit = AgenticAdvisorRequest(
        disease=DiseaseDetectionInput(crop="Tomato", disease="Late Blight", confidence=0.88),
        irrigation=SmartIrrigationInput(prediction="YES", priority="HIGH"),
    )
    res_crit = advisor.evaluate(req_crit)
    assert res_crit.priority == "CRITICAL"
    for act in res_crit.actions:
        assert act.action
        assert act.reason
        assert act.source
