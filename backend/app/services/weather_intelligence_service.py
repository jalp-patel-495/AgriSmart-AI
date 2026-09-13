"""
AgriSmart AI – Agrometeorological Weather-Based Intelligence Service (Bonus Module C)
Combines live/forecast Open-Meteo telemetry with existing soil moisture, irrigation models,
and crop disease detection results into deterministic, actionable farm advisories.
"""
import logging
from typing import Dict, Any, Optional, Tuple
import requests

from backend.app.schemas.weather_intelligence import (
    WeatherTelemetry,
    WeatherIntelligenceRequest,
    WeatherIntelligenceResponse,
)
from backend.app.schemas.weather import DailyForecastItem
from backend.app.services.weather_service import decode_wmo_code
from src.irrigation.predict import predict_irrigation

logger = logging.getLogger(__name__)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def fetch_live_weather_telemetry(lat: float, lon: float, timeout_sec: float = 6.0) -> Optional[Dict[str, Any]]:
    """
    Fetches live and forecast weather telemetry from Open-Meteo API.
    Zero data fabrication: returns None if the network request fails, times out,
    or returns an unexpected status code.
    """
    params = {
        "latitude": round(lat, 4),
        "longitude": round(lon, 4),
        "current": "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m",
        "hourly": "precipitation_probability,precipitation",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code",
        "forecast_days": 7,
        "timezone": "auto",
    }

    try:
        response = requests.get(OPEN_METEO_URL, params=params, timeout=timeout_sec)
        if response.status_code != 200:
            logger.warning(f"Open-Meteo API returned status code {response.status_code}")
            return None
        return response.json()
    except (requests.RequestException, Exception) as exc:
        logger.warning(f"Open-Meteo connection error: {exc}")
        return None


def parse_weather_telemetry(raw_weather: Dict[str, Any]) -> WeatherTelemetry:
    """
    Extracts relevant weather parameters from Open-Meteo payload for 24-48 hour window.
    """
    current = raw_weather.get("current", {})
    daily = raw_weather.get("daily", {})
    hourly = raw_weather.get("hourly", {})

    temp = float(current.get("temperature_2m", 25.0))
    humidity = int(current.get("relative_humidity_2m", 60))
    w_code = int(current.get("weather_code", 0))
    cond_desc, cond_icon = decode_wmo_code(w_code)
    wind_speed = float(current.get("wind_speed_10m", 0.0))

    # Precipitation probability: take maximum over the next 24-48 hours
    hourly_probs = hourly.get("precipitation_probability", [])
    daily_probs = daily.get("precipitation_probability_max", [])

    if hourly_probs and len(hourly_probs) >= 24:
        rain_prob = int(max(hourly_probs[:48]))
    elif daily_probs:
        rain_prob = int(max(daily_probs[:2]))
    else:
        rain_prob = 0

    # Forecast precipitation: sum over next 24-48 hours
    hourly_precip = hourly.get("precipitation", [])
    daily_precip = daily.get("precipitation_sum", [])

    if hourly_precip and len(hourly_precip) >= 24:
        forecast_precip = round(float(sum(hourly_precip[:48])), 2)
    elif daily_precip:
        forecast_precip = round(float(sum(daily_precip[:2])), 2)
    else:
        forecast_precip = round(float(current.get("precipitation", 0.0)), 2)

    return WeatherTelemetry(
        temperature=temp,
        humidity=humidity,
        rain_probability=rain_prob,
        forecast_precipitation=forecast_precip,
        weather_condition=cond_desc,
        weather_code=w_code,
        wind_speed_kmh=wind_speed,
        weather_icon=cond_icon,
    )


def compute_weather_risk_level(
    rain_probability: int,
    forecast_precipitation: float,
    humidity: int,
    irrigation_required: Optional[bool],
    is_diseased: bool,
    disease_confidence: Optional[float],
) -> str:
    """
    Deterministic Weather Risk Level:
    HIGH:
      - High rain probability (>=60%) with meaningful forecast precipitation (>=2.0mm) OR
      - High humidity (>=75%) combined with high-confidence disease (confidence >= 0.65) OR
      - Extreme humidity (>=85%) with rain probability >= 60%
    MEDIUM:
      - Moderate rain probability (40% to 59%) OR
      - Moderate-to-high humidity (60% to 74%) OR
      - Irrigation required (moisture deficit) without imminent rain OR
      - High humidity (>=75%) on healthy/unconfirmed disease crop
    LOW:
      - Favorable/mild conditions: rain prob < 40%, forecast precip < 1.0mm, humidity < 60%,
        no high-confidence disease outbreak, adequate soil moisture.
    """
    high_confidence_disease = is_diseased and (disease_confidence is None or disease_confidence >= 0.65)

    if (rain_probability >= 60 and forecast_precipitation >= 2.0) or \
       (humidity >= 75 and high_confidence_disease) or \
       (humidity >= 85 and rain_probability >= 60):
        return "HIGH"

    if (40 <= rain_probability < 60) or \
       (60 <= humidity < 75) or \
       (irrigation_required is True and rain_probability < 40) or \
       (humidity >= 75 and not high_confidence_disease):
        return "MEDIUM"

    return "LOW"


