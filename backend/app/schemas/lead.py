from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class LeadCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    source: Optional[str] = None
    value: Optional[float] = None
    notes: Optional[str] = None
    assigned_user_id: Optional[UUID] = None


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    source: Optional[str] = None
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
    phone: Optional[str] = None
    company: Optional[str] = None
    source: Optional[str] = None
    status: str
    value: Optional[float] = None
    notes: Optional[str] = None
    assigned_user_id: Optional[UUID] = None
    assigned_user_name: Optional[str] = None
    followups: Optional[List[FollowupResponse]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
