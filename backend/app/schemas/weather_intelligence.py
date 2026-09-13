"""
AgriSmart AI – Pydantic Schemas for Weather-Based Intelligence (Bonus Module C)
"""
from typing import List, Optional
from pydantic import BaseModel, Field
from backend.app.schemas.weather import DailyForecastItem


class WeatherTelemetry(BaseModel):
    temperature: float = Field(..., description="Current temperature in Celsius")
    humidity: int = Field(..., description="Current relative humidity percentage (0-100)")
    rain_probability: int = Field(..., description="Forecast rain probability percentage (0-100)")
    forecast_precipitation: float = Field(..., description="Expected forecast precipitation in mm for the next 24-48 hours")
    weather_condition: Optional[str] = Field(None, description="Decoded weather description (e.g., Slight Rain, Clear Sky)")
    weather_code: Optional[int] = Field(None, description="WMO weather code from Open-Meteo")
    wind_speed_kmh: Optional[float] = Field(None, description="Wind speed at 10m in km/h")
    weather_icon: Optional[str] = Field(None, description="Weather emoji icon representing current condition")


class WeatherIntelligenceRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude of the farm location (-90 to 90)")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude of the farm location (-180 to 180)")
    crop: Optional[str] = Field(None, description="Target crop (e.g., Tomato, Corn, Grape, Bell Pepper, Peach)")
    soil_moisture: Optional[float] = Field(None, ge=0.0, le=100.0, description="Current soil moisture percentage (0-100)")
    temperature: Optional[float] = Field(None, description="Optional local ambient temperature in °C; defaults to live Open-Meteo temperature if omitted")
    humidity: Optional[float] = Field(None, ge=0.0, le=100.0, description="Optional local relative humidity percentage; defaults to live Open-Meteo humidity if omitted")
    disease: Optional[str] = Field(None, description="Optional diagnosed disease class name (e.g. Tomato_Early_Blight, Grape_Black_Rot)")
    disease_confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Optional disease confidence score (0.0 to 1.0)")


class WeatherIntelligenceResponse(BaseModel):
    status: str = Field(..., description="'success' or 'weather_unavailable'")
    weather: Optional[WeatherTelemetry] = Field(None, description="Live/forecast agrometeorological telemetry")
    irrigation_prediction: Optional[str] = Field(None, description="'YES', 'NO', or None if soil moisture not provided")
    weather_risk: Optional[str] = Field(None, description="Deterministic risk level: 'LOW', 'MEDIUM', or 'HIGH'")
    recommendation: str = Field(..., description="Primary actionable agrometeorological recommendation")
    reasoning: List[str] = Field(default_factory=list, description="Transparent deterministic justifications")
    disease_monitoring: Optional[str] = Field(None, description="Foliar pathogen risk or monitoring warning if applicable")
    daily_forecast: Optional[List[DailyForecastItem]] = Field(default_factory=list, description="Multi-day agrometeorological forecast items from Open-Meteo")

