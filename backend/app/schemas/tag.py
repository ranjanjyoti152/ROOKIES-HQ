from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class TagCreate(BaseModel):
    name: str
    color: str = "#6366f1"
    kind: str = "task"
    parent_tag_id: Optional[UUID] = None


class TagResponse(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    color: str
    kind: str
    parent_tag_id: Optional[UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AssignTagsRequest(BaseModel):
    tag_ids: list[UUID]
