"""
Pydantic Schemas for AgriSmart AI Authentication
"""
from typing import Optional
from pydantic import BaseModel, field_validator


class UserBase(BaseModel):
    email: str
    full_name: str
    farm_name: Optional[str] = "My Family Farm"
    farm_location: Optional[str] = "Punjab, India"
    preferred_crop: Optional[str] = "Wheat"
    role: Optional[str] = "farmer"


class UserSignupRequest(BaseModel):
    full_name: str
    email: str
    password: str
    farm_name: Optional[str] = "My Family Farm"
    farm_location: Optional[str] = "Punjab, India"
    preferred_crop: Optional[str] = "Wheat"
    role: Optional[str] = "farmer"

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v:
            raise ValueError("Please provide a valid email address.")
        return v


class UserLoginRequest(BaseModel):
    email: str
    password: str

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v:
            raise ValueError("Please provide a valid email address.")
        return v


class DemoLoginRequest(BaseModel):
    role: Optional[str] = "farmer"  # 'farmer' or 'agronomist'


class UpdateProfileRequest(BaseModel):
    email: str
    full_name: str
    farm_name: Optional[str] = "Family Homestead Farm"
    farm_location: Optional[str] = "Punjab, India"
    preferred_crop: Optional[str] = "Wheat"


class ChangePasswordRequest(BaseModel):
    email: str
    current_password: str
    new_password: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    farm_name: Optional[str]
    farm_location: Optional[str]
    preferred_crop: Optional[str]
    role: str
    token: str
    message: Optional[str] = "Success"
