import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from app.database import get_db
from app.models.organization import Organization
from app.models.user import User
from app.core.security import hash_password
from app.dependencies import get_current_user
from app.schemas.workspace import CreateWorkspaceRequest, WorkspaceResponse

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def require_superadmin(current_user: User = Depends(get_current_user)):
    """Dependency to ensure the user is a superadmin."""
    if not current_user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmins can access this resource."
        )
    return current_user


@router.get("", response_model=List[WorkspaceResponse])
async def list_workspaces(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """
    List all workspaces (Organizations) with their owner details and user count.
    Only accessible by superadmin.
    """
    # Fetch all organizations
    orgs_result = await db.execute(select(Organization).order_by(Organization.created_at.desc()))
    orgs = orgs_result.scalars().all()

    response = []
    for org in orgs:
        # Find the owner user of this org
        owner_result = await db.execute(
            select(User).where(User.org_id == org.id, User.is_owner == True).limit(1)
        )
        owner = owner_result.scalar_one_or_none()

        # Count users in this org
        count_result = await db.execute(
            select(func.count(User.id)).where(User.org_id == org.id)
        )
        user_count = count_result.scalar_one()

        response.append(WorkspaceResponse(
            id=str(org.id),
            name=org.name,
            slug=org.slug,
            owner_name=owner.full_name if owner else "Unknown",
            owner_email=owner.email if owner else "Unknown",
            users_count=user_count,
            created_at=org.created_at.isoformat()
        ))

    return response


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    data: CreateWorkspaceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """
    Create a new workspace (Organization) and a user assigned as the owner of that workspace.
    Only accessible by superadmin.
    """
    slug = re.sub(r"[^a-z0-9]+", "-", data.org_name.lower()).strip("-")

    # Check org slug conflict
    existing_org = await db.execute(select(Organization).where(Organization.slug == slug))
    if existing_org.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Organization name already taken")

    # Check user email conflict
    existing_user = await db.execute(select(User).where(User.email == data.owner_email))
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Owner email already registered in the system")

    # 1. Create Organization
    org = Organization(name=data.org_name, slug=slug)
    db.add(org)
    await db.flush()

    # 2. Create User as owner of this new organization
    user = User(
        org_id=org.id,
        email=data.owner_email,
        password_hash=hash_password(data.owner_password),
        full_name=data.owner_full_name,
        role="admin",   # Admin within their workspace
        is_owner=True,  # They own this workspace
        is_superadmin=False, # They are not a global superadmin
    )
    db.add(user)
    await db.flush()

    return WorkspaceResponse(
        id=str(org.id),
        name=org.name,
        slug=org.slug,
        owner_name=user.full_name,
        owner_email=user.email,
        users_count=1,
        created_at=org.created_at.isoformat()
    )
