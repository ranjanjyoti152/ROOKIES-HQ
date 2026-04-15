from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class LeadCreate(BaseModel):
    name: str
    email: Optional[str] = None
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    source: Optional[str] = None
    site_url: Optional[str] = None
    reference_link: Optional[str] = None
    priority: str = "medium"
    niche: Optional[str] = None
    custom_comments: Optional[str] = None
    description: Optional[str] = None
    task_tags: Optional[List[str]] = None
    niche_tags: Optional[List[str]] = None
    value: Optional[float] = None
    notes: Optional[str] = None
    assigned_user_id: Optional[UUID] = None


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    source: Optional[str] = None
    site_url: Optional[str] = None
    reference_link: Optional[str] = None
    priority: Optional[str] = None
    niche: Optional[str] = None
    custom_comments: Optional[str] = None
    description: Optional[str] = None
    task_tags: Optional[List[str]] = None
    niche_tags: Optional[List[str]] = None
    value: Optional[float] = None
    notes: Optional[str] = None
    assigned_user_id: Optional[UUID] = None


class LeadTransition(BaseModel):
    target_status: str


class FollowupCreate(BaseModel):
    note: str
    follow_up_date: Optional[datetime] = None


class FollowupResponse(BaseModel):
    id: UUID
    lead_id: UUID
    user_id: UUID
    user_name: Optional[str] = None
    note: str
    follow_up_date: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class LeadResponse(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    email: Optional[str] = None
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    source: Optional[str] = None
    site_url: Optional[str] = None
    reference_link: Optional[str] = None
    priority: str = "medium"
    niche: Optional[str] = None
    custom_comments: Optional[str] = None
    description: Optional[str] = None
    task_tags: List[str] = []
    niche_tags: List[str] = []
    status: str
    value: Optional[float] = None
    notes: Optional[str] = None
    assigned_user_id: Optional[UUID] = None
    assigned_user_name: Optional[str] = None
    converted_project_id: Optional[UUID] = None
    converted_task_id: Optional[UUID] = None
    converted_at: Optional[datetime] = None
    followups: Optional[List[FollowupResponse]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LeadsSummaryResponse(BaseModel):
    pipeline_value: float
    closed_value: float
