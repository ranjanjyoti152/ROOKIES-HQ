from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
from app.database import get_db
from app.models.comment import Comment
from app.models.user import User
from app.models.task import Task
from app.dependencies import get_current_user
from app.schemas.comment import CommentCreate, CommentResponse
from app.core.events import event_bus, EVENT_COMMENT_ADDED

router = APIRouter(prefix="/tasks/{task_id}/comments", tags=["comments"])


@router.get("", response_model=List[CommentResponse])
async def list_comments(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List comments for a task (threaded)."""
    # Verify task exists and belongs to org
    task_result = await db.execute(
        select(Task).where(Task.id == task_id, Task.org_id == current_user.org_id)
    )
    if not task_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Task not found")

    # Get top-level comments
    result = await db.execute(
        select(Comment)
        .where(Comment.task_id == task_id, Comment.parent_id.is_(None))
        .order_by(Comment.created_at)
    )
    comments = result.scalars().all()

    async def build_response(comment: Comment) -> CommentResponse:
        # Load user info
        user_result = await db.execute(select(User).where(User.id == comment.user_id))
        user = user_result.scalar_one_or_none()

        # Load replies
        replies_result = await db.execute(
            select(Comment)
            .where(Comment.parent_id == comment.id)
            .order_by(Comment.created_at)
        )
        replies = replies_result.scalars().all()
        reply_responses = [await build_response(r) for r in replies]

        return CommentResponse(
            id=comment.id,
            task_id=comment.task_id,
            user_id=comment.user_id,
            user_name=user.full_name if user else None,
            user_avatar=user.avatar_url if user else None,
            user_role=user.role if user else None,
            parent_id=comment.parent_id,
            content=comment.content,
            mentions=comment.mentions,
            created_at=comment.created_at,
            replies=reply_responses if reply_responses else None,
        )

    return [await build_response(c) for c in comments]


@router.post("", response_model=CommentResponse, status_code=201)
async def create_comment(
    task_id: UUID,
    data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a comment on a task."""
    # Verify task exists
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
    )
    db.add(comment)
    await db.flush()

    # Client comment on delivered task → revision
    if current_user.role == "client" and task.status == "delivered":
        task.status = "revision"
        await db.flush()

    await event_bus.publish(EVENT_COMMENT_ADDED, {
        "comment_id": str(comment.id),
        "task_id": str(task_id),
        "org_id": str(current_user.org_id),
        "user_id": str(current_user.id),
        "mentions": [str(m) for m in (data.mentions or [])],
    })

    return CommentResponse(
        id=comment.id,
        task_id=comment.task_id,
        user_id=comment.user_id,
        user_name=current_user.full_name,
        user_avatar=current_user.avatar_url,
        user_role=current_user.role,
        parent_id=comment.parent_id,
        content=comment.content,
        mentions=comment.mentions,
        created_at=comment.created_at,
    )
