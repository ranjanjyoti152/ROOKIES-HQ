from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class TimeEntryStart(BaseModel):
    task_id: UUID


class TimeEntryStop(BaseModel):
    task_id: UUID


class TimeEntryResponse(BaseModel):
    id: UUID
    user_id: UUID
    task_id: UUID
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TimeReportEntry(BaseModel):
    user_id: UUID
    user_name: str
    total_seconds: int
    task_count: int


class TimeReportResponse(BaseModel):
    entries: list[TimeReportEntry]
    total_seconds: int
