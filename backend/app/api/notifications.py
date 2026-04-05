from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List
from uuid import UUID
from app.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.dependencies import get_current_user
from app.schemas.notification import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=List[NotificationResponse])
async def list_notifications(
    unread_only: bool = False,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List notifications for the current user."""
    query = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.is_read, Notification.created_at.desc())
        .limit(limit)
    )
    if unread_only:
        query = query.where(Notification.is_read == False)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a single notification as read."""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    await db.flush()
    return {"message": "Marked as read"}


@router.post("/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read."""
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.flush()
    return {"message": "All notifications marked as read"}
