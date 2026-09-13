"""
FastAPI Endpoint for Bonus Module D: Sustainability Score
"""
from fastapi import APIRouter
from backend.app.schemas.sustainability import (
    SustainabilityScoreRequest,
    SustainabilityScoreResponse,
)
from backend.app.services.sustainability_service import compute_sustainability_score

router = APIRouter(tags=["Sustainability Score"])


@router.post("/sustainability-score", response_model=SustainabilityScoreResponse)
def get_sustainability_score(req: SustainabilityScoreRequest):
    """
    Computes explainable, deterministic Sustainability Score (0-100) from:
    - Water Efficiency (40 points)
    - Resource Use (30 points)
    - Crop Health (30 points)
    Supports partial data with transparent component normalization and actionable suggestions.
    """
    return compute_sustainability_score(req)
