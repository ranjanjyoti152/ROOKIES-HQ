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
    owner_name: str
    owner_email: str
    users_count: int
    created_at: str

    model_config = {"from_attributes": True}
