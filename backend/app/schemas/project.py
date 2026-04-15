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
    project_tag_id: Optional[UUID] = None
    client_tag_ids: Optional[List[UUID]] = None
    tag_ids: Optional[List[UUID]] = None
    member_ids: Optional[List[UUID]] = []
    lead_id: Optional[UUID] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    client_name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    project_tag_id: Optional[UUID] = None
    client_tag_ids: Optional[List[UUID]] = None
    member_ids: Optional[List[UUID]] = None


class ProjectResponse(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    tag_key: Optional[str] = None
    project_tag_id: Optional[UUID] = None
    project_tag: Optional[str] = None
    client_tags: List[str] = []
    lead_origin: Optional[str] = None
    task_count: int = 0
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
