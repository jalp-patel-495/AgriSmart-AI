"""
AgriSmart AI – Authentication API Endpoints
Provides Signup, Login, Demo-Login, and Profile endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.schemas.auth import (
    UserSignupRequest,
    UserLoginRequest,
    DemoLoginRequest,
    UserResponse,
)
from backend.app.services.auth_service import (
    register_user,
    authenticate_user,
    get_or_create_demo_user,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(req: UserSignupRequest, db: Session = Depends(get_db)):
    """Registers a new farmer or agronomist account."""
    if len(req.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )
    try:
        user, token = register_user(db, req)
        return UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            farm_name=user.farm_name,
            farm_location=user.farm_location,
            preferred_crop=user.preferred_crop,
            role=user.role,
            token=token,
            message="Account created successfully! Welcome to AgriSmart AI."
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Registration failed: {e}")


@router.post("/login", response_model=UserResponse)
def login(req: UserLoginRequest, db: Session = Depends(get_db)):
    """Authenticates an existing user and returns a session token."""
    try:
        user, token = authenticate_user(db, req)
        return UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            farm_name=user.farm_name,
            farm_location=user.farm_location,
            preferred_crop=user.preferred_crop,
            role=user.role,
            token=token,
            message="Logged in successfully."
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Login failed: {e}")


@router.post("/demo-login", response_model=UserResponse)
def demo_login(req: DemoLoginRequest = None, db: Session = Depends(get_db)):
    """One-click instant login for demonstrations and review."""
    role = req.role if req and req.role else "farmer"
    user, token = get_or_create_demo_user(db, role=role)
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        farm_name=user.farm_name,
        farm_location=user.farm_location,
        preferred_crop=user.preferred_crop,
        role=user.role,
        token=token,
        message=f"Logged in as Demo {role.capitalize()}."
    )
