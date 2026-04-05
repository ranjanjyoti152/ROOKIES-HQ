from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class NotificationResponse(BaseModel):
    id: UUID
    type: str
    title: str
    message: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[UUID] = None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
