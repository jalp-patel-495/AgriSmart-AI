"""
AgriSmart AI – Pydantic Schemas for AI Disease Prediction API
"""

from typing import Optional, List, Dict
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
    treatment: str = Field(..., description="Curative organic and chemical agronomic recommendations")
    top_predictions: List[TopPredictionItem] = Field(default_factory=list, description="Top 3 ranked disease predictions")
    processing_time_ms: float = Field(..., description="Inference latency in milliseconds")
