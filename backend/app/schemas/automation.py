from pydantic import BaseModel
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime


class AutomationCreate(BaseModel):
    name: str
    trigger_type: str
    trigger_config: Dict[str, Any] = {}
    condition_config: Dict[str, Any] = {}
    action_type: str
    action_config: Dict[str, Any] = {}


class AutomationUpdate(BaseModel):
    name: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_config: Optional[Dict[str, Any]] = None
    condition_config: Optional[Dict[str, Any]] = None
    action_type: Optional[str] = None
    action_config: Optional[Dict[str, Any]] = None


class AutomationResponse(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    is_active: bool
    trigger_type: str
    trigger_config: Dict[str, Any]
    condition_config: Dict[str, Any]
    action_type: str
    action_config: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
