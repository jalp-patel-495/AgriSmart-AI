"""
Unit & Integration Tests for Bonus Module D: Sustainability Score
Verifies:
1. Healthy crop + no irrigation required
2. Irrigation required + no rain
3. Irrigation required + rain likely
4. High-confidence disease
5. Low-confidence disease
6. Missing NPK
7. Missing weather
8. Missing disease result
9. Missing irrigation result
10. Complete data
11. Partial data
12. Score always remains between 0 and 100
"""
import unittest
from backend.app.schemas.sustainability import SustainabilityScoreRequest
from backend.app.services.sustainability_service import compute_sustainability_score


class TestSustainabilityScore(unittest.TestCase):

    def test_01_healthy_crop_and_no_irrigation_required(self):
        """Test 1: Healthy crop + no irrigation required (high efficiency)."""
        req = SustainabilityScoreRequest(
            crop="Wheat",
            nitrogen=120.0,
            phosphorus=60.0,
            potassium=40.0,
            irrigation_prediction="NO",
            rain_probability=40.0,
            weather_risk="LOW",
            disease="Healthy",
            disease_confidence=0.95,
        )
        res = compute_sustainability_score(req)
        assert res.status == "success"
        assert res.available_data is True
        assert res.components["water_efficiency"] == 40
        assert res.components["resource_use"] == 30
        assert res.components["crop_health"] == 30
        assert res.sustainability_score == 100
        assert res.level == "Excellent"
        assert not res.is_normalized

    def test_02_irrigation_required_and_no_rain(self):
        """Test 2: Irrigation required + no rain expected (lower water efficiency)."""
        req = SustainabilityScoreRequest(
            crop="Tomato",
            nitrogen=120.0,
            phosphorus=80.0,
            potassium=60.0,
            irrigation_prediction="YES",
            rain_probability=10.0,
            forecast_precipitation=0.0,
            disease="Healthy",
            disease_confidence=0.90,
        )
        res = compute_sustainability_score(req)
        assert res.components["water_efficiency"] == 20
        assert "Review irrigation timing" in res.suggestions[0]
        assert res.sustainability_score == 80  # 20 + 30 + 30

    def test_03_irrigation_required_and_rain_likely(self):
        """Test 3: Irrigation required + rain likely (moderate water efficiency: 25 pts)."""
        req = SustainabilityScoreRequest(
            crop="Rice",
            nitrogen=100.0,
            phosphorus=60.0,
            potassium=60.0,
            irrigation_prediction="YES",
            rain_probability=75.0,
            forecast_precipitation=12.0,
            disease="Healthy",
            disease_confidence=0.92,
        )
        res = compute_sustainability_score(req)
        assert res.components["water_efficiency"] == 25
        assert res.sustainability_score == 85  # 25 + 30 + 30
        assert res.level == "Excellent"

    def test_04_high_confidence_disease(self):
        """Test 4: High-confidence disease detected (crop health = 10 pts)."""
        req = SustainabilityScoreRequest(
            crop="Potato",
            nitrogen=150.0,
            phosphorus=80.0,
            potassium=100.0,
            irrigation_prediction="NO",
            rain_probability=20.0,
            disease="Potato___Early_blight",
            disease_confidence=0.88,
        )
        res = compute_sustainability_score(req)
        assert res.components["crop_health"] == 10
        assert any("Monitor crop health" in s for s in res.suggestions)
        # Water = 35, Resource = 30, Health = 10 -> Total 75
        assert res.sustainability_score == 75
        assert res.level == "Good"

    def test_05_low_confidence_disease(self):
        """Test 5: Low-confidence disease (<65%) -> Crop Health marked unavailable."""
        req = SustainabilityScoreRequest(
            crop="Corn",
            nitrogen=120.0,
            phosphorus=60.0,
            potassium=40.0,
            irrigation_prediction="NO",
            rain_probability=10.0,
            disease="Corn___Northern_Leaf_Blight",
            disease_confidence=0.42,  # Low confidence
        )
        res = compute_sustainability_score(req)
        assert res.components["crop_health"] is None
        assert res.component_details["crop_health"].status == "unavailable"
        assert res.is_normalized is True
        # Water = 35/40, Resource = 30/30 -> 65 / 70 -> 93/100
        assert res.sustainability_score == 93

    def test_06_missing_npk(self):
        """Test 6: Missing NPK -> Resource Use marked unavailable, score normalized."""
        req = SustainabilityScoreRequest(
            crop="Tomato",
            nitrogen=None,
            phosphorus=None,
            potassium=None,
            irrigation_prediction="NO",
            rain_probability=35.0,
            disease="Healthy",
            disease_confidence=0.90,
        )
        res = compute_sustainability_score(req)
        assert res.components["resource_use"] is None
        assert res.component_details["resource_use"].status == "unavailable"
        assert res.is_normalized is True
        # Water = 40/40, Health = 30/30 -> 70 / 70 -> 100/100
        assert res.sustainability_score == 100
        assert res.level == "Excellent"

    def test_07_missing_weather(self):
        """Test 7: Missing weather context -> Water Efficiency still evaluated with standard baseline."""
        req = SustainabilityScoreRequest(
            crop="Wheat",
            nitrogen=120.0,
            phosphorus=60.0,
            potassium=40.0,
            irrigation_prediction="NO",
            rain_probability=None,
            weather_risk=None,
            disease="Healthy",
            disease_confidence=0.95,
        )
        res = compute_sustainability_score(req)
        # Irrigation not required without rain info -> 35 pts
        assert res.components["water_efficiency"] == 35
        assert res.sustainability_score == 95  # 35 + 30 + 30

    def test_08_missing_disease_result(self):
        """Test 8: Missing disease result -> Crop Health unavailable, score normalized."""
        req = SustainabilityScoreRequest(
            crop="Rice",
            nitrogen=100.0,
            phosphorus=60.0,
            potassium=60.0,
            irrigation_prediction="NO",
            rain_probability=10.0,
            disease=None,
            disease_confidence=None,
        )
        res = compute_sustainability_score(req)
        assert res.components["crop_health"] is None
        assert res.component_details["crop_health"].status == "unavailable"
        assert res.is_normalized is True
        # Water = 35/40, Resource = 30/30 -> 65 / 70 -> 93/100
        assert res.sustainability_score == 93

    def test_09_missing_irrigation_result(self):
        """Test 9: Missing irrigation result -> Water Efficiency unavailable, score normalized."""
        req = SustainabilityScoreRequest(
            crop="Tomato",
            nitrogen=120.0,
            phosphorus=80.0,
            potassium=60.0,
            irrigation_prediction=None,
            disease="Healthy",
            disease_confidence=0.91,
        )
        res = compute_sustainability_score(req)
        assert res.components["water_efficiency"] is None
        assert res.component_details["water_efficiency"].status == "unavailable"
        assert res.is_normalized is True
        # Resource = 30/30, Health = 30/30 -> 60 / 60 -> 100/100
        assert res.sustainability_score == 100

    def test_10_complete_data_multivariate_evaluation(self):
        """Test 10: Complete real-world data with all parameters provided."""
        req = SustainabilityScoreRequest(
            crop="Tomato",
            soil_moisture=25.0,
            temperature=30.0,
            humidity=70.0,
            nitrogen=80.0,      # Moderately outside tomato reference (120)
            phosphorus=40.0,    # Moderately outside tomato reference (80)
            potassium=40.0,
            rainfall=100.0,
            irrigation_prediction="NO",
            irrigation_priority="NONE",
            disease="Healthy",
            disease_confidence=0.91,
            rain_probability=30.0,
            weather_risk="LOW",
        )
        res = compute_sustainability_score(req)
        assert res.status == "success"
        assert res.available_data is True
        assert res.components["water_efficiency"] == 40
        assert res.components["resource_use"] == 20
        assert res.components["crop_health"] == 30
        assert res.sustainability_score == 90
        assert res.level == "Excellent"
        assert not res.is_normalized
        assert "Review NPK inputs against the selected crop profile." in res.suggestions

    def test_11_partial_data_only_one_component_available(self):
        """Test 11: Only one component available -> Normalized to 100."""
        req = SustainabilityScoreRequest(
            crop="Wheat",
            nitrogen=None,
            phosphorus=None,
            potassium=None,
            irrigation_prediction=None,
            disease="Wheat___healthy",
            disease_confidence=0.88,
        )
        res = compute_sustainability_score(req)
        assert res.available_data is True
        assert res.components["water_efficiency"] is None
        assert res.components["resource_use"] is None
        assert res.components["crop_health"] == 30
        assert res.is_normalized is True
        assert res.sustainability_score == 100  # 30/30 -> 100%

    def test_12_score_always_bounded_between_0_and_100(self):
        """Test 12: Stress test boundary conditions: score must always be 0 <= score <= 100."""
        # Worst possible case: irrigation needed + no rain, extreme NPK deviation, high-confidence disease
        req_worst = SustainabilityScoreRequest(
            crop="Tomato",
            nitrogen=500.0,     # Extreme excess
            phosphorus=400.0,
            potassium=350.0,
            irrigation_prediction="YES",
            rain_probability=5.0,
            forecast_precipitation=0.0,
            disease="Tomato___Late_blight",
            disease_confidence=0.99,
        )
        res_worst = compute_sustainability_score(req_worst)
        assert 0 <= res_worst.sustainability_score <= 100
        # Water = 20, Resource = 10, Health = 10 -> Total = 40
        assert res_worst.sustainability_score == 40
        assert res_worst.level == "Moderate"

        # Best possible case:
        req_best = SustainabilityScoreRequest(
            crop="Tomato",
            nitrogen=120.0,
            phosphorus=80.0,
            potassium=60.0,
            irrigation_prediction="NO",
            rain_probability=40.0,
            weather_risk="LOW",
            disease="Healthy",
            disease_confidence=0.95,
        )
        res_best = compute_sustainability_score(req_best)
        assert 0 <= res_best.sustainability_score <= 100
        assert res_best.sustainability_score == 100
        assert res_best.level == "Excellent"

        # All empty / missing case:
        res_empty = compute_sustainability_score(SustainabilityScoreRequest())
        assert res_empty.sustainability_score is None
        assert res_empty.level == "Data Unavailable"
        assert res_empty.available_data is False


if __name__ == "__main__":
    unittest.main()

