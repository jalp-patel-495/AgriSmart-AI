import os
from typing import List
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()


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
    SECRET_KEY: str = os.getenv("SECRET_KEY", "agrismart_ai_super_secret_rbac_key_2026")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")


settings = Settings()
