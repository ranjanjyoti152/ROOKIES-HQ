from pydantic import BaseModel, EmailStr, Field

class CreateWorkspaceRequest(BaseModel):
    org_name: str = Field(..., min_length=2, max_length=255)
    owner_email: EmailStr
    owner_full_name: str = Field(..., min_length=2, max_length=255)
    owner_password: str = Field(..., min_length=8)

class WorkspaceResponse(BaseModel):
    id: str
    name: str
    slug: str
    is_paused: bool = False
    paused_at: str | None = None
    owner_name: str
    owner_email: str
    users_count: int
    created_at: str
    can_manage: bool = False
    services: dict[str, bool] = Field(default_factory=dict)

    model_config = {"from_attributes": True}


class WorkspacePauseRequest(BaseModel):
    is_paused: bool


class WorkspaceProvisionInitiateResponse(BaseModel):
    message: str
    owner_email: EmailStr


class WorkspaceProvisionVerifyRequest(BaseModel):
    owner_email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)


class ResetWorkspaceOwnerPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8)


class WorkspaceServiceUpdateRequest(BaseModel):
    services: dict[str, bool] = Field(default_factory=dict)


class WorkspaceServiceCatalogItem(BaseModel):
    key: str
    label: str
