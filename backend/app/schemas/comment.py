from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class CommentCreate(BaseModel):
    content: str
    parent_id: Optional[UUID] = None
    mentions: Optional[List[UUID]] = None
    video_timestamp_ms: Optional[int] = None


class CommentResponse(BaseModel):
    id: UUID
    task_id: UUID
    user_id: UUID
    user_name: Optional[str] = None
    user_display_name: Optional[str] = None
    user_avatar: Optional[str] = None
    user_role: Optional[str] = None
    parent_id: Optional[UUID] = None
    content: str
    mentions: Optional[List[UUID]] = None
    video_timestamp_ms: Optional[int] = None
    is_resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[UUID] = None
    created_at: datetime
    replies: Optional[List["CommentResponse"]] = None

    model_config = {"from_attributes": True}
