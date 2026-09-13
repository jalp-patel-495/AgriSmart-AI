from fastapi import APIRouter
from backend.app.api.v1.endpoints import (
    health,
    predict,
    weather,
    weather_intelligence,
    smart_farming,
    assistant,
    auth,
    sustainability,
    agentic_advisor,
    expert,
    admin,
)

api_router = APIRouter()
api_router.include_router(health.router, prefix="", tags=["Health Check"])
api_router.include_router(auth.router, prefix="", tags=["Authentication"])
api_router.include_router(predict.router, prefix="", tags=["Prediction"])
api_router.include_router(weather.router, prefix="", tags=["Weather Intelligence"])
api_router.include_router(weather_intelligence.router, prefix="", tags=["Weather Intelligence"])
api_router.include_router(smart_farming.router, prefix="", tags=["Smart Farming & Irrigation"])
api_router.include_router(assistant.router, prefix="", tags=["GenAI Farmer Assistant"])
api_router.include_router(sustainability.router, prefix="", tags=["Sustainability Score"])
api_router.include_router(agentic_advisor.router, prefix="", tags=["Agentic Advisor"])
api_router.include_router(expert.router, prefix="", tags=["Agricultural Expert Review"])
api_router.include_router(admin.router, prefix="", tags=["System Administration"])





