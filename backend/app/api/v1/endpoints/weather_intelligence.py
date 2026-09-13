"""
AgriSmart AI – FastAPI Endpoint for Weather-Based Intelligence (Bonus Module C)
"""
from fastapi import APIRouter, HTTPException
from backend.app.schemas.weather_intelligence import (
    WeatherIntelligenceRequest,
    WeatherIntelligenceResponse,
)
from backend.app.services.weather_intelligence_service import (
    evaluate_weather_intelligence,
)

router = APIRouter(tags=["Weather Intelligence"])


@router.post(
    "/weather-intelligence",
    response_model=WeatherIntelligenceResponse,
    summary="Generate Weather-Based Agrometeorological Intelligence",
    description=(
        "Combines real-time/forecast agrometeorological data from Open-Meteo API "
        "with farm conditions (soil moisture, target crop, diagnosed disease) to generate "
        "transparent, actionable farming and irrigation advisories."
    ),
)
def get_weather_intelligence_advisory(req: WeatherIntelligenceRequest) -> WeatherIntelligenceResponse:
    """
    Evaluates live Open-Meteo telemetry against irrigation and disease models.
    """
    return evaluate_weather_intelligence(req)
