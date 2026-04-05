from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.database import get_db
from app.models.user import User
from app.core.security import hash_password
from app.dependencies import get_current_user, require_roles
from app.schemas.user import InviteUserRequest, UpdateUserRoleRequest, UpdateUserRequest, UserListResponse

router = APIRouter(prefix="/users", tags=["users"])

VALID_ROLES = {"admin", "manager", "editor", "client", "hr", "marketing"}


from datetime import datetime, timezone

@router.post("/me/checkin")
async def toggle_checkin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle check-in status for the current user."""
    # We need to fetch the user freshly from DB to update
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one()

    # Toggle
    user.is_checked_in = not user.is_checked_in
    if user.is_checked_in:
        user.last_check_in = datetime.now(timezone.utc)
    
    await db.flush()
    return {
        "is_checked_in": user.is_checked_in,
        "last_check_in": user.last_check_in
    }

@router.get("", response_model=List[UserListResponse])
async def list_users(
    current_user: User = Depends(require_roles("admin", "manager", "hr")),
    db: AsyncSession = Depends(get_db),
):
    """List all users in the organization."""
    result = await db.execute(
        select(User).where(User.org_id == current_user.org_id).order_by(User.created_at)
    )
    users = result.scalars().all()
    return users


@router.post("/invite", response_model=UserListResponse, status_code=status.HTTP_201_CREATED)
async def invite_user(
    data: InviteUserRequest,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Invite a new user to the organization. Admin only."""
    if data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role: {data.role}")

    # Check if email already exists in this org
    existing = await db.execute(
        select(User).where(User.org_id == current_user.org_id, User.email == data.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already exists in this organization")

    user = User(
        org_id=current_user.org_id,
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        role=data.role,
        is_owner=False,
    )
    db.add(user)
    await db.flush()
    return user


@router.put("/{user_id}/role")
async def change_user_role(
    user_id: str,
    data: UpdateUserRoleRequest,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Change a user's role. Admin only. Cannot demote founding admin."""
    if data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role: {data.role}")

    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == current_user.org_id)
    )
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Protect founding admin
    if target_user.is_owner and data.role != "admin":
        raise HTTPException(status_code=403, detail="Cannot change the founding admin's role")

    target_user.role = data.role
    await db.flush()

    return {"message": f"Role updated to '{data.role}'", "user_id": str(target_user.id)}


@router.put("/{user_id}", response_model=UserListResponse)
async def update_user(
    user_id: str,
    data: UpdateUserRequest,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update user profile. Admin only."""
    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == current_user.org_id)
    )
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.full_name is not None:
        target_user.full_name = data.full_name
    if data.avatar_url is not None:
        target_user.avatar_url = data.avatar_url
    if data.email is not None:
        target_user.email = data.email

    await db.flush()
    return target_user


@router.post("/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate a user. Admin only. Cannot deactivate founding admin."""
    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == current_user.org_id)
    )
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if target_user.is_owner:
        raise HTTPException(status_code=403, detail="Cannot deactivate the founding admin")

    target_user.is_active = False
    await db.flush()
    return {"message": "User deactivated", "user_id": str(target_user.id)}


@router.post("/{user_id}/activate")
async def activate_user(
    user_id: str,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Reactivate a deactivated user. Admin only."""
    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == current_user.org_id)
    )
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    target_user.is_active = True
    await db.flush()
    return {"message": "User activated", "user_id": str(target_user.id)}
