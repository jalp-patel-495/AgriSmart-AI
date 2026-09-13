"""
AgriSmart AI – RBAC Authorization Dependencies
Provides reusable dependencies for token authentication and role-based access control.
"""
from typing import List, Optional
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import User
from backend.app.schemas.auth import (
    normalize_role,
    ROLE_FARMER,
    ROLE_AGRICULTURAL_EXPERT,
    ROLE_ADMIN,
)
from backend.app.services.auth_service import verify_session_token_and_get_user


def extract_token_from_request(request: Request) -> Optional[str]:
    """
    Extracts the session token from Authorization header or X-Auth-Token header.
    Supports 'Bearer <token>' and raw token formats.
    """
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth_header:
        parts = auth_header.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1]
        elif len(parts) == 1:
            return parts[0]

    custom_header = request.headers.get("X-Auth-Token") or request.headers.get("x-auth-token")
    if custom_header:
        return custom_header.strip()

    return None


def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> User:
    """
    Extracts and cryptographically validates the session token.
    Returns the authenticated active user or raises HTTP 401 Unauthorized.
    """
    token = extract_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = verify_session_token_and_get_user(token, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, tampered, or expired authentication token. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if hasattr(user, "is_active") and not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account has been deactivated. Please contact an administrator.",
        )

    return user


def require_role(*allowed_roles: str):
    """
    Role-Based Access Control dependency factory.
    Enforces that the authenticated user possesses at least one of the specified allowed roles.
    Returns HTTP 401 if unauthenticated, and HTTP 403 Forbidden if role is insufficient.
    """
    normalized_allowed = [normalize_role(r) for r in allowed_roles]

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = normalize_role(current_user.role)
        if user_role not in normalized_allowed:
            allowed_display = ", ".join(normalized_allowed)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: This action requires role ({allowed_display}). Your current role is '{user_role}'.",
            )
        return current_user

    return role_checker
