"""
AgriSmart AI – Agrometeorological Weather Intelligence Engine
Integrates weather telemetry, soil moisture, crop stage, and disease risk indices.
"""
from typing import Dict, Any, Optional


def evaluate_weather_intelligence(
    temperature: float,
    humidity: float,
    rainfall_mm: float,
    rain_probability: float,
    soil_moisture: float,
    crop: Optional[str] = None,
    disease: Optional[str] = None
) -> Dict[str, Any]:
    """
    Correlates real-time micro-climate with crop epidemiology and soil physics:
    - Low soil moisture + low rain probability -> Recommend irrigation
    - High rain probability -> Delay irrigation (water saving)
    - High humidity (>80%) + warm temp (20-30C) -> High fungal sporulation warning
    """
    recommendations = []
    alerts = []
    irrigation_action = "MAINTAIN"

    # 1. Irrigation Heuristic
    if rain_probability >= 60.0 or rainfall_mm > 5.0:
        irrigation_action = "DELAY_IRRIGATION"
        recommendations.append("Delay scheduled irrigation: Significant precipitation forecast within the next 24 hours.")
    elif soil_moisture < 35.0 and rain_probability < 30.0:
        irrigation_action = "IRRIGATE_IMMEDIATELY"
        recommendations.append(f"Initiate base drip irrigation: Soil moisture is at {soil_moisture}% with low rain probability.")
    elif soil_moisture < 45.0:
        irrigation_action = "MONITOR_MOISTURE"
        recommendations.append("Soil moisture levels moderate. Plan routine scheduled hydration.")

    # 2. Disease Propagation Risk Index
    fungal_risk = "LOW"
    if humidity >= 75.0 and (18.0 <= temperature <= 32.0):
        fungal_risk = "HIGH"
        alerts.append("Elevated foliar pathogen risk: Extended relative humidity and warm canopy temperatures favor fungal sporulation.")
        if disease and "blight" in disease.lower():
            alerts.append(f"Heightened surveillance required for {disease} due to micro-climate conditions.")
    elif humidity >= 60.0:
        fungal_risk = "MODERATE"

    return {
        "status": "success",
        "temperature_c": temperature,
        "humidity_pct": humidity,
        "rain_probability_pct": rain_probability,
        "soil_moisture_pct": soil_moisture,
        "crop": crop or "Unspecified Crop",
        "disease_context": disease,
        "irrigation_action": irrigation_action,
        "fungal_sporulation_risk": fungal_risk,
        "recommendations": recommendations,
        "alerts": alerts
    }
