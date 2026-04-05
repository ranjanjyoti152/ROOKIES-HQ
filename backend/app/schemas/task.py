from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class TaskCreate(BaseModel):
    project_id: UUID
    title: str
    description: Optional[str] = None
    assigned_user_id: Optional[UUID] = None
    priority: str = "medium"
    task_type: str = "short_form"
    deadline: Optional[datetime] = None
    is_private: bool = False
    tag_ids: Optional[List[UUID]] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_user_id: Optional[UUID] = None
    priority: Optional[str] = None
    deadline: Optional[datetime] = None
    attachment_link: Optional[str] = None
    sort_order: Optional[int] = None


class TaskTransition(BaseModel):
    target_status: str
    attachment_link: Optional[str] = None  # For internal_review transition


class TaskResponse(BaseModel):
    id: UUID
    org_id: UUID
    project_id: UUID
    title: str
    description: Optional[str] = None
    assigned_user_id: Optional[UUID] = None
    assigned_user_name: Optional[str] = None
    status: str
    priority: str
    task_type: str
    deadline: Optional[datetime] = None
    attachment_link: Optional[str] = None
    is_private: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PipelineResponse(BaseModel):
    unassigned: List[TaskResponse] = []
    claimed: List[TaskResponse] = []
    editing: List[TaskResponse] = []
    internal_review: List[TaskResponse] = []
    revision: List[TaskResponse] = []
    delivered: List[TaskResponse] = []
    closed: List[TaskResponse] = []
