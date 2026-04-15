from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.comment import Comment
from app.models.user import User
from app.models.task import Task
from app.models.notification import Notification
from app.models.leaderboard import LeaderboardEntry
from app.dependencies import get_current_user
from app.schemas.comment import CommentCreate, CommentResponse
from app.core.events import event_bus, EVENT_COMMENT_ADDED
from app.core.tag_acl import get_user_assigned_tag_ids, accessible_project_ids_subquery

router = APIRouter(prefix="/tasks/{task_id}/comments", tags=["comments"])


async def _comment_to_response(db: AsyncSession, comment: Comment) -> CommentResponse:
    user_result = await db.execute(select(User).where(User.id == comment.user_id))
    user = user_result.scalar_one_or_none()

    replies_result = await db.execute(
        select(Comment).where(Comment.parent_id == comment.id).order_by(Comment.created_at)
    )
    replies = replies_result.scalars().all()
    reply_responses = [await _comment_to_response(db, r) for r in replies]

    user_display_name = None
    if user:
        user_display_name = user.nickname or user.full_name

    return CommentResponse(
        id=comment.id,
        task_id=comment.task_id,
        user_id=comment.user_id,
        user_name=user.full_name if user else None,
        user_display_name=user_display_name,
        user_avatar=user.avatar_url if user else None,
        user_role=user.role if user else None,
        parent_id=comment.parent_id,
        content=comment.content,
        mentions=comment.mentions,
        video_timestamp_ms=comment.video_timestamp_ms,
        is_resolved=comment.resolved_at is not None,
        resolved_at=comment.resolved_at,
        resolved_by=comment.resolved_by,
        created_at=comment.created_at,
        replies=reply_responses if reply_responses else None,
    )


@router.get("", response_model=List[CommentResponse])
async def list_comments(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List comments for a task (threaded) with tag-scope ACL."""
    task_result = await db.execute(
        select(Task).where(Task.id == task_id, Task.org_id == current_user.org_id)
    )
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    assigned_tag_ids = await get_user_assigned_tag_ids(db, current_user)
    if current_user.role != "admin":
        allowed_project_ids = set((await db.execute(accessible_project_ids_subquery(assigned_tag_ids))).scalars().all())
        if task.project_id not in allowed_project_ids:
            raise HTTPException(status_code=404, detail="Task not found")

    result = await db.execute(
        select(Comment)
        .where(Comment.task_id == task_id, Comment.parent_id.is_(None))
        .order_by(Comment.created_at)
    )
    comments = result.scalars().all()
    return [await _comment_to_response(db, c) for c in comments]


@router.post("", response_model=CommentResponse, status_code=201)
async def create_comment(
    task_id: UUID,
    data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a comment on a task with mentions + timestamp support."""
    task_result = await db.execute(
        select(Task).where(Task.id == task_id, Task.org_id == current_user.org_id)
    )
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    comment = Comment(
        org_id=current_user.org_id,
        task_id=task_id,
        user_id=current_user.id,
        parent_id=data.parent_id,
        content=data.content,
        mentions=data.mentions or [],
        video_timestamp_ms=data.video_timestamp_ms,
    )
    db.add(comment)
    await db.flush()

    # Client feedback on delivered task automatically pushes revision state and card indicators.
    if current_user.role == "client" and task.status == "delivered":
        task.status = "revision"
        task.revision_badge_count = int(task.revision_badge_count or 0) + 1
        task.last_revision_at = datetime.now(timezone.utc)
        if task.assigned_user_id:
            db.add(
                LeaderboardEntry(
                    org_id=task.org_id,
                    user_id=task.assigned_user_id,
                    points=-0.5,
                    reason="Revision requested",
                    category="revision",
                    is_penalty=True,
                    entry_type="auto",
                    reference_type="task",
                    reference_id=task.id,
                    meta={},
                )
            )

    # Mention notifications
    mention_ids = [m for m in (data.mentions or []) if m != current_user.id]
    if mention_ids:
        mentioned_users_result = await db.execute(
            select(User).where(User.org_id == current_user.org_id, User.id.in_(mention_ids))
        )
        display_name = current_user.nickname or current_user.full_name
        for mentioned in mentioned_users_result.scalars().all():
            db.add(
                Notification(
                    org_id=current_user.org_id,
                    user_id=mentioned.id,
                    type="mention",
                    title="You were mentioned",
                    message=f"{display_name} mentioned you in task feedback.",
                    reference_type="task",
                    reference_id=task.id,
                )
            )

    await db.flush()

    await event_bus.publish(EVENT_COMMENT_ADDED, {
        "comment_id": str(comment.id),
        "task_id": str(task_id),
        "org_id": str(current_user.org_id),
        "user_id": str(current_user.id),
        "mentions": [str(m) for m in (data.mentions or [])],
    })

    return await _comment_to_response(db, comment)


@router.post("/{comment_id}/resolve", response_model=CommentResponse)
async def resolve_comment(
    task_id: UUID,
    comment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resolve a review comment."""
    result = await db.execute(
        select(Comment).where(
            Comment.id == comment_id,
            Comment.task_id == task_id,
            Comment.org_id == current_user.org_id,
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    comment.resolved_at = datetime.now(timezone.utc)
    comment.resolved_by = current_user.id
    await db.flush()

    return await _comment_to_response(db, comment)
