"""
AgriSmart AI – Weather-Based Intelligence Unit & Integration Test Suite (Bonus Module C)
Validates all 8 mandatory testing scenarios from the specification:
1. Rain likely + irrigation YES -> Delay irrigation
2. No rain + irrigation YES -> Irrigation recommended
3. Rain likely + irrigation NO -> No irrigation needed now
4. High humidity + high-confidence disease -> Disease monitoring warning
5. Disease confidence < 65% -> No disease-specific treatment
6. Weather API failure -> Weather data unavailable
7. Invalid location -> Proper validation error
8. Missing soil moisture -> Safe fallback
Plus scenario 9: Live Open-Meteo API integration test via FastAPI server.
"""
import unittest
from unittest.mock import patch
import requests

from backend.app.schemas.weather_intelligence import WeatherIntelligenceRequest
from backend.app.services.weather_intelligence_service import (
    evaluate_weather_intelligence,
)

BASE_URL = "http://127.0.0.1:8000/api/v1/weather-intelligence"


def get_mock_weather(
    temperature: float = 28.0,
    humidity: int = 65,
    rain_probability: int = 20,
    forecast_precipitation: float = 0.0,
    weather_code: int = 1,
):
    """Generates a mock Open-Meteo API response structure for deterministic testing."""
    return {
        "latitude": 22.3072,
        "longitude": 73.1812,
        "current": {
            "time": "2026-09-13T12:00",
            "temperature_2m": temperature,
            "relative_humidity_2m": humidity,
            "precipitation": 0.0,
            "rain": 0.0,
            "weather_code": weather_code,
            "wind_speed_10m": 8.5,
        },
        "daily": {
            "time": ["2026-09-13", "2026-09-14"],
            "temperature_2m_max": [temperature + 2, temperature + 3],
            "temperature_2m_min": [temperature - 5, temperature - 4],
            "precipitation_sum": [forecast_precipitation, 0.0],
            "precipitation_probability_max": [rain_probability, rain_probability],
            "weather_code": [weather_code, weather_code],
        },
        "hourly": {
            "precipitation_probability": [rain_probability] * 48,
            "precipitation": [forecast_precipitation / 24.0] * 48,
        },
    }


