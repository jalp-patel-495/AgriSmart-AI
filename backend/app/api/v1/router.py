from fastapi import APIRouter
from backend.app.api.v1.endpoints import health, predict

api_router = APIRouter()
api_router.include_router(health.router, prefix="", tags=["Health Check"])
api_router.include_router(predict.router, prefix="", tags=["Prediction"])
