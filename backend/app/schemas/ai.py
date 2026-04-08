from datetime import datetime
from typing import Literal, Optional
from uuid import UUID
from pydantic import BaseModel, Field

ProviderName = Literal["openai", "openrouter", "gemini", "ollama"]


class AIProviderSettingUpdateRequest(BaseModel):
    enabled: bool = False
    is_default: bool = False
    base_url: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None
    extra_config: Optional[dict] = None


class AIProviderSettingResponse(BaseModel):
    provider: ProviderName
    enabled: bool
    is_default: bool
    base_url: Optional[str] = None
    model: Optional[str] = None
    has_api_key: bool = False
    api_key_masked: Optional[str] = None
    extra_config: Optional[dict] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AIChatCreateRequest(BaseModel):
    title: Optional[str] = None


class AIChatUpdateRequest(BaseModel):
    title: Optional[str] = None
    is_archived: Optional[bool] = None


class AIChatResponse(BaseModel):
    id: UUID
    org_id: UUID
    user_id: UUID
    title: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AIMessageResponse(BaseModel):
    id: UUID
    chat_id: UUID
    role: str
    content: str
    tool_payload: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AIMemoryCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    importance: int = Field(default=1, ge=1, le=5)


class AIMemoryUpdateRequest(BaseModel):
    content: Optional[str] = Field(default=None, min_length=1, max_length=5000)
    importance: Optional[int] = Field(default=None, ge=1, le=5)


class AIMemoryResponse(BaseModel):
    id: UUID
    org_id: UUID
    user_id: UUID
    source_message_id: Optional[UUID] = None
    content: str
    importance: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AIStreamRequest(BaseModel):
    chat_id: Optional[UUID] = None
    title: Optional[str] = None
    message: str = Field(min_length=1, max_length=12000)
    provider: Optional[ProviderName] = None
    tools_enabled: bool = True
    memory_enabled: bool = True
    request_visual: bool = False


class AIStreamMetaResponse(BaseModel):
    chat_id: UUID
    provider: str
