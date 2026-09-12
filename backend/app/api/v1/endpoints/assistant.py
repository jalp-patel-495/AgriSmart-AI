"""
FastAPI Endpoints for Phase 9: GenAI Farmer Assistant
"""
from typing import List, Optional
from fastapi import APIRouter, Query

from backend.app.schemas.assistant import (
    ChatRequest,
    ChatResponse,
    ChatContext,
    QuickPromptItem,
)
from backend.app.services.assistant_service import (
    get_assistant_response,
    get_contextual_quick_prompts,
)

router = APIRouter(prefix="/assistant", tags=["GenAI Farmer Assistant"])


@router.post("/chat", response_model=ChatResponse)
def handle_assistant_chat(req: ChatRequest):
    """
    Conversational GenAI endpoint. Injects live farm context (crop, visual disease prediction,
    weather telemetry, smart irrigation deficit) to provide expert agronomic responses.
    """
    return get_assistant_response(req)


@router.get("/quick-prompts", response_model=List[QuickPromptItem])
def get_quick_prompts(
    crop: Optional[str] = Query("Tomato", description="Active crop type"),
    disease: Optional[str] = Query("Early Blight", description="Diagnosed disease")
):
    """
    Returns contextual starter questions tailored to the farmer's active disease and crop.
    """
    ctx = ChatContext(crop=crop, disease=disease)
    return get_contextual_quick_prompts(ctx)
