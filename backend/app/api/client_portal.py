from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.user import User
from app.models.project import Project
from app.models.task import Task
from app.models.comment import Comment
from app.models.video_asset import VideoAsset
from app.models.tag import Tag
from app.core.tag_acl import get_user_assigned_tag_ids, accessible_project_ids_subquery

router = APIRouter(prefix="/client-portal", tags=["client-portal"])


@router.get("/dashboard")
async def client_dashboard(
    current_user: User = Depends(require_roles("admin", "manager", "client")),
    db: AsyncSession = Depends(get_db),
):
    assigned_tag_ids = await get_user_assigned_tag_ids(db, current_user)

    project_query = select(Project).where(Project.org_id == current_user.org_id)
    if current_user.role != "admin":
        project_query = project_query.where(Project.id.in_(accessible_project_ids_subquery(assigned_tag_ids)))

    projects_result = await db.execute(project_query.order_by(Project.updated_at.desc()))
    projects = projects_result.scalars().all()

    project_ids = [p.id for p in projects]

    if project_ids:
        status_result = await db.execute(
            select(Task.status, func.count(Task.id))
            .where(Task.org_id == current_user.org_id, Task.project_id.in_(project_ids))
            .group_by(Task.status)
        )
        status_map = {row[0]: int(row[1]) for row in status_result}
    else:
        status_map = {}

    return {
        "analytics": {
            "video_count": status_map.get("delivered", 0) + status_map.get("closed", 0),
            "pending_revisions": status_map.get("revision", 0),
            "completion_rate": round(
                ((status_map.get("closed", 0) / max(1, sum(status_map.values()))) * 100),
                1,
            ),
        },
        "projects": [
            {
                "id": str(p.id),
                "name": p.name,
                "client_name": p.client_name,
                "status": p.status,
                "project_tag_id": str(p.project_tag_id) if p.project_tag_id else None,
            }
            for p in projects
        ],
    }


@router.get("/review-queue")
async def review_queue(
    status: str | None = None,
    current_user: User = Depends(require_roles("admin", "manager", "client")),
    db: AsyncSession = Depends(get_db),
):
    assigned_tag_ids = await get_user_assigned_tag_ids(db, current_user)
    task_query = select(Task).where(Task.org_id == current_user.org_id)

    if current_user.role != "admin":
        task_query = task_query.where(Task.project_id.in_(accessible_project_ids_subquery(assigned_tag_ids)))

    # Delivered tasks are the baseline review source (hybrid mode can attach video assets).
    if status:
        task_query = task_query.where(Task.status == status)
    else:
        task_query = task_query.where(Task.status.in_(["delivered", "revision", "closed"]))

    task_query = task_query.where(Task.attachment_link.isnot(None)).order_by(Task.updated_at.desc())
    tasks_result = await db.execute(task_query)
    tasks = tasks_result.scalars().all()

    # Pull optional video assets if available
    task_ids = [t.id for t in tasks]
    assets_by_task: dict[UUID, VideoAsset] = {}
    if task_ids:
        assets_result = await db.execute(
            select(VideoAsset).where(VideoAsset.task_id.in_(task_ids)).order_by(VideoAsset.updated_at.desc())
        )
        for asset in assets_result.scalars().all():
            assets_by_task.setdefault(asset.task_id, asset)

    payload = []
    for task in tasks:
        comments_count_result = await db.execute(
            select(func.count(Comment.id)).where(Comment.task_id == task.id)
        )
        comments_count = int(comments_count_result.scalar() or 0)

        project_result = await db.execute(select(Project.name).where(Project.id == task.project_id))
        project_name = project_result.scalar_one_or_none()

        asset = assets_by_task.get(task.id)
        payload.append(
            {
                "task_id": str(task.id),
                "project_id": str(task.project_id),
                "project_name": project_name,
                "video_title": asset.title if asset else task.title,
                "thumbnail_url": asset.thumbnail_url if asset else None,
                "video_url": asset.video_url if asset else task.attachment_link,
                "download_url": task.attachment_link,
                "status": asset.status if asset else task.status,
                "upload_date": asset.uploaded_at if asset else task.updated_at,
                "comments_count": comments_count,
            }
        )

    return payload


@router.get("/videos/{task_id}")
async def review_video_detail(
    task_id: UUID,
    current_user: User = Depends(require_roles("admin", "manager", "client", "editor")),
    db: AsyncSession = Depends(get_db),
):
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

    project_result = await db.execute(select(Project).where(Project.id == task.project_id))
    project = project_result.scalar_one_or_none()

    comments_result = await db.execute(
        select(Comment).where(Comment.task_id == task.id).order_by(Comment.created_at)
    )
    comments = comments_result.scalars().all()

    users_result = await db.execute(select(User.id, User.full_name, User.nickname, User.avatar_url))
    users_map = {str(row.id): row for row in users_result}

    review_comments = []
    for c in comments:
        u = users_map.get(str(c.user_id))
        review_comments.append(
            {
                "id": str(c.id),
                "parent_id": str(c.parent_id) if c.parent_id else None,
                "user_id": str(c.user_id),
                "name": (u.nickname if u and u.nickname else (u.full_name if u else "Unknown")),
                "avatar_url": u.avatar_url if u else None,
                "created_at": c.created_at,
                "video_timestamp_ms": c.video_timestamp_ms,
                "content": c.content,
                "is_resolved": c.resolved_at is not None,
                "resolved_at": c.resolved_at,
                "resolved_by": str(c.resolved_by) if c.resolved_by else None,
                "mentions": [str(m) for m in (c.mentions or [])],
            }
        )

    return {
        "task": {
            "id": str(task.id),
            "title": task.title,
            "status": task.status,
            "video_url": task.attachment_link,
            "download_url": task.attachment_link,
            "project_name": project.name if project else None,
        },
        "comments": review_comments,
    }
