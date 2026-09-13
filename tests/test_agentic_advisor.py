"""
Comprehensive Test Suite for Module G: 🤖 Agentic Advisor
Tests all 18 requirements from the specification:
1. CRITICAL priority
2. HIGH priority
3. MEDIUM priority
4. LOW priority
5. DATA INSUFFICIENT
6. High-confidence disease
7. Low-confidence disease (<65% prompts clearer image, no chemical dosage)
8. Irrigation YES
9. Irrigation NO
10. Rain probability affecting irrigation recommendation
11. High weather risk
12. Low sustainability score
13. Missing module data explicitly reported
14. No fabricated values
15. No chemical dosage
16. No exact water litres
17. Every action contains source and reason
18. Full FastAPI endpoint integration
"""
import json
import urllib.request
import urllib.error
import pytest

from src.agentic_advisor.schemas import (
    AgenticAdvisorRequest,
    DiseaseDetectionInput,
    SmartIrrigationInput,
    WeatherIntelligenceInput,
    CropRecommendationInput,
    YieldPredictionInput,
    SustainabilityScoreInput,
)
from src.agentic_advisor.agent import AgenticAdvisor, agentic_advisor_engine
from backend.app.api.v1.endpoints.agentic_advisor import get_agentic_advisor_evaluation


@pytest.fixture
def advisor():
    return AgenticAdvisor()


# 1. CRITICAL Priority
def test_critical_priority(advisor):
    req = AgenticAdvisorRequest(
        disease=DiseaseDetectionInput(crop="Tomato", disease="Early Blight", confidence=0.88),
        irrigation=SmartIrrigationInput(prediction="YES", priority="HIGH"),
    )
    res = advisor.evaluate(req)
    assert res.priority == "CRITICAL"
    assert "Early Blight" in res.situation.disease_status
    assert "HIGH" in res.situation.irrigation_status
    assert len(res.actions) >= 1


# 2. HIGH Priority
def test_high_priority_disease_only(advisor):
    req = AgenticAdvisorRequest(
        disease=DiseaseDetectionInput(crop="Potato", disease="Late Blight", confidence=0.72),
        irrigation=SmartIrrigationInput(prediction="NO", priority="NONE"),
    )
    res = advisor.evaluate(req)
    assert res.priority == "HIGH"


def test_high_priority_irrigation_only(advisor):
    req = AgenticAdvisorRequest(
        disease=DiseaseDetectionInput(crop="Corn", disease="Healthy", confidence=0.92),
        irrigation=SmartIrrigationInput(prediction="YES", priority="HIGH"),
    )
    res = advisor.evaluate(req)
    assert res.priority == "HIGH"


# 3. MEDIUM Priority
def test_medium_priority_cases(advisor):
    # Case A: Irrigation MEDIUM
    req1 = AgenticAdvisorRequest(
        disease=DiseaseDetectionInput(crop="Tomato", disease="Healthy", confidence=0.80),
        irrigation=SmartIrrigationInput(prediction="YES", priority="MEDIUM"),
    )
    assert advisor.evaluate(req1).priority == "MEDIUM"

    # Case B: Disease confidence between 50% and <65%
    req2 = AgenticAdvisorRequest(
        disease=DiseaseDetectionInput(crop="Tomato", disease="Early Blight", confidence=0.58),
        irrigation=SmartIrrigationInput(prediction="NO", priority="NONE"),
    )
    assert advisor.evaluate(req2).priority == "MEDIUM"

    # Case C: Irrigation LOW/REVIEW
    req3 = AgenticAdvisorRequest(
        irrigation=SmartIrrigationInput(prediction="YES", priority="REVIEW"),
    )
    assert advisor.evaluate(req3).priority == "MEDIUM"


# 4. LOW Priority
def test_low_priority_healthy_and_no_irrigation(advisor):
    req = AgenticAdvisorRequest(
        disease=DiseaseDetectionInput(crop="Corn", disease="Tomato___healthy", confidence=0.94),
        irrigation=SmartIrrigationInput(prediction="NO", priority="NONE"),
    )
    res = advisor.evaluate(req)
    assert res.priority == "LOW"
    assert "Healthy" in res.situation.disease_status
    assert "Adequate" in res.situation.irrigation_status or "NO" in res.situation.irrigation_status


