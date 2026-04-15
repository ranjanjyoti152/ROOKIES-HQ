from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID


class InviteUserRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: str = "editor"


class UpdateUserRoleRequest(BaseModel):
    role: str


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    email: Optional[EmailStr] = None
    role_tags: Optional[list[str]] = None


class UserListResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    role_tags: list[str] = []
    active_points: float = 0.0
    penalty_points: float = 0.0
    is_owner: bool
    is_active: bool
    is_checked_in: bool
    must_change_password: bool = False

    model_config = {"from_attributes": True}


class ResetUserPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8)
    require_change: bool = True
