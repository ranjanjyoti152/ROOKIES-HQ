from pydantic import BaseModel, EmailStr
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
    avatar_url: Optional[str] = None
    email: Optional[EmailStr] = None


class UserListResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    avatar_url: Optional[str] = None
    role: str
    is_owner: bool
    is_active: bool
    is_checked_in: bool

    model_config = {"from_attributes": True}
