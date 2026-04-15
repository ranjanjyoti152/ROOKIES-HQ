from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class RegisterRequest(BaseModel):
    """First user registration - creates org + admin user."""
    org_name: str
    email: EmailStr
    password: str
    full_name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp: str

class JoinRequest(BaseModel):
    """Join an existing workspace — no new org is created."""
    org_slug: str       # workspace identifier shown on the join screen
    email: EmailStr
    password: str
    full_name: str

class JoinOTPVerifyRequest(BaseModel):
    email: EmailStr
    otp: str
    org_slug: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str

class UserResponse(BaseModel):
    id: UUID
    org_id: UUID
    email: str
    full_name: str
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    role_tags: Optional[List[str]] = None
    is_owner: bool
    is_superadmin: bool = False
    must_change_password: bool = False
    is_active: bool
    is_checked_in: bool
    last_check_in: Optional[datetime] = None
    sidebar_items: Optional[List[dict]] = None

    model_config = {"from_attributes": True}


class MeResponse(BaseModel):
    user: UserResponse
    organization: dict


class ChangePasswordRequest(BaseModel):
    current_password: str | None = None
    new_password: str = Field(..., min_length=8)
    skip_current_password_check: bool = False