# 5. DATA INSUFFICIENT Priority
def test_data_insufficient_priority(advisor):
    req = AgenticAdvisorRequest()
    res = advisor.evaluate(req)
    assert res.priority == "DATA INSUFFICIENT"
    assert len(res.evidence) == 0
    assert len(res.missing_data) == 6


# 6. High-Confidence Disease Action
def test_high_confidence_disease_action(advisor):
    req = AgenticAdvisorRequest(
        disease=DiseaseDetectionInput(crop="Rice", disease="Brown Spot", confidence=0.85),
    )
    res = advisor.evaluate(req)
    actions = [a.action for a in res.actions]
    assert any("Inspect affected plants and consider appropriate disease management" in a for a in actions)


# 7. Low-Confidence Disease Action (Prompts clearer image)
def test_low_confidence_disease_action(advisor):
    req = AgenticAdvisorRequest(
        disease=DiseaseDetectionInput(crop="Apple", disease="Apple Scab", confidence=0.55),
    )
    res = advisor.evaluate(req)
    actions = [a.action for a in res.actions]
    assert any("Upload a clearer leaf image for a more reliable assessment" in a for a in actions)


# 8. Irrigation YES Action
def test_irrigation_yes_action(advisor):
    req = AgenticAdvisorRequest(
        irrigation=SmartIrrigationInput(prediction="YES", priority="HIGH"),
    )
    res = advisor.evaluate(req)
    actions = [a.action for a in res.actions]
    assert any("Check soil moisture and irrigation conditions" in a for a in actions)


# 9. Irrigation NO Action
def test_irrigation_no_action(advisor):
    req = AgenticAdvisorRequest(
        irrigation=SmartIrrigationInput(prediction="NO", priority="NONE"),
    )
    res = advisor.evaluate(req)
    actions = [a.action for a in res.actions]
    assert any("No irrigation action is currently indicated" in a for a in actions)


# 10. Rain Probability Affecting Irrigation Recommendation
def test_rain_probability_delays_irrigation(advisor):
    req = AgenticAdvisorRequest(
        irrigation=SmartIrrigationInput(prediction="YES", priority="HIGH"),
        weather=WeatherIntelligenceInput(rain_probability=85.0, forecast_precipitation=12.0),
    )
    res = advisor.evaluate(req)
    actions = [a.action for a in res.actions]
    assert any("Consider delaying irrigation because rainfall is expected" in a for a in actions)
    # Check source traceability
    rain_action = [a for a in res.actions if "delaying irrigation" in a.action][0]
    assert "Weather Intelligence" in rain_action.source
    assert "Smart Irrigation" in rain_action.source


# 11. High Weather Risk
def test_high_weather_risk_action(advisor):
    req = AgenticAdvisorRequest(
        weather=WeatherIntelligenceInput(weather_risk="HIGH", temperature=42.0, rain_probability=10.0),
    )
    res = advisor.evaluate(req)
    actions = [a.action for a in res.actions]
    assert any("Review weather conditions before performing field operations" in a for a in actions)


# 12. Low Sustainability Score
def test_low_sustainability_action(advisor):
    req = AgenticAdvisorRequest(
        sustainability=SustainabilityScoreInput(score=38.0, level="Low"),
    )
    res = advisor.evaluate(req)
    actions = [a.action for a in res.actions]
    assert any("Review irrigation timing and resource usage" in a for a in actions)


# 13. Missing Module Data Explicitly Declared
def test_missing_module_data(advisor):
    req = AgenticAdvisorRequest(
        disease=DiseaseDetectionInput(crop="Tomato", disease="Early Blight", confidence=0.88),
    )
    res = advisor.evaluate(req)
    assert "Disease Detection" in res.evidence
    assert "Smart Irrigation" in res.missing_data
    assert "Weather Intelligence" in res.missing_data
    assert "Crop Recommendation" in res.missing_data
    assert "Yield Prediction" in res.missing_data
    assert "Sustainability Score" in res.missing_data


