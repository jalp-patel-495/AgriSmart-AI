"""
FastAPI Endpoint for Module G: 🤖 Agentic Advisor
Combines outputs of existing AgriSmart AI modules to determine
priority, current situation, explainable recommended actions,
evidence, and missing data without training new models.
"""
from fastapi import APIRouter
from src.agentic_advisor.schemas import (
    AgenticAdvisorRequest,
    AgenticAdvisorResponse,
)
from src.agentic_advisor.agent import agentic_advisor_engine

router = APIRouter(tags=["Agentic Advisor"])


@router.post("/agentic-advisor", response_model=AgenticAdvisorResponse)
def get_agentic_advisor_evaluation(req: AgenticAdvisorRequest):
    """
    Evaluates multi-module telemetry using deterministic rules:
    - Disease Detection (crop, disease, confidence)
    - Smart Irrigation (prediction, confidence, priority)
    - Weather Intelligence (temp, humidity, rain_probability, risk)
    - Crop Recommendation (recommended crop, confidence, top-3)
    - Yield Prediction (estimated yield)
    - Sustainability Score (score, level, components)
    Returns:
    - Priority ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'DATA INSUFFICIENT')
    - Farm situation status
    - 1 to 4 actionable, explainable recommendations with sources & reasons
    - Evidence checklist & missing data declarations
    - Safety disclaimer
    """
    return agentic_advisor_engine.evaluate(req)
