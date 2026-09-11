from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import settings
from backend.app.api.v1.router import api_router
from backend.app.api.v1.endpoints.predict import load_prediction_model, load_classes_metadata


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan event: loads model and disease classes during server startup
    into memory for ultra-fast response times.
    """
    print("=" * 65)
    print("[*] Starting AgriSmart AI Backend Prediction Service...")
    print("=" * 65)
    load_classes_metadata()
    load_prediction_model()
    print("[*] Model cached in memory. Ready for farmer requests!")
    print("=" * 65)
    yield
    print("[*] AgriSmart AI Backend Service shutting down.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AgriSmart AI - AI Inference & Disease Prediction API for Crop Protection",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "service": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "predict_api": f"{settings.API_V1_STR}/predict",
        "health_check": f"{settings.API_V1_STR}/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
