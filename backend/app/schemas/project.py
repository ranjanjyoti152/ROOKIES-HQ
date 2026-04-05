from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.schemas.user import UserListResponse


class ProjectCreate(BaseModel):
    name: str
    client_name: Optional[str] = None
    description: Optional[str] = None
    status: str = "active"
    tag_ids: Optional[List[UUID]] = None
    member_ids: Optional[List[UUID]] = []


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    client_name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    member_ids: Optional[List[UUID]] = None


class ProjectResponse(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    client_name: Optional[str] = None
    description: Optional[str] = None
    status: str
    assigned_members: Optional[List[UserListResponse]] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectStatsResponse(BaseModel):
    total_tasks: int = 0
    short_form_count: int = 0
    long_form_count: int = 0
    revision_count: int = 0
    completed_count: int = 0
    completion_percentage: float = 0.0