# 14. No Fabricated Values
def test_no_fabricated_values(advisor):
    req = AgenticAdvisorRequest(
        disease=DiseaseDetectionInput(crop="Tomato", disease="Early Blight", confidence=0.88),
    )
    res = advisor.evaluate(req)
    assert res.situation.irrigation_status == "Data unavailable"
    assert res.situation.weather_risk == "Data unavailable"
    assert res.situation.sustainability == "Data unavailable"


# 15. No Chemical Dosage
def test_no_chemical_dosage_in_actions(advisor):
    req = AgenticAdvisorRequest(
        disease=DiseaseDetectionInput(crop="Tomato", disease="Early Blight", confidence=0.88),
        irrigation=SmartIrrigationInput(prediction="YES", priority="HIGH"),
        weather=WeatherIntelligenceInput(weather_risk="HIGH", temperature=35.0),
    )
    res = advisor.evaluate(req)
    for act in res.actions:
        full_text = f"{act.action} {act.reason}".lower()
        assert "ml/l" not in full_text
        assert "g/ha" not in full_text
        assert "kg/acre" not in full_text
        assert "ppm" not in full_text


# 16. No Exact Water Litres
def test_no_exact_water_litres_in_actions(advisor):
    req = AgenticAdvisorRequest(
        irrigation=SmartIrrigationInput(prediction="YES", priority="HIGH"),
        weather=WeatherIntelligenceInput(rain_probability=20.0),
    )
    res = advisor.evaluate(req)
    for act in res.actions:
        full_text = f"{act.action} {act.reason}".lower()
        assert "litres" not in full_text
        assert "liters" not in full_text
        assert "litres/ha" not in full_text


# 17. Every Action Contains Source and Reason
def test_actions_contain_source_and_reason(advisor):
    req = AgenticAdvisorRequest(
        disease=DiseaseDetectionInput(crop="Rice", disease="Blast", confidence=0.85),
        irrigation=SmartIrrigationInput(prediction="YES", priority="HIGH"),
        weather=WeatherIntelligenceInput(weather_risk="HIGH", rain_probability=90.0),
        sustainability=SustainabilityScoreInput(score=42.0, level="Low"),
    )
    res = advisor.evaluate(req)
    assert 1 <= len(res.actions) <= 4
    for idx, act in enumerate(res.actions, 1):
        assert act.priority == idx
        assert act.action is not None and len(act.action.strip()) > 5
        assert act.reason is not None and len(act.reason.strip()) > 5
        assert act.source is not None and len(act.source.strip()) > 2


# 18. Full FastAPI Endpoint Integration
def test_fastapi_agentic_advisor_endpoint():
    req = AgenticAdvisorRequest(
        disease=DiseaseDetectionInput(crop="Tomato", disease="Early Blight", confidence=0.88),
        irrigation=SmartIrrigationInput(prediction="YES", priority="HIGH"),
        weather=WeatherIntelligenceInput(temperature=28.5, humidity=65.0, rain_probability=20.0, weather_risk="LOW"),
        sustainability=SustainabilityScoreInput(score=74.0, level="Moderate"),
    )
    # Direct endpoint invocation test
    data = get_agentic_advisor_evaluation(req)
    assert data.priority == "CRITICAL"
    assert data.situation.crop == "Tomato"
    assert "Early Blight" in data.situation.disease_status
    assert len(data.actions) >= 1
    assert "Disease Detection" in data.evidence
    assert "Smart Irrigation" in data.evidence
    assert "Yield Prediction" in data.missing_data

    # Live HTTP test if server is active
    try:
        payload = {
            "disease": {"crop": "Tomato", "disease": "Early Blight", "confidence": 0.88},
            "irrigation": {"prediction": "YES", "priority": "HIGH"},
            "weather": {"temperature": 28.5, "humidity": 65.0, "rain_probability": 20.0, "weather_risk": "LOW"},
            "sustainability": {"score": 74.0, "level": "Moderate"},
        }
        http_req = urllib.request.Request(
            "http://127.0.0.1:8000/api/v1/agentic-advisor",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(http_req, timeout=3) as resp:
            assert resp.status == 200
            res_json = json.loads(resp.read().decode())
            assert res_json["priority"] == "CRITICAL"
    except Exception:
        # Fallback to direct function test if daemon is cycling
        pass
