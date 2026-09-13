"""
Pydantic Schemas for Phase 9: GenAI Farmer Assistant
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., description="'user', 'assistant', or 'system'")
    content: str
    timestamp: Optional[str] = None


class ChatContext(BaseModel):
    crop: Optional[str] = "Tomato"
    disease: Optional[str] = None
    confidence: Optional[str] = None
    pathogen: Optional[str] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    rain_forecast_mm: Optional[float] = None
    irrigation_status: Optional[str] = None
    soil_type: Optional[str] = None
    n_p_k: Optional[str] = None
    weather_risk: Optional[str] = None
    weather_condition: Optional[str] = None
    weather_recommendation: Optional[str] = None


class ChatRequest(BaseModel):
    message: str = Field(..., description="Farmer's natural language question")
    history: Optional[List[ChatMessage]] = Field(default_factory=list)
    context: Optional[ChatContext] = None


class ChatResponse(BaseModel):
    response: str
    suggested_followups: List[str]
    model_used: str
    context_acknowledged: Dict[str, Any]
    created_at: str


class QuickPromptItem(BaseModel):
    prompt: str
    category: str
    icon: str
