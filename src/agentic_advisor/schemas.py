"""
Pydantic Schemas for Module G: 🤖 Agentic Advisor
Defines inputs across all 6 AgriSmart AI modules, action items,
farm situation models, and the decision support response.
"""
from typing import List, Optional, Union
from pydantic import BaseModel, Field


class DiseaseDetectionInput(BaseModel):
    crop: Optional[str] = None
    disease: Optional[str] = None
    confidence: Optional[Union[float, str]] = None


class SmartIrrigationInput(BaseModel):
    prediction: Optional[str] = None  # 'YES' | 'NO'
    confidence: Optional[Union[float, str]] = None
    priority: Optional[str] = None  # 'HIGH' | 'MEDIUM' | 'LOW' | 'REVIEW' | 'NONE'


class WeatherIntelligenceInput(BaseModel):
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    rain_probability: Optional[float] = None
    forecast_precipitation: Optional[float] = None
    weather_risk: Optional[str] = None  # 'HIGH' | 'MODERATE' | 'LOW' | 'NORMAL'
    irrigation_recommendation: Optional[str] = None
    disease_monitoring: Optional[str] = None


class CropRecommendationInput(BaseModel):
    recommended_crop: Optional[str] = None
    probability: Optional[Union[float, str]] = None
    top_3: Optional[List[str]] = None


class YieldPredictionInput(BaseModel):
    estimated_yield: Optional[Union[float, str]] = None
    unit: Optional[str] = "tons/ha"


class SustainabilityScoreInput(BaseModel):
    score: Optional[float] = None
    level: Optional[str] = None  # 'High' | 'Moderate' | 'Low'
    water_efficiency: Optional[float] = None
    resource_use: Optional[float] = None
    crop_health: Optional[float] = None


class AgenticAdvisorRequest(BaseModel):
    disease: Optional[DiseaseDetectionInput] = None
    irrigation: Optional[SmartIrrigationInput] = None
    weather: Optional[WeatherIntelligenceInput] = None
    crop_recommendation: Optional[CropRecommendationInput] = None
    yield_prediction: Optional[YieldPredictionInput] = None
    sustainability: Optional[SustainabilityScoreInput] = None


class ActionItem(BaseModel):
    priority: int = Field(..., description="Action priority order (1=highest)")
    action: str = Field(..., description="Actionable recommendation text")
    reason: str = Field(..., description="Explainable rationale")
    source: str = Field(..., description="Contributing AI module(s)")


class SituationStatus(BaseModel):
    crop: str = "Data unavailable"
    disease_status: str = "Data unavailable"
    irrigation_status: str = "Data unavailable"
    weather_risk: str = "Data unavailable"
    sustainability: str = "Data unavailable"


class AgenticAdvisorResponse(BaseModel):
    priority: str = Field(
        ...,
        description="Priority level: 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', or 'DATA INSUFFICIENT'"
    )
    summary: str = Field(..., description="Executive summary of current farm situation")
    situation: SituationStatus
    actions: List[ActionItem] = Field(default_factory=list)
    evidence: List[str] = Field(default_factory=list)
    missing_data: List[str] = Field(default_factory=list)
    safety_note: str = Field(
        default="AI-generated decision support. Verify important agricultural decisions with local conditions or an agricultural expert."
    )
