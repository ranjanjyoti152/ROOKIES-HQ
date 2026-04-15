from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.leaderboard import LeaderboardEntry
from app.models.task import Task
from app.core.security import hash_password
from app.dependencies import get_current_user, require_roles
from app.schemas.user import (
    InviteUserRequest,
    UpdateUserRoleRequest,
    UpdateUserRequest,
    UserListResponse,
    ResetUserPasswordRequest,
)
from app.core.tag_acl import get_user_assigned_tag_ids, accessible_project_ids_subquery

router = APIRouter(prefix="/users", tags=["users"])

VALID_ROLES = {"admin", "manager", "editor", "client", "hr", "marketing"}


from app.models.time_entry import TimeEntry
from datetime import datetime, timezone

@router.post("/me/checkin")
async def toggle_checkin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle check-in status for the current user."""
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one()

    # If checking out (is_checked_in transitioning from True -> False)
    if user.is_checked_in and user.last_check_in:
        now = datetime.now(timezone.utc)
        duration_delta = now - user.last_check_in
        duration_seconds = int(duration_delta.total_seconds())
        
        # Log the session time entry
        new_entry = TimeEntry(
            org_id=user.org_id,
            user_id=user.id,
            task_id=None,
            started_at=user.last_check_in,
            ended_at=now,
            duration_seconds=duration_seconds,
        )
        db.add(new_entry)

    # Toggle state
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

    points_result = await db.execute(
        select(
            LeaderboardEntry.user_id,
            func.coalesce(func.sum(LeaderboardEntry.points), 0).label("total"),
            func.coalesce(
                func.sum(case((LeaderboardEntry.points < 0, LeaderboardEntry.points), else_=0)),
                0,
            ).label("penalty"),
        )
        .where(LeaderboardEntry.org_id == current_user.org_id)
        .group_by(LeaderboardEntry.user_id)
    )
    points_map = {row.user_id: (float(row.total or 0), float(abs(row.penalty or 0))) for row in points_result}

    responses: List[UserListResponse] = []
    for user in users:
        total, penalty = points_map.get(user.id, (0.0, 0.0))
        responses.append(
            UserListResponse(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                nickname=user.nickname,
                avatar_url=user.avatar_url,
                role=user.role,
                role_tags=user.role_tags or [],
                active_points=max(0.0, total),
                penalty_points=penalty,
                is_owner=user.is_owner,
                is_active=user.is_active,
                is_checked_in=user.is_checked_in,
                must_change_password=user.must_change_password,
            )
        )
    return responses


@router.get("/mentions")
async def list_mentionable_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return users suitable for @mention dropdown (nickname-first labels)."""
    query = select(User).where(User.org_id == current_user.org_id, User.is_active == True).order_by(User.full_name)

    if current_user.role != "admin":
        assigned_tag_ids = await get_user_assigned_tag_ids(db, current_user)
        if assigned_tag_ids:
            visible_task_users = await db.execute(
                select(Task.assigned_user_id)
                .where(
                    Task.org_id == current_user.org_id,
                    Task.project_id.in_(accessible_project_ids_subquery(assigned_tag_ids)),
                    Task.assigned_user_id.isnot(None),
                )
                .distinct()
            )
            visible_ids = {uid for uid in visible_task_users.scalars().all() if uid}
            visible_ids.add(current_user.id)
            query = query.where(User.id.in_(visible_ids))
        else:
            query = query.where(User.id == current_user.id)

    result = await db.execute(query)
    users = result.scalars().all()

    return [
        {
            "id": str(u.id),
            "nickname": u.nickname,
            "full_name": u.full_name,
            "display_name": u.nickname or u.full_name,
            "role": u.role,
            "avatar_url": u.avatar_url,
        }
        for u in users
    ]


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
        must_change_password=True,
    )
    db.add(user)
    await db.flush()
    return user


@router.post("/{user_id}/password/reset")
async def reset_user_password(
    user_id: str,
    data: ResetUserPasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Reset a user's password.
    - Superadmin: can reset any user across workspaces.
    - Admin: can reset users only inside their workspace.
    """
    if not (current_user.is_superadmin or current_user.role == "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin or superadmin can reset passwords")

    stmt = select(User).where(User.id == user_id)
    if not current_user.is_superadmin:
        stmt = stmt.where(User.org_id == current_user.org_id)

    result = await db.execute(stmt)
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if target_user.is_superadmin and not current_user.is_superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only superadmin can reset a superadmin password")

    target_user.password_hash = hash_password(data.new_password)
    target_user.must_change_password = data.require_change
    await db.flush()

    return {
        "message": "Password reset successfully",
        "user_id": str(target_user.id),
        "must_change_password": target_user.must_change_password,
    }


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
    if data.nickname is not None:
        target_user.nickname = data.nickname.strip() or None
    if data.avatar_url is not None:
        target_user.avatar_url = data.avatar_url
    if data.email is not None:
        target_user.email = data.email
    if data.role_tags is not None:
        target_user.role_tags = data.role_tags

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
