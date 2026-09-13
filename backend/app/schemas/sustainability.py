"""
Pydantic schemas for Bonus Module D: Sustainability Score
"""
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field


class SustainabilityScoreRequest(BaseModel):
    """
    Optional input parameters for computing the indicative Sustainability Score.
    Uses real farm conditions and AI module outputs when available.
    """
    crop: Optional[str] = Field(None, description="Crop name (e.g. 'Tomato', 'Wheat', 'Rice')")
    soil_moisture: Optional[float] = Field(None, description="Root zone soil moisture percentage (0-100)")
    temperature: Optional[float] = Field(None, description="Ambient temperature (°C)")
    humidity: Optional[float] = Field(None, description="Relative humidity percentage (0-100)")
    nitrogen: Optional[float] = Field(None, description="Available Nitrogen (kg/ha)")
    phosphorus: Optional[float] = Field(None, description="Available Phosphorus (kg/ha)")
    potassium: Optional[float] = Field(None, description="Available Potassium (kg/ha)")
    rainfall: Optional[float] = Field(None, description="Recorded or annual rainfall (mm)")
    irrigation_prediction: Optional[Union[str, bool]] = Field(
        None, description="Irrigation model prediction ('YES', 'NO', 'REQUIRED', 'NOT REQUIRED')"
    )
    irrigation_priority: Optional[str] = Field(None, description="Irrigation priority ('HIGH', 'NONE')")
    disease: Optional[str] = Field(None, description="Disease detection result ('Healthy', disease class name)")
    disease_confidence: Optional[float] = Field(None, description="Confidence of disease diagnosis (0.0 - 1.0)")
    rain_probability: Optional[float] = Field(None, description="Weather forecast rain probability (0 - 100)")
    forecast_precipitation: Optional[float] = Field(None, description="Forecast precipitation in mm")
    weather_risk: Optional[str] = Field(None, description="Weather risk category ('LOW', 'MODERATE', 'HIGH')")


class ComponentDetail(BaseModel):
    score: Optional[int] = Field(None, description="Earned points for this component")
    max_points: int = Field(..., description="Maximum possible points for this component")
    status: str = Field(..., description="'available' or 'unavailable'")
    description: str = Field(..., description="Explainable description of the component evaluation")


class SustainabilityScoreResponse(BaseModel):
    status: str = Field("success", description="Status of computation")
    sustainability_score: Optional[int] = Field(None, description="Indicative sustainability score (0-100)")
    level: str = Field(..., description="Level: 'Needs Improvement', 'Moderate', 'Good', 'Excellent', or 'Data Unavailable'")
    components: Dict[str, Optional[int]] = Field(..., description="Component scores (water_efficiency, resource_use, crop_health)")
    component_details: Dict[str, ComponentDetail] = Field(..., description="Detailed breakdown with status and explanation")
    available_data: bool = Field(..., description="True if at least one component has data available")
    is_normalized: bool = Field(False, description="True if score was normalized due to missing components")
    data_note: Optional[str] = Field(None, description="Note explaining data availability or normalization")
    suggestions: List[str] = Field(default_factory=list, description="Actionable improvement suggestions based strictly on weak components")
    disclaimer: str = Field(
        "Rule-based sustainability assessment based on available project data. Not a certified environmental assessment.",
        description="Regulatory and transparency disclaimer"
    )
