"""
AgriSmart AI – Pydantic Schemas for AI Disease Prediction API
"""

from typing import Optional, List, Dict, Union, Any
from pydantic import BaseModel, Field


class TopPredictionItem(BaseModel):
    class_id: int
    disease: str
    crop: str
    confidence: str
    confidence_score: float


class PredictionResponse(BaseModel):
    success: bool
    message: str
    disease: str = Field(..., description="Name of detected crop disease condition (e.g. Tomato Early Blight)")
    crop: str = Field(..., description="Crop staple name (e.g. Tomato, Corn, Potato, Apple)")
    confidence: str = Field(..., description="Formatted confidence percentage string (e.g. 92%)")
    confidence_score: float = Field(..., description="Raw probability float in [0.0, 1.0]")
    status: str = Field(..., description="Healthy or Diseased")
    pathogen: Optional[str] = Field(None, description="Identified causal pathogen and organism type")
    symptoms: str = Field(..., description="Observable field symptoms (e.g. Brown spots on leaves)")
    precautions: List[str] = Field(..., description="Step-by-step preventative precautions for farmers")
    treatment: Optional[str] = Field(None, description="Curative organic and chemical agronomic recommendations")
    top_predictions: List[TopPredictionItem] = Field(default_factory=list, description="Top 3 ranked disease predictions")
    processing_time_ms: float = Field(..., description="Inference latency in milliseconds")


class DiseaseAdvisoryOutput(BaseModel):
    crop: str = Field(..., description="Detected crop staple or 'Data unavailable'")
    name: str = Field(..., description="Detected disease condition or 'Data unavailable'")
    confidence: float = Field(..., description="Model confidence score [0.0, 1.0]")


class CropRecommendationAdvisoryOutput(BaseModel):
    recommended_crop: str = Field(..., description="Recommended crop or 'Data unavailable'")
    confidence: float = Field(..., description="Model confidence score [0.0, 1.0]")


class IrrigationAdvisoryOutput(BaseModel):
    required: bool = Field(..., description="Whether irrigation is required")
    prediction: str = Field(..., description="'YES', 'NO', or 'Data unavailable'")
    confidence: float = Field(..., description="Model confidence score [0.0, 1.0]")
    priority: str = Field(..., description="'HIGH', 'MEDIUM', 'NONE', or 'Data unavailable'")


class YieldAdvisoryOutput(BaseModel):
    estimated: Union[float, str] = Field(..., description="Estimated yield quantity or 'Data unavailable'")
    unit: str = Field("Tonnes/Ha", description="Yield unit (Tonnes/Ha or Nuts/Ha)")


class FarmerAdvisorAdvisoryOutput(BaseModel):
    farm_status: str = Field(..., description="Overall farm health evaluation")
    overall_priority: str = Field(..., description="Aggregated priority level (LOW, MEDIUM, HIGH, CRITICAL)")
    recommendations: List[str] = Field(default_factory=list, description="Actionable agronomic advice")
    warnings: List[str] = Field(default_factory=list, description="Compound stress and field alerts")


class ComprehensiveAdvisoryResponse(BaseModel):
    status: str = Field("success", description="Overall execution status")
    disease: DiseaseAdvisoryOutput
    crop_recommendation: CropRecommendationAdvisoryOutput
    irrigation: IrrigationAdvisoryOutput
    yield_data: YieldAdvisoryOutput = Field(..., alias="yield")
    farmer_advisor: FarmerAdvisorAdvisoryOutput

    model_config = {
        "populate_by_name": True
    }


class ComprehensiveAdvisoryRequest(BaseModel):
    crop: Optional[str] = None
    soil_moisture: Optional[float] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    rainfall: Optional[float] = None
    n: Optional[float] = None
    p: Optional[float] = None
    k: Optional[float] = None
    ph: Optional[float] = None
    area: Optional[float] = None
    season: Optional[str] = None
    state: Optional[str] = None
    fertilizer: Optional[float] = None
    pesticide: Optional[float] = None

