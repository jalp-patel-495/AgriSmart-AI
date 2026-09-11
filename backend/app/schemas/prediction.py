from typing import Optional, List
from pydantic import BaseModel


class DiseaseInfo(BaseModel):
    class_id: int
    class_name: str
    crop: str
    disease: str
    status: str
    confidence: float
    pathogen: Optional[str] = None
    symptoms: Optional[str] = None
    treatment: Optional[str] = None


class PredictionResponse(BaseModel):
    success: bool
    message: str
    prediction: DiseaseInfo
    top_predictions: Optional[List[dict]] = []
    processing_time_ms: float
