import os
from typing import List
from pydantic import BaseModel


class Settings(BaseModel):
    PROJECT_NAME: str = "AgriSmart AI Backend"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*"
    ]
    CLASSES_PATH: str = os.getenv("CLASSES_PATH", "dataset/classes.json")
    MODEL_PATH: str = os.getenv("MODEL_PATH", "ai_model/models/crop_disease_model.pth")


settings = Settings()