class TestWeatherIntelligence(unittest.TestCase):

    def test_01_rain_likely_and_irrigation_yes(self):
        """
        Scenario 1: Rain likely (rain_prob >= 60%, precip >= 0.5mm) + irrigation YES
        Expected Action: 'Delay irrigation — rain is likely.'
        """
        mock_weather = get_mock_weather(
            temperature=30.0,
            humidity=75,
            rain_probability=85,
            forecast_precipitation=14.2,
            weather_code=63,
        )
        req = WeatherIntelligenceRequest(
            latitude=22.3072,
            longitude=73.1812,
            crop="Tomato",
            soil_moisture=25.0,  # Dry soil -> irrigation required
            temperature=32.0,
            humidity=45.0,
        )
        res = evaluate_weather_intelligence(req, raw_weather_data=mock_weather)
        data = res.model_dump()

        self.assertEqual(data["status"], "success")
        self.assertEqual(data["irrigation_prediction"], "YES")
        self.assertIn("Delay irrigation", data["recommendation"])
        self.assertIn("rain is likely", data["recommendation"])
        self.assertEqual(data["weather_risk"], "HIGH")
        self.assertTrue(any("irrigation is required" in r.lower() for r in data["reasoning"]))
        self.assertTrue(any("rain probability is high" in r.lower() for r in data["reasoning"]))

    def test_02_no_rain_and_irrigation_yes(self):
        """
        Scenario 2: No rain (rain_prob < 40%) + irrigation YES
        Expected Action: 'Irrigation recommended — soil moisture is low and rain is unlikely.'
        """
        mock_weather = get_mock_weather(
            temperature=33.0,
            humidity=38,
            rain_probability=15,
            forecast_precipitation=0.0,
            weather_code=0,
        )
        req = WeatherIntelligenceRequest(
            latitude=22.3072,
            longitude=73.1812,
            crop="Tomato",
            soil_moisture=22.0,  # Dry soil -> irrigation required
            temperature=33.0,
            humidity=38.0,
        )
        res = evaluate_weather_intelligence(req, raw_weather_data=mock_weather)
        data = res.model_dump()

        self.assertEqual(data["status"], "success")
        self.assertEqual(data["irrigation_prediction"], "YES")
        self.assertIn("Irrigation recommended", data["recommendation"])
        self.assertIn("rain is unlikely", data["recommendation"])
        self.assertTrue(any("soil moisture is low" in r.lower() for r in data["reasoning"]))

    def test_03_rain_likely_and_irrigation_no(self):
        """
        Scenario 3: Rain likely (rain_prob >= 60%) + irrigation NO (adequate moisture)
        Expected Action: 'No irrigation needed now; rainfall is likely.'
        """
        mock_weather = get_mock_weather(
            temperature=24.0,
            humidity=80,
            rain_probability=90,
            forecast_precipitation=18.5,
            weather_code=65,
        )
        req = WeatherIntelligenceRequest(
            latitude=22.3072,
            longitude=73.1812,
            crop="Tomato",
            soil_moisture=75.0,  # High soil moisture -> irrigation NOT required
            temperature=24.0,
            humidity=80.0,
        )
        res = evaluate_weather_intelligence(req, raw_weather_data=mock_weather)
        data = res.model_dump()

        self.assertEqual(data["status"], "success")
        self.assertEqual(data["irrigation_prediction"], "NO")
        self.assertIn("No irrigation needed now", data["recommendation"])
        self.assertIn("rainfall is likely", data["recommendation"])
        self.assertTrue(any("no irrigation needed" in r.lower() for r in data["reasoning"]))

    def test_04_high_humidity_and_high_confidence_disease(self):
        """
        Scenario 4: High humidity (>= 75%) + high-confidence disease (confidence >= 0.65)
        Expected Action: Disease monitoring warning
        """
        mock_weather = get_mock_weather(
            temperature=26.0,
            humidity=82,
            rain_probability=45,
            forecast_precipitation=1.5,
            weather_code=3,
        )
        req = WeatherIntelligenceRequest(
            latitude=22.3072,
            longitude=73.1812,
            crop="Tomato",
            soil_moisture=50.0,
            disease="Tomato_Early_Blight",
            disease_confidence=0.94,  # High confidence
        )
        res = evaluate_weather_intelligence(req, raw_weather_data=mock_weather)
        data = res.model_dump()

        self.assertEqual(data["status"], "success")
        self.assertIsNotNone(data["disease_monitoring"])
        self.assertIn("Weather conditions may favor disease development", data["disease_monitoring"])
        self.assertIn("Monitor the crop closely", data["disease_monitoring"])
        self.assertEqual(data["weather_risk"], "HIGH")

    def test_05_disease_confidence_below_65_safety(self):
        """
        Scenario 5: Disease confidence < 65%
        Expected Action:
        - Show 'Low Confidence — Further Inspection Needed'
        - Do NOT show confirmed disease or disease-specific treatment
        - Instruct user to upload clearer leaf image
        """
        mock_weather = get_mock_weather(
            temperature=28.0,
            humidity=85,
            rain_probability=30,
            forecast_precipitation=0.0,
        )
        req = WeatherIntelligenceRequest(
            latitude=22.3072,
            longitude=73.1812,
            crop="Grape",
            soil_moisture=50.0,
            disease="Grape_Black_Rot",
            disease_confidence=0.48,  # Below 65% threshold
        )
        res = evaluate_weather_intelligence(req, raw_weather_data=mock_weather)
        data = res.model_dump()

        self.assertEqual(data["status"], "success")
        self.assertIsNotNone(data["disease_monitoring"])
        self.assertIn("Low Confidence", data["disease_monitoring"])
        self.assertIn("Further Inspection Needed", data["disease_monitoring"])
        # Ensure no disease-specific treatment is present
        for r in data["reasoning"]:
            self.assertNotIn("fungicide dosage", r.lower())
            self.assertNotIn("spray copper", r.lower())
        self.assertTrue(any("below 65% safety threshold" in r.lower() for r in data["reasoning"]))
        self.assertTrue(any("clearer, high-resolution" in r.lower() for r in data["reasoning"]))

    def test_06_weather_api_failure(self):
        """
        Scenario 6: Weather API failure (network error / timeout / unreachable)
        Expected Action:
        - status: 'weather_unavailable'
        - recommendation: 'Weather data unavailable.'
        - Never invent/fabricate rainfall or weather values.
        """
        with patch("backend.app.services.weather_intelligence_service.fetch_live_weather_telemetry", return_value=None):
            req = WeatherIntelligenceRequest(
                latitude=22.3072,
                longitude=73.1812,
                crop="Corn",
                soil_moisture=30.0,
            )
            res = evaluate_weather_intelligence(req)
            data = res.model_dump()

            self.assertEqual(data["status"], "weather_unavailable")
            self.assertEqual(data["recommendation"], "Weather data unavailable.")
            self.assertIsNone(data["weather"])

    def test_07_invalid_location_validation(self):
        """
        Scenario 7: Invalid latitude/longitude coordinates against live FastAPI endpoint
        Expected Action: Proper HTTP 422 Unprocessable Entity validation error.
        """
        # Latitude exceeds 90 degrees
        invalid_lat_payload = {
            "latitude": 135.0,
            "longitude": 73.1812,
            "crop": "Tomato",
            "soil_moisture": 40.0,
        }
        resp = requests.post(BASE_URL, json=invalid_lat_payload, timeout=5)
        self.assertEqual(resp.status_code, 422)

        # Longitude exceeds 180 degrees
        invalid_lon_payload = {
            "latitude": 22.3072,
            "longitude": -205.0,
            "crop": "Tomato",
            "soil_moisture": 40.0,
        }
        resp2 = requests.post(BASE_URL, json=invalid_lon_payload, timeout=5)
        self.assertEqual(resp2.status_code, 422)

    def test_08_missing_soil_moisture_safe_fallback(self):
        """
        Scenario 8: Missing soil moisture
        Expected Action: Safe fallback, no crash, informs user of insufficient telemetry.
        """
        mock_weather = get_mock_weather(temperature=29.0, humidity=55, rain_probability=20)
        req = WeatherIntelligenceRequest(
            latitude=22.3072,
            longitude=73.1812,
            crop="Bell Pepper",
            soil_moisture=None,  # Omitted soil moisture
        )
        res = evaluate_weather_intelligence(req, raw_weather_data=mock_weather)
        data = res.model_dump()

        self.assertEqual(data["status"], "success")
        self.assertIsNone(data["irrigation_prediction"])
        self.assertIn("Insufficient weather/farm data", data["recommendation"])
        self.assertTrue(any("soil moisture data was not provided" in r.lower() for r in data["reasoning"]))

    def test_09_live_open_meteo_end_to_end(self):
        """
        Scenario 9: Live integration with real Open-Meteo API endpoint via FastAPI backend.
        Confirms genuine zero-key agrometeorological satellite query.
        """
        payload = {
            "latitude": 22.5645,  # Anand Agronomy Region, Gujarat
            "longitude": 72.9289,
            "crop": "Tomato",
            "soil_moisture": 30.0,
        }
        resp = requests.post(BASE_URL, json=payload, timeout=8)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertIsNotNone(data["weather"])
        self.assertIsInstance(data["weather"]["temperature"], (int, float))
        self.assertIsInstance(data["weather"]["humidity"], int)
        self.assertIn(data["irrigation_prediction"], ["YES", "NO"])
        self.assertIn(data["weather_risk"], ["LOW", "MEDIUM", "HIGH"])
        self.assertTrue(len(data["recommendation"]) > 0)


if __name__ == "__main__":
    unittest.main()