def evaluate_weather_intelligence(
    payload: WeatherIntelligenceRequest,
    raw_weather_data: Optional[Dict[str, Any]] = None,
) -> WeatherIntelligenceResponse:
    """
    Main evaluation pipeline:
    1. Ingests or fetches Open-Meteo weather data (fails safely if unavailable).
    2. Runs existing irrigation prediction if soil moisture is provided.
    3. Analyzes disease context with strict 65% confidence guardrails.
    4. Synthesizes transparent recommendation, reasoning, and risk level.
    """
    # 1. Weather Telemetry Ingestion
    if raw_weather_data is None:
        raw_weather_data = fetch_live_weather_telemetry(payload.latitude, payload.longitude)

    if not raw_weather_data:
        return WeatherIntelligenceResponse(
            status="weather_unavailable",
            weather=None,
            irrigation_prediction=None,
            weather_risk=None,
            recommendation="Weather data unavailable.",
            reasoning=["Agrometeorological weather service is currently unreachable. Real-time forecast could not be retrieved."],
            disease_monitoring=None,
        )

    telemetry = parse_weather_telemetry(raw_weather_data)

    # 2. Irrigation Inference (using existing irrigation model)
    # The existing irrigation model is trained on soil_moisture, temperature, humidity.
    # Rainfall is NOT a trained feature of the model; weather acts as an additional decision layer.
    irrigation_prediction: Optional[str] = None
    irrigation_required: Optional[bool] = None
    reasoning = []

    # Effective temperature and humidity (in-situ sensors override if explicitly supplied)
    effective_temp = float(payload.temperature) if payload.temperature is not None else telemetry.temperature
    effective_humidity = float(payload.humidity) if payload.humidity is not None else float(telemetry.humidity)

    if payload.soil_moisture is not None:
        irr_features = {
            "soil_moisture": float(payload.soil_moisture),
            "temperature": effective_temp,
            "humidity": effective_humidity,
        }
        try:
            irr_res = predict_irrigation(irr_features)
            if irr_res.get("status") == "success":
                irrigation_prediction = irr_res.get("prediction")  # "YES" | "NO"
                irrigation_required = bool(irr_res.get("irrigation_required"))
            else:
                reasoning.append("Warning: Irrigation model inference did not return success.")
        except Exception as e:
            logger.error(f"Error calling irrigation model: {e}")
            reasoning.append(f"Irrigation model error: {str(e)}")
    else:
        reasoning.append("Soil moisture data was not provided; cannot evaluate irrigation requirement.")

    # 3. Weather + Irrigation Decision Rules
    recommendation = ""
    rain_prob = telemetry.rain_probability
    forecast_precip = telemetry.forecast_precipitation

    if payload.soil_moisture is None:
        recommendation = "Insufficient weather/farm data for a reliable recommendation."
    elif irrigation_prediction == "YES":
        reasoning.append("Irrigation model predicts irrigation is required.")
        if rain_prob >= 60 and forecast_precip >= 0.5:
            recommendation = "Delay irrigation \u2014 rain is likely."
            reasoning.append(f"Rain probability is high ({rain_prob}%).")
            reasoning.append(f"Forecast precipitation is expected ({forecast_precip:.1f} mm in the next 24\u201348 hours).")
        elif rain_prob < 40:
            recommendation = "Irrigation recommended \u2014 soil moisture is low and rain is unlikely."
            reasoning.append(f"Soil moisture is low ({payload.soil_moisture:.1f}%).")
            reasoning.append(f"Rain probability is low ({rain_prob}%).")
        else:
            recommendation = "Delay irrigation \u2014 rain is likely." if (rain_prob >= 50 and forecast_precip >= 2.0) else "Monitor weather before irrigating \u2014 moderate rain probability."
            reasoning.append(f"Moderate rain probability ({rain_prob}%) forecasted.")
    elif irrigation_prediction == "NO":
        reasoning.append("Irrigation model predicts no irrigation needed (adequate soil moisture).")
        if rain_prob >= 60:
            recommendation = "No irrigation needed now; rainfall is likely."
            reasoning.append(f"Rain probability is high ({rain_prob}%).")
        elif rain_prob < 40:
            recommendation = "Weather conditions are currently favorable."
            reasoning.append(f"Adequate soil moisture ({payload.soil_moisture:.1f}%) and low rain risk ({rain_prob}%).")
        else:
            recommendation = "No irrigation needed now."
            reasoning.append("Soil moisture is sufficient and rain probability is moderate.")
    else:
        recommendation = "Insufficient weather/farm data for a reliable recommendation."

    # 4. Weather + Disease Decision Logic
    disease_monitoring: Optional[str] = None
    is_diseased = False

    if payload.disease:
        disease_clean = payload.disease.strip()
        is_healthy = "healthy" in disease_clean.lower() or disease_clean.lower() == "none"

        if not is_healthy:
            is_diseased = True
            conf = payload.disease_confidence
            if conf is not None and conf < 0.65:
                # MODEL SAFETY RULE: Suppress disease-specific treatment and notify farmer
                disease_monitoring = "Low Confidence \u2014 Further Inspection Needed"
                reasoning.append(f"Disease prediction confidence ({conf * 100:.1f}%) is below 65% safety threshold. Specific treatment advice is suppressed.")
                reasoning.append("Please upload a clearer, high-resolution leaf image for definitive diagnosis.")
            else:
                # High-confidence disease detected
                if telemetry.humidity >= 75 or forecast_precip > 1.0 or rain_prob >= 60:
                    disease_monitoring = "Weather conditions may favor disease development. Monitor the crop closely."
                    reasoning.append(f"Elevated humidity ({telemetry.humidity}%) and moisture conditions favor pathogen activity for {disease_clean}.")
                else:
                    disease_monitoring = "Current weather conditions do not indicate high disease development pressure."
                    reasoning.append("Ambient humidity and rainfall are below critical thresholds for rapid spore dispersion.")
        else:
            if telemetry.humidity >= 80 and rain_prob >= 60:
                disease_monitoring = "High humidity and moisture present elevated foliar pathogen risk. Monitor the crop closely."
            else:
                disease_monitoring = "Foliage health is normal under current atmospheric conditions."

    # 5. Deterministic Risk Level Computation
    risk_level = compute_weather_risk_level(
        rain_probability=rain_prob,
        forecast_precipitation=forecast_precip,
        humidity=telemetry.humidity,
        irrigation_required=irrigation_required,
        is_diseased=is_diseased,
        disease_confidence=payload.disease_confidence,
    )

    # 6. Multi-day Agrometeorological Forecast Items
    daily_forecast = []
    daily_raw = raw_weather_data.get("daily", {})
    dates = daily_raw.get("time", [])
    max_temps = daily_raw.get("temperature_2m_max", [])
    min_temps = daily_raw.get("temperature_2m_min", [])
    precip_sums = daily_raw.get("precipitation_sum", [])
    precip_probs = daily_raw.get("precipitation_probability_max", [])
    codes = daily_raw.get("weather_code", [])

    for i in range(len(dates)):
        d_date = str(dates[i])
        d_max = float(max_temps[i]) if i < len(max_temps) else telemetry.temperature
        d_min = float(min_temps[i]) if i < len(min_temps) else telemetry.temperature - 5.0
        d_precip = float(precip_sums[i]) if i < len(precip_sums) else 0.0
        d_prob = int(precip_probs[i]) if i < len(precip_probs) else 0
        d_code = int(codes[i]) if i < len(codes) else 0
        d_text, d_icon = decode_wmo_code(d_code)

        d_risk = "Low"
        if (d_prob >= 60 and d_precip >= 2.0) or d_prob >= 80:
            d_risk = "High"
        elif d_prob >= 40 or d_precip >= 1.0:
            d_risk = "Moderate"

        daily_forecast.append(
            DailyForecastItem(
                date=d_date,
                temperature_max_c=round(d_max, 1),
                temperature_min_c=round(d_min, 1),
                precipitation_sum_mm=round(d_precip, 1),
                precipitation_probability_pct=d_prob,
                weather_code=d_code,
                weather_condition=d_text,
                weather_icon=d_icon,
                disease_risk_level=d_risk,
                disease_risk_score=min(100, int((d_prob * 0.7) + (d_precip * 5))),
            )
        )

    return WeatherIntelligenceResponse(
        status="success",
        weather=telemetry,
        irrigation_prediction=irrigation_prediction,
        weather_risk=risk_level,
        recommendation=recommendation,
        reasoning=reasoning,
        disease_monitoring=disease_monitoring,
        daily_forecast=daily_forecast,
    )
