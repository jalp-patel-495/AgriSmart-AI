"""
Pydantic Schemas for Phase 7: Weather Intelligence and Agrometeorological Advisory
"""
from typing import List, Optional
from pydantic import BaseModel, Field


class WeatherCurrent(BaseModel):
    time: str
    temperature_c: float
    relative_humidity_pct: int
    precipitation_mm: float
    rain_mm: float
    weather_code: int
    weather_condition: str
    weather_icon: str
    wind_speed_kmh: float
    is_day: int = 1


class DailyForecastItem(BaseModel):
    date: str
    temperature_max_c: float
    temperature_min_c: float
    precipitation_sum_mm: float
    precipitation_probability_pct: int
    weather_code: int
    weather_condition: str
    weather_icon: str
    disease_risk_level: str
    disease_risk_score: int


class WeatherRiskAssessment(BaseModel):
    overall_risk_level: str = Field(..., description="'Low', 'Moderate', 'High', or 'Severe'")
    overall_risk_score: int = Field(..., description="0-100 risk score")
    summary: str
    contributing_factors: List[str]
    vulnerable_pathogen_types: List[str]
    blight_risk: str
    bacterial_risk: str
    rust_risk: str


class AgriculturalAdvisory(BaseModel):
    category: str = Field(..., description="'Irrigation', 'Spraying', 'Scouting', or 'General'")
    title: str
    action: str
    urgency: str = Field(..., description="'Safe', 'Advisory', 'Warning', or 'Critical'")
    icon: str


class WeatherRecommendationRequest(BaseModel):
    crop: Optional[str] = "Tomato"
    disease: Optional[str] = None
    latitude: float = 28.6139
    longitude: float = 77.2090


class FarmLocationPreset(BaseModel):
    name: str
    region: str
    country: str
    latitude: float
    longitude: float
    primary_crops: List[str]


class WeatherIntelligenceResponse(BaseModel):
    location: str
    latitude: float
    longitude: float
    current: WeatherCurrent
    risk_assessment: WeatherRiskAssessment
    advisories: List[AgriculturalAdvisory]
    daily_forecast: List[DailyForecastItem]
