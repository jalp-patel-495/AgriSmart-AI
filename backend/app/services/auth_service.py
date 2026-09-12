"""
AgriSmart AI – Authentication & Security Service
Implements salt-based PBKDF2 HMAC SHA-256 password hashing and session tokens.
"""
import hashlib
import hmac
import os
import secrets
from typing import Tuple, Optional
from sqlalchemy.orm import Session

from backend.app.db.models import User
from backend.app.schemas.auth import UserSignupRequest, UserLoginRequest, UpdateProfileRequest, ChangePasswordRequest


def generate_salt() -> str:
    """Generates a cryptographically secure random salt."""
    return secrets.token_hex(32)


def hash_password(password: str, salt: str) -> str:
    """Hashes password using PBKDF2 HMAC SHA-256 with 100,000 iterations."""
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return key.hex()


def verify_password(plain_password: str, salt: str, password_hash: str) -> bool:
    """Constant-time comparison of hashed password against stored hash."""
    computed_hash = hash_password(plain_password, salt)
    return hmac.compare_digest(computed_hash, password_hash)


def generate_session_token(user_id: int, email: str) -> str:
    """Generates a secure opaque session token for the user."""
    rand = secrets.token_hex(24)
    raw = f"{user_id}:{email}:{rand}"
    return f"agri_{hashlib.sha256(raw.encode('utf-8')).hexdigest()[:32]}"


def register_user(db: Session, req: UserSignupRequest) -> Tuple[User, str]:
    """Registers a new user in the database and returns the created user & token."""
    existing = db.query(User).filter(User.email == req.email.lower()).first()
    if existing:
        raise ValueError("An account with this email already exists.")

    salt = generate_salt()
    pwd_hash = hash_password(req.password, salt)

    user = User(
        full_name=req.full_name.strip(),
        email=req.email.lower().strip(),
        password_hash=pwd_hash,
        salt=salt,
        farm_name=req.farm_name.strip() if req.farm_name else "Green Valley Farms",
        farm_location=req.farm_location.strip() if req.farm_location else "Punjab, India",
        preferred_crop=req.preferred_crop.strip() if req.preferred_crop else "Wheat",
        role=req.role if req.role in ["farmer", "agronomist", "researcher"] else "farmer",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = generate_session_token(user.id, user.email)
    return user, token


def authenticate_user(db: Session, req: UserLoginRequest) -> Tuple[User, str]:
    """Authenticates an existing user and returns the user & token."""
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user:
        raise ValueError("Invalid email or password.")

    if not verify_password(req.password, user.salt, user.password_hash):
        raise ValueError("Invalid email or password.")

    token = generate_session_token(user.id, user.email)
    return user, token


def get_or_create_demo_user(db: Session, role: str = "farmer") -> Tuple[User, str]:
    """Creates or returns a pre-configured demo user for instant one-click login."""
    if role == "agronomist":
        email = "agronomist@agrismart.ai"
        name = "Dr. Ananya Sharma"
        farm = "Agricultural Extension Center"
        loc = "ICAR North Zone"
        crop = "Multiple Varieties"
    else:
        email = "farmer@agrismart.ai"
        name = "Ramesh Kumar"
        farm = "Kisan Green Acres"
        loc = "Ludhiana, Punjab"
        crop = "Wheat & Tomato"

    user = db.query(User).filter(User.email == email).first()
    if not user:
        salt = generate_salt()
        pwd_hash = hash_password("demo12345", salt)
        user = User(
            full_name=name,
            email=email,
            password_hash=pwd_hash,
            salt=salt,
            farm_name=farm,
            farm_location=loc,
            preferred_crop=crop,
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = generate_session_token(user.id, user.email)
    return user, token


def update_user_profile(db: Session, req: UpdateProfileRequest) -> Tuple[User, str]:
    """Updates user profile details and returns updated user & token."""
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user:
        raise ValueError("User not found.")

    if req.full_name and req.full_name.strip():
        user.full_name = req.full_name.strip()
    if req.farm_name is not None:
        user.farm_name = req.farm_name.strip()
    if req.farm_location is not None:
        user.farm_location = req.farm_location.strip()
    if req.preferred_crop is not None:
        user.preferred_crop = req.preferred_crop.strip()

    db.commit()
    db.refresh(user)

    token = generate_session_token(user.id, user.email)
    return user, token


def change_user_password(db: Session, req: ChangePasswordRequest) -> User:
    """Verifies existing password and updates to the new hashed password."""
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user:
        raise ValueError("User not found.")

    if not verify_password(req.current_password, user.salt, user.password_hash):
        raise ValueError("Current password does not match.")

    if len(req.new_password) < 6:
        raise ValueError("New password must be at least 6 characters long.")

    # Re-hash with fresh salt
    new_salt = generate_salt()
    user.salt = new_salt
    user.password_hash = hash_password(req.new_password, new_salt)

    db.commit()
    db.refresh(user)
    return user
