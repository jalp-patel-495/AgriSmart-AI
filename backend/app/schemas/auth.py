"""
Pydantic Schemas for AgriSmart AI Authentication and RBAC
"""
from typing import Optional, List
from enum import Enum
from pydantic import BaseModel, field_validator


class UserRole(str, Enum):
    FARMER = "FARMER"
    AGRICULTURAL_STAKEHOLDER = "AGRICULTURAL_STAKEHOLDER"
    AGRICULTURAL_EXPERT = "AGRICULTURAL_EXPERT"
    ADMIN = "ADMIN"


ROLE_FARMER = "FARMER"
ROLE_AGRICULTURAL_STAKEHOLDER = "AGRICULTURAL_STAKEHOLDER"
ROLE_AGRICULTURAL_EXPERT = "AGRICULTURAL_EXPERT"
ROLE_ADMIN = "ADMIN"
ALLOWED_ROLES = [
    ROLE_FARMER,
    ROLE_AGRICULTURAL_STAKEHOLDER,
    ROLE_AGRICULTURAL_EXPERT,
    ROLE_ADMIN,
]


def normalize_role(role: Optional[str]) -> str:
    """Safely normalizes input role string to one of the canonical 4 roles."""
    if role is None or not isinstance(role, str) or not role.strip():
        return ROLE_FARMER
    cleaned = role.strip().upper()
    if cleaned in ("FARMER", "KISAN"):
        return ROLE_FARMER
    if cleaned in ("AGRICULTURAL_EXPERT", "EXPERT", "AGRONOMIST", "RESEARCHER"):
        return ROLE_AGRICULTURAL_EXPERT
    if cleaned in (
        "AGRICULTURAL_STAKEHOLDER",
        "STAKEHOLDER",
        "AGRIBUSINESS",
        "AGRI_STAKEHOLDER",
        "BUYER",
        "FPO",
        "EXPORTER",
        "PROCESSOR",
        "INSURER",
        "BANKER",
        "INPUT_SUPPLIER",
        "GOVT_AGENCY",
        "GOVERNMENT",
        "RESEARCH_INSTITUTION",
    ):
        return ROLE_AGRICULTURAL_STAKEHOLDER
    if cleaned in ("ADMIN", "ADMINISTRATOR"):
        return ROLE_ADMIN
    raise ValueError(f"Invalid role '{role}'. Allowed roles: {', '.join(ALLOWED_ROLES)}")


class UserBase(BaseModel):
    email: str
    full_name: str
    farm_name: Optional[str] = "My Family Farm"
    farm_location: Optional[str] = "Punjab, India"
    preferred_crop: Optional[str] = "Wheat"
    role: Optional[str] = ROLE_FARMER
    organization_name: Optional[str] = None
    organization_type: Optional[str] = None
    operating_regions: Optional[str] = None
    primary_crops: Optional[str] = None
    stakeholder_type: Optional[str] = None


class UserSignupRequest(BaseModel):
    full_name: str
    email: str
    password: str
    farm_name: Optional[str] = "My Family Farm"
    farm_location: Optional[str] = "Punjab, India"
    preferred_crop: Optional[str] = "Wheat"
    role: Optional[str] = ROLE_FARMER
    organization_name: Optional[str] = None
    organization_type: Optional[str] = None
    operating_regions: Optional[str] = None
    primary_crops: Optional[str] = None
    stakeholder_type: Optional[str] = None

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v:
            raise ValueError("Please provide a valid email address.")
        return v

    @field_validator('role')
    @classmethod
    def validate_role(cls, v: Optional[str]) -> str:
        return normalize_role(v)


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
    role: Optional[str] = "farmer"  # 'farmer', 'stakeholder', 'expert'/'agronomist', or 'admin'


class UpdateProfileRequest(BaseModel):
    email: str
    full_name: str
    farm_name: Optional[str] = "Family Homestead Farm"
    farm_location: Optional[str] = "Punjab, India"
    preferred_crop: Optional[str] = "Wheat"
    organization_name: Optional[str] = None
    organization_type: Optional[str] = None
    operating_regions: Optional[str] = None
    primary_crops: Optional[str] = None
    stakeholder_type: Optional[str] = None


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
    is_active: Optional[bool] = True
    organization_name: Optional[str] = None
    organization_type: Optional[str] = None
    operating_regions: Optional[str] = None
    primary_crops: Optional[str] = None
    stakeholder_type: Optional[str] = None
    message: Optional[str] = "Success"


class AdminUserListItem(BaseModel):
    id: int
    email: str
    full_name: str
    farm_name: Optional[str]
    farm_location: Optional[str]
    preferred_crop: Optional[str]
    role: str
    is_active: bool
    organization_name: Optional[str] = None
    organization_type: Optional[str] = None
    operating_regions: Optional[str] = None
    primary_crops: Optional[str] = None
    stakeholder_type: Optional[str] = None
    created_at: Optional[str] = None


class AdminUserListResponse(BaseModel):
    total: int
    users: List[AdminUserListItem]


class AdminUpdateRoleRequest(BaseModel):
    role: str

    @field_validator('role')
    @classmethod
    def validate_allowed_role(cls, v: str) -> str:
        cleaned = v.strip().upper()
        if cleaned not in ALLOWED_ROLES:
            raise ValueError(f"Invalid role '{v}'. Allowed roles: {', '.join(ALLOWED_ROLES)}")
        return cleaned


class AdminUpdateStatusRequest(BaseModel):
    is_active: bool


