from fastapi import APIRouter
from backend.app.api.v1.endpoints import health, predict, weather, smart_farming

api_router = APIRouter()
api_router.include_router(health.router, prefix="", tags=["Health Check"])
api_router.include_router(predict.router, prefix="", tags=["Prediction"])
api_router.include_router(weather.router, prefix="", tags=["Weather Intelligence"])
api_router.include_router(smart_farming.router, prefix="", tags=["Smart Farming & Irrigation"])


