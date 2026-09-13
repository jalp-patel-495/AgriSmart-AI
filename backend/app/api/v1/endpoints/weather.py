"""
FastAPI Endpoints for Phase 7: Agrometeorological Weather Intelligence
"""
from typing import List, Optional
from fastapi import APIRouter, Query

from backend.app.schemas.weather import (
    WeatherIntelligenceResponse,
    WeatherRecommendationRequest,
    FarmLocationPreset,
    AgriculturalAdvisory,
)
from backend.app.schemas.weather_intelligence import (
    WeatherIntelligenceRequest as ModCWeatherRequest,
    WeatherIntelligenceResponse as ModCWeatherResponse,
)
from backend.app.services.weather_service import (
    get_weather_intelligence,
    generate_agricultural_advisories,
    FARM_PRESETS,
)
from backend.app.services.weather_intelligence_service import (
    evaluate_weather_intelligence,
)

router = APIRouter(prefix="/weather", tags=["Weather Intelligence"])


@router.get("/presets", response_model=List[FarmLocationPreset])
def get_farm_presets():
    """
    Returns curated major agricultural farming regions across India & the Americas.
    """
    return FARM_PRESETS


@router.get("/current", response_model=WeatherIntelligenceResponse)
def get_current_weather(
    lat: float = Query(28.6139, description="Latitude of the field location"),
    lon: float = Query(77.2090, description="Longitude of the field location"),
    location: Optional[str] = Query("Field Station", description="Descriptive farm name"),
    crop: Optional[str] = Query(None, description="Optional target crop e.g. Tomato, Corn"),
    disease: Optional[str] = Query(None, description="Optional diagnosed disease")
):
    """
    Returns live weather telemetry, disease propagation risk indices,
    7-day forecast, and agricultural advisories.
    """
    try:
        return get_weather_intelligence(
            lat=lat,
            lon=lon,
            location_name=location,
            crop=crop,
            disease=disease
        )
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Weather data unavailable. Upstream weather service offline.")


@router.post("/recommendations", response_model=List[AgriculturalAdvisory])
def get_custom_recommendations(payload: WeatherRecommendationRequest):
    """
    Generates targeted farming recommendations correlating real-time weather
    at the field coordinates with a specific crop and diagnosed disease.
    """
    weather_intel = get_weather_intelligence(
        lat=payload.latitude,
        lon=payload.longitude,
        crop=payload.crop,
        disease=payload.disease
    )
    return weather_intel.advisories


@router.post("/weather-intelligence", response_model=ModCWeatherResponse)
def get_weather_intelligence_alias(req: ModCWeatherRequest):
    """
    Direct alias for Bonus Module C weather-intelligence endpoint.
    """
    return evaluate_weather_intelligence(req)


