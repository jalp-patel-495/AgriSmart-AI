"""
AgriSmart AI - Agrometeorological Weather Intelligence Verification Suite
Validates all 12 frontend integration scenarios & backend contract.
"""
import unittest
import json
import urllib.request
import urllib.error
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.schemas.weather_intelligence import WeatherIntelligenceRequest
from backend.app.services.weather_intelligence_service import evaluate_weather_intelligence

API_URL = "http://127.0.0.1:8000/api/v1/weather-intelligence"
ASSISTANT_URL = "http://127.0.0.1:8000/api/v1/assistant/chat"


def get_mock_weather(temperature=28.0, humidity=65, rain_probability=20, forecast_precipitation=0.0, weather_code=1):
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


def query_weather(payload):
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.loads(res.read().decode("utf-8"))


class TestWeatherIntegration(unittest.TestCase):

    def test_01_gps_location_success(self):
        """Scenario 1: Arbitrary coordinates sent directly from GPS sensor."""
        payload = {
            "latitude": 22.3072,
            "longitude": 73.1812,
            "crop": "Tomato",
            "soil_moisture": 25.0,
            "temperature": 32.0,
            "humidity": 45.0,
            "disease": None,
            "disease_confidence": None
        }
        res = query_weather(payload)
        self.assertEqual(res["status"], "success")
        self.assertIsNotNone(res["weather"])
        self.assertIn(res["weather_risk"], ["LOW", "MEDIUM", "HIGH"])
        self.assertIn(res["irrigation_prediction"], ["YES", "NO"])
        self.assertTrue(len(res["daily_forecast"]) >= 5)

    def test_02_gps_invalid_bounds(self):
        """Scenario 2: Validation of coordinates out of bounds."""
        payload = {"latitude": 95.0, "longitude": 200.0}
        req = urllib.request.Request(
            API_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req, timeout=10)
        self.assertEqual(ctx.exception.code, 422)

    def test_03_weather_api_success(self):
        """Scenario 3: Normal successful live Open-Meteo response structure."""
        payload = {"latitude": 19.9975, "longitude": 73.7898, "crop": "Grape"}
        res = query_weather(payload)
        self.assertEqual(res["status"], "success")
        weather = res["weather"]
        self.assertIsInstance(weather["temperature"], (int, float))
        self.assertIsInstance(weather["humidity"], (int, float))
        self.assertIsInstance(weather["rain_probability"], (int, float))
        self.assertIsInstance(weather["forecast_precipitation"], (int, float))
        self.assertIsInstance(weather["weather_condition"], str)
        self.assertIn("wind_speed_kmh", weather)

    def test_04_weather_api_unavailable_handling(self):
        """Scenario 4: Service handles unreachable coordinates gracefully without crash."""
        req = WeatherIntelligenceRequest(
            latitude=22.3072,
            longitude=73.1812,
        )
        res = evaluate_weather_intelligence(req, raw_weather_data={})
        self.assertEqual(res.status, "weather_unavailable")
        self.assertIsNone(res.weather)
        self.assertEqual(res.recommendation, "Weather data unavailable.")

    def test_05_rain_likely_plus_irrigation_yes(self):
        """Scenario 5: Rain is likely (rain_prob >= 60%) + irrigation deficit YES -> Delay irrigation."""
        mock = get_mock_weather(temperature=30.0, humidity=75, rain_probability=85, forecast_precipitation=14.2)
        req = WeatherIntelligenceRequest(latitude=22.3072, longitude=73.1812, crop="Tomato", soil_moisture=25.0, temperature=32.0, humidity=45.0)
        res = evaluate_weather_intelligence(req, raw_weather_data=mock)
        self.assertEqual(res.irrigation_prediction, "YES")
        self.assertIn("Delay irrigation", res.recommendation)
        self.assertEqual(res.weather_risk, "HIGH")

    def test_06_no_rain_plus_irrigation_yes(self):
        """Scenario 6: No rain (rain_prob < 60%) + irrigation deficit YES -> Irrigation recommended."""
        mock = get_mock_weather(temperature=33.0, humidity=35, rain_probability=10, forecast_precipitation=0.0)
        req = WeatherIntelligenceRequest(latitude=22.3072, longitude=73.1812, crop="Tomato", soil_moisture=25.0, temperature=33.0, humidity=35.0)
        res = evaluate_weather_intelligence(req, raw_weather_data=mock)
        self.assertEqual(res.irrigation_prediction, "YES")
        self.assertIn("Irrigation recommended", res.recommendation)
        self.assertEqual(res.weather_risk, "MEDIUM")

    def test_07_irrigation_no_plus_rain_likely(self):
        """Scenario 7: Irrigation NO + rain likely -> No irrigation needed."""
        mock = get_mock_weather(temperature=24.0, humidity=80, rain_probability=90, forecast_precipitation=18.0)
        req = WeatherIntelligenceRequest(latitude=22.3072, longitude=73.1812, crop="Tomato", soil_moisture=75.0, temperature=24.0, humidity=80.0)
        res = evaluate_weather_intelligence(req, raw_weather_data=mock)
        self.assertEqual(res.irrigation_prediction, "NO")
        self.assertIn("No irrigation needed now", res.recommendation)

    def test_08_high_confidence_disease_plus_high_humidity(self):
        """Scenario 8: High-confidence disease (>=65%) + humidity >= 75% -> Specific monitoring alert."""
        mock = get_mock_weather(temperature=26.0, humidity=85, rain_probability=40, forecast_precipitation=1.0)
        req = WeatherIntelligenceRequest(latitude=22.3072, longitude=73.1812, crop="Potato", disease="Late Blight", disease_confidence=0.88, soil_moisture=60.0)
        res = evaluate_weather_intelligence(req, raw_weather_data=mock)
        self.assertIsNotNone(res.disease_monitoring)
        self.assertIn("Weather conditions may favor disease development", res.disease_monitoring)
        self.assertIn("Monitor the crop closely", res.disease_monitoring)

    def test_09_disease_confidence_below_65_suppressed(self):
        """Scenario 9: Low confidence disease (<65%) -> Suppress specific disease and show safety warning."""
        mock = get_mock_weather(temperature=26.0, humidity=85, rain_probability=40, forecast_precipitation=1.0)
        req = WeatherIntelligenceRequest(latitude=22.3072, longitude=73.1812, crop="Tomato", disease="Bacterial Spot", disease_confidence=0.45, soil_moisture=60.0)
        res = evaluate_weather_intelligence(req, raw_weather_data=mock)
        self.assertIn("Low Confidence", res.disease_monitoring)
        self.assertNotIn("Bacterial Spot", res.disease_monitoring)
        self.assertNotIn("dosage", res.disease_monitoring.lower())

    def test_10_all_seven_crops_supported(self):
        """Scenario 10: Crop filter covers all 7 project crops."""
        supported_crops = ["Tomato", "Potato", "Corn", "Apple", "Grape", "Bell Pepper", "Peach"]
        for crop in supported_crops:
            payload = {
                "latitude": 22.5645,
                "longitude": 72.9289,
                "crop": crop,
                "soil_moisture": 30.0
            }
            res = query_weather(payload)
            self.assertEqual(res["status"], "success")
            self.assertIsNotNone(res["weather"])

    def test_11_ai_copilot_weather_integration(self):
        """Scenario 11: AI Co-Pilot receives weather intelligence context and references it in advice."""
        payload = {
            "message": "Should I irrigate today based on the weather?",
            "history": [],
            "context": {
                "crop": "Tomato",
                "temperature": 29.5,
                "humidity": 82.0,
                "rain_forecast_mm": 15.0,
                "weather_risk": "HIGH",
                "weather_condition": "Heavy Rain",
                "weather_recommendation": "Delay irrigation - heavy rain expected."
            }
        }
        req = urllib.request.Request(
            ASSISTANT_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read().decode("utf-8"))
            self.assertTrue(len(data["response"]) > 50)
            self.assertIn("context_acknowledged", data)


if __name__ == "__main__":
    unittest.main()
