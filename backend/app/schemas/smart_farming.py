"""
Pydantic Schemas for Phase 8: Smart Irrigation and Crop Recommendation
"""
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


# --- Smart Irrigation Schemas ---

class IrrigationRequest(BaseModel):
    crop: str = Field(..., description="Target crop: 'Tomato', 'Potato', 'Corn', 'Apple', 'Rice', 'Wheat', etc.")
    soil_type: str = Field("Clay Loam", description="Soil type: 'Clay Loam', 'Sandy Loam', 'Silt Loam', 'Black Cotton Soil'")
    field_size_hectares: float = Field(1.0, ge=0.1, le=100.0)
    moisture_15cm: float = Field(..., ge=0.0, le=100.0, description="Soil moisture percentage at 15cm root zone")
    moisture_30cm: float = Field(..., ge=0.0, le=100.0, description="Soil moisture percentage at 30cm root zone")
    ambient_temp: float = Field(26.0, description="Current ambient temperature (°C)")
    humidity: float = Field(65.0, description="Relative humidity (%)")
    rain_forecast_mm: float = Field(0.0, description="Rainfall expected in next 24-48h (mm)")
    irrigation_system: str = Field("Drip Irrigation", description="'Drip Irrigation', 'Sprinkler', or 'Flood/Furrow'")


class IrrigationAdvisoryResponse(BaseModel):
    crop: str
    soil_type: str
    status: str = Field(..., description="'Immediate', 'Scheduled', 'Adequate', or 'Waterlogged'")
    status_color: str
    headline: str
    action_required: str
    water_amount_litres_per_ha: float
    total_water_litres: float
    drip_duration_minutes: int
    crop_et_mm_day: float
    soil_water_deficit_pct: float
    management_allowed_depletion_pct: float
    weather_adjustment_note: str
    created_at: str


# --- Simulated IoT Telemetry Schemas ---

class IoTSensorReadingResponse(BaseModel):
    device_id: str
    timestamp: str
    soil_moisture_15cm: float
    soil_moisture_30cm: float
    soil_temp: float
    electrical_conductivity: float
    battery_level: float
    moisture_status: str


class IoTHistoryItem(BaseModel):
    time_label: str
    moisture_15cm: float
    moisture_30cm: float
    soil_temp: float


class IoTTelemetryFeed(BaseModel):
    current: IoTSensorReadingResponse
    history: List[IoTHistoryItem]
    active_scenario: str


# --- Crop Recommendation Schemas ---

class CropRecommendationRequest(BaseModel):
    nitrogen: float = Field(..., ge=0, le=300, description="Soil Nitrogen (N) in kg/ha")
    phosphorus: float = Field(..., ge=0, le=300, description="Soil Phosphorus (P) in kg/ha")
    potassium: float = Field(..., ge=0, le=300, description="Soil Potassium (K) in kg/ha")
    ph: float = Field(..., ge=3.5, le=10.0, description="Soil pH level (3.5 to 10)")
    temperature: float = Field(..., ge=5.0, le=50.0, description="Average temperature in °C")
    humidity: float = Field(..., ge=10.0, le=100.0, description="Relative humidity in %")
    rainfall: float = Field(..., ge=10.0, le=1500.0, description="Annual/seasonal rainfall in mm")


class RecommendedCropItem(BaseModel):
    crop: str
    confidence_score: float
    match_percentage: str
    water_requirement: str
    growth_duration: str
    growing_season: str
    soil_suitability: str
    economic_potential: str
    agronomic_advice: str


class CropRecommendationResponse(BaseModel):
    top_recommendations: List[RecommendedCropItem]
    soil_summary: str
    created_at: str


class SoilPreset(BaseModel):
    name: str
    region: str
    description: str
    typical_crops: List[str]
    default_n: float
    default_p: float
    default_k: float
    default_ph: float
    default_temp: float
    default_humidity: float
    default_rainfall: float
