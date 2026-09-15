import os
import time
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, status
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import User
from backend.app.api.deps import get_current_user, extract_token_from_request
from backend.app.schemas.auth import (
    UserSignupRequest,
    UserLoginRequest,
    DemoLoginRequest,
    UpdateProfileRequest,
    ChangePasswordRequest,
    UserResponse,
)
from backend.app.services.auth_service import (
    register_user,
    authenticate_user,
    get_or_create_demo_user,
    update_user_profile,
    change_user_password,
    generate_session_token,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

AVATAR_UPLOAD_DIR = Path("backend/uploads/avatars")
AVATAR_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def build_user_response(user: User, token: str, message: str) -> UserResponse:
    created_at_str = user.created_at.strftime("%Y-%m-%d %H:%M UTC") if hasattr(user, "created_at") and user.created_at else None
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone_number=getattr(user, "phone_number", None),
        profile_image=getattr(user, "profile_image", None),
        farm_name=user.farm_name,
        farm_location=user.farm_location,
        preferred_crop=user.preferred_crop,
        role=user.role,
        token=token,
        is_active=bool(user.is_active) if hasattr(user, "is_active") and user.is_active is not None else True,
        organization_name=getattr(user, "organization_name", None),
        organization_type=getattr(user, "organization_type", None),
        operating_regions=getattr(user, "operating_regions", None),
        primary_crops=getattr(user, "primary_crops", None),
        stakeholder_type=getattr(user, "stakeholder_type", None),
        created_at=created_at_str,
        message=message,
    )


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(req: UserSignupRequest, db: Session = Depends(get_db)):
    """Registers a new farmer, stakeholder, or agronomist account."""
    if len(req.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )
    try:
        user, token = register_user(db, req)
        return build_user_response(user, token, "Account created successfully! Welcome to AgriSmart AI.")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Registration failed: {e}")


@router.post("/login", response_model=UserResponse)
def login(req: UserLoginRequest, db: Session = Depends(get_db)):
    """Authenticates an existing user and returns a session token."""
    try:
        user, token = authenticate_user(db, req)
        return build_user_response(user, token, "Logged in successfully.")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Login failed: {e}")


@router.post("/demo-login", response_model=UserResponse)
def demo_login(req: DemoLoginRequest = None, db: Session = Depends(get_db)):
    """One-click instant login for demonstrations and review."""
    role = req.role if req and req.role else "farmer"
    user, token = get_or_create_demo_user(db, role=role)
    display_role = role.replace("_", " ").title()
    return build_user_response(user, token, f"Logged in as Demo {display_role}.")


@router.get("/me", response_model=UserResponse)
def get_me(request: Request, current_user: User = Depends(get_current_user)):
    """Returns the authenticated user's profile and session data."""
    token = extract_token_from_request(request) or generate_session_token(current_user.id, current_user.email)
    return build_user_response(current_user, token, "Profile fetched successfully.")


@router.put("/profile", response_model=UserResponse)
def update_profile(req: UpdateProfileRequest, db: Session = Depends(get_db)):
    """Updates the user's name, phone, farm name, location, preferred crop, or organization fields."""
    try:
        user, token = update_user_profile(db, req)
        return build_user_response(user, token, "Profile updated successfully.")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update profile: {e}")


@router.post("/profile-photo", response_model=UserResponse)
async def upload_profile_photo(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Uploads and validates a user profile photo (max 2MB, JPG/PNG/WebP).
    Stores file locally and updates user's profile_image URL.
    """
    valid_mime_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if file.content_type and file.content_type.lower() not in valid_mime_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Allowed formats: JPG, PNG, WebP."
        )

    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum allowed limit of 2MB."
        )

    # Determine extension
    ext = ".jpg"
    if file.filename and "." in file.filename:
        ext = "." + file.filename.rsplit(".", 1)[1].lower()
        if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
            ext = ".jpg"

    filename = f"user_{current_user.id}_{int(time.time())}{ext}"
    target_path = AVATAR_UPLOAD_DIR / filename
    with open(target_path, "wb") as f:
        f.write(content)

    # Relative URL accessible via static mount
    image_url = f"/uploads/avatars/{filename}"
    current_user.profile_image = image_url
    db.commit()
    db.refresh(current_user)

    token = extract_token_from_request(request) or generate_session_token(current_user.id, current_user.email)
    return build_user_response(current_user, token, "Profile photo uploaded successfully.")


@router.post("/change-password")
def change_password(req: ChangePasswordRequest, db: Session = Depends(get_db)):
    """Verifies existing password and updates to a new password."""
    try:
        change_user_password(db, req)
        return {
            "status": "success",
            "message": "Password changed successfully. Please keep your credentials secure."
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to change password: {e}")


