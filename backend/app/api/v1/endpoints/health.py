from datetime import datetime, timezone
from fastapi import APIRouter
import platform
import sys

router = APIRouter()


@router.get("/health", tags=["Health Check"])
def health_check():
    """Health check endpoint to verify backend operational readiness."""
    return {
        "status": "healthy",
        "service": "AgriSmart AI API",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "python_version": sys.version.split()[0],
        "platform": platform.platform()
    }
