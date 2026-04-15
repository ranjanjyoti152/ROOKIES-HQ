from datetime import datetime, timezone, timedelta
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.task import Task
from app.models.user import User
from app.models.time_entry import TimeEntry
from app.models.tag import Tag
from app.models.project import Project
from app.models.productivity_logbook import ProductivityLogbookEntry
from app.models.leaderboard import LeaderboardEntry
from app.dependencies import get_current_user, require_roles
from app.schemas.task import TaskCreate, TaskUpdate, TaskTransition, TaskResponse, PipelineResponse
from app.core.exceptions import InvalidTransitionException, ForbiddenException
from app.core.events import event_bus, EVENT_TASK_STATUS_CHANGED, EVENT_TASK_ASSIGNED, EVENT_TASK_CREATED
from app.core.tag_acl import get_user_assigned_tag_ids, accessible_project_ids_subquery

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _relative_period_to_start(period: str | None) -> datetime | None:
    if not period or period == "all":
        return None
    now = datetime.now(timezone.utc)
    mapping = {
        "7d": timedelta(days=7),
        "15d": timedelta(days=15),
        "30d": timedelta(days=30),
        "90d": timedelta(days=90),
    }
    delta = mapping.get(period)
    return (now - delta) if delta else None


async def _award_points(
    db: AsyncSession,
    *,
    org_id,
    user_id,
    points: float,
    reason: str,
    category: str,
    reference_type: str,
    reference_id,
    entry_type: str = "auto",
):
    if not user_id or points == 0:
        return
    db.add(
        LeaderboardEntry(
            org_id=org_id,
            user_id=user_id,
            points=points,
            reason=reason,
            category=category,
            is_penalty=points < 0,
            entry_type=entry_type,
            reference_type=reference_type,
            reference_id=reference_id,
            meta={},
        )
    )


async def task_to_response(db: AsyncSession, task: Task, user_name: str = None) -> TaskResponse:
    assigned_name = user_name
    if task.assigned_user_id and assigned_name is None:
        user_result = await db.execute(
            select(User.nickname, User.full_name).where(User.id == task.assigned_user_id)
        )
        user_row = user_result.first()
        if user_row:
            assigned_name = user_row.nickname or user_row.full_name

    project_tag = None
    if task.project_id:
        tag_result = await db.execute(
            select(Tag.name)
            .select_from(Project)
            .join(Tag, Project.project_tag_id == Tag.id, isouter=True)
            .where(Project.id == task.project_id)
        )
        project_tag = tag_result.scalar_one_or_none()

    return TaskResponse(
        id=task.id,
        org_id=task.org_id,
        project_id=task.project_id,
        title=task.title,
        description=task.description,
        created_by_user_id=task.created_by_user_id,
        assigned_user_id=task.assigned_user_id,
        assigned_user_name=assigned_name,
        status=task.status,
        priority=task.priority,
        task_type=task.task_type,
        deadline=task.deadline,
        attachment_link=task.attachment_link,
        is_flagged=task.is_flagged,
        revision_badge_count=task.revision_badge_count,
        needs_attention=task.revision_badge_count > 0 or task.status == "revision",
        last_revision_at=task.last_revision_at,
        project_tag=project_tag,
        is_private=task.is_private,
        sort_order=task.sort_order,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


@router.get("", response_model=List[TaskResponse])
async def list_tasks(
    project_id: Optional[UUID] = None,
    status_filter: Optional[str] = None,
    assigned_to: Optional[UUID] = None,
    priority: Optional[str] = None,
    tag_id: Optional[UUID] = None,
    period: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List tasks with filters, period filtering, and tag-first ACL."""
    query = select(Task).where(Task.org_id == current_user.org_id)

    if project_id:
        query = query.where(Task.project_id == project_id)
    if status_filter:
        query = query.where(Task.status == status_filter)
    if assigned_to:
        query = query.where(Task.assigned_user_id == assigned_to)
    if priority:
        query = query.where(Task.priority == priority)

    start = _relative_period_to_start(period)
    if start:
        query = query.where(Task.created_at >= start)
    if date_from:
        query = query.where(Task.created_at >= date_from)
    if date_to:
        query = query.where(Task.created_at <= date_to)

    if tag_id:
        query = query.where(Task.id.in_(select(Task.id).join(Task.tags).where(Tag.id == tag_id)))

    assigned_tag_ids = await get_user_assigned_tag_ids(db, current_user)
    if current_user.role != "admin":
        query = query.where(Task.project_id.in_(accessible_project_ids_subquery(assigned_tag_ids)))

    # Editors keep their personal constraints in addition to ACL scope
    if current_user.role == "editor":
        query = query.where(
            (Task.assigned_user_id == current_user.id)
            | (Task.assigned_user_id.is_(None))
            | (Task.is_private == False)
        )

    query = query.order_by(Task.sort_order, Task.created_at.desc())
    result = await db.execute(query)
    tasks = result.scalars().all()

    responses = []
    for task in tasks:
        responses.append(await task_to_response(db, task))

    return responses


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    data: TaskCreate,
    current_user: User = Depends(require_roles("admin", "manager", "editor")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new task."""
    initial_status = "unassigned"
    if data.assigned_user_id:
        initial_status = "claimed"

    project_result = await db.execute(
        select(Project).where(Project.id == data.project_id, Project.org_id == current_user.org_id)
    )
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    assigned_tag_ids = await get_user_assigned_tag_ids(db, current_user)
    if current_user.role != "admin":
        allowed_project_ids = set((await db.execute(accessible_project_ids_subquery(assigned_tag_ids))).scalars().all())
        if data.project_id not in allowed_project_ids:
            raise HTTPException(status_code=403, detail="Not authorized for this project")

    task = Task(
        org_id=current_user.org_id,
        project_id=data.project_id,
        title=data.title,
        description=data.description,
        created_by_user_id=data.created_by_user_id or current_user.id,
        assigned_user_id=data.assigned_user_id,
        status=initial_status,
        priority=data.priority,
        task_type=data.task_type,
        deadline=data.deadline,
        attachment_link=data.attachment_link,
        is_flagged=data.is_flagged,
        is_private=data.is_private,
    )
    db.add(task)
    await db.flush()

    if data.tag_ids:
        tags_result = await db.execute(
            select(Tag).where(Tag.org_id == current_user.org_id, Tag.id.in_(data.tag_ids))
        )
        task.tags = list(tags_result.scalars().all())

    await event_bus.publish(EVENT_TASK_CREATED, {
        "task_id": str(task.id),
        "org_id": str(task.org_id),
        "project_id": str(task.project_id),
        "assigned_user_id": str(task.assigned_user_id) if task.assigned_user_id else None,
    })

    return await task_to_response(db, task)


@router.get("/pipeline", response_model=PipelineResponse)
async def get_pipeline(
    project_id: Optional[UUID] = None,
    current_user: User = Depends(require_roles("admin", "manager", "editor", "client")),
    db: AsyncSession = Depends(get_db),
):
    """Get tasks grouped by status for Kanban board."""
    query = select(Task).where(Task.org_id == current_user.org_id)
    if project_id:
        query = query.where(Task.project_id == project_id)

    assigned_tag_ids = await get_user_assigned_tag_ids(db, current_user)
    if current_user.role != "admin":
        query = query.where(Task.project_id.in_(accessible_project_ids_subquery(assigned_tag_ids)))

    query = query.order_by(Task.sort_order, Task.created_at)
    result = await db.execute(query)
    tasks = result.scalars().all()

    pipeline = PipelineResponse()
    for task in tasks:
        resp = await task_to_response(db, task)
        if hasattr(pipeline, task.status):
            getattr(pipeline, task.status).append(resp)

    return pipeline


@router.get("/my-work", response_model=List[TaskResponse])
async def get_my_work(
    period: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get tasks assigned to the current user."""
    query = (
        select(Task)
        .where(Task.assigned_user_id == current_user.id, Task.org_id == current_user.org_id)
        .order_by(Task.priority.desc(), Task.created_at.desc())
    )
    start = _relative_period_to_start(period)
    if start:
        query = query.where(Task.created_at >= start)

    result = await db.execute(query)
    tasks = result.scalars().all()
    return [await task_to_response(db, task, current_user.nickname or current_user.full_name) for task in tasks]


@router.get("/personal")
async def get_personal_productivity(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Personal productivity snapshot with 24h visibility + logbook."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    tasks_result = await db.execute(
        select(Task).where(
            Task.org_id == current_user.org_id,
            (Task.created_by_user_id == current_user.id) | (Task.assigned_user_id == current_user.id),
        )
    )
    tasks = tasks_result.scalars().all()

    visible_tasks = []
    for task in tasks:
        if task.status == "closed" and task.updated_at < cutoff:
            continue
        visible_tasks.append(await task_to_response(db, task))

    logbook_result = await db.execute(
        select(ProductivityLogbookEntry)
        .where(
            ProductivityLogbookEntry.org_id == current_user.org_id,
            ProductivityLogbookEntry.user_id == current_user.id,
        )
        .order_by(ProductivityLogbookEntry.completed_at.desc())
    )
    logbook_entries = logbook_result.scalars().all()

    return {
        "tasks": visible_tasks,
        "logbook": [
            {
                "id": str(entry.id),
                "task_id": str(entry.task_id),
                "project_id": str(entry.project_id) if entry.project_id else None,
                "title": entry.title,
                "status": entry.status,
                "completed_at": entry.completed_at,
                "archived_at": entry.archived_at,
                "snapshot": entry.snapshot,
            }
            for entry in logbook_entries
        ],
    }


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get single task detail."""
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.org_id == current_user.org_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    assigned_tag_ids = await get_user_assigned_tag_ids(db, current_user)
    if current_user.role != "admin":
        allowed_project_ids = set((await db.execute(accessible_project_ids_subquery(assigned_tag_ids))).scalars().all())
        if task.project_id not in allowed_project_ids:
            raise HTTPException(status_code=404, detail="Task not found")

    return await task_to_response(db, task)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    data: TaskUpdate,
    current_user: User = Depends(require_roles("admin", "manager", "editor")),
    db: AsyncSession = Depends(get_db),
):
    """Update task fields (not status - use /transition for that)."""
    result = await db.execute(
        select(Task).options(selectinload(Task.tags)).where(Task.id == task_id, Task.org_id == current_user.org_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    assigned_tag_ids = await get_user_assigned_tag_ids(db, current_user)
    if current_user.role != "admin":
        allowed_project_ids = set((await db.execute(accessible_project_ids_subquery(assigned_tag_ids))).scalars().all())
        if task.project_id not in allowed_project_ids:
            raise HTTPException(status_code=403, detail="Not authorized for this task")

    update_data = data.model_dump(exclude_unset=True)
    old_assigned = task.assigned_user_id

    for field, value in update_data.items():
        setattr(task, field, value)

    if data.assigned_user_id and data.assigned_user_id != old_assigned:
        await event_bus.publish(EVENT_TASK_ASSIGNED, {
            "task_id": str(task.id),
            "org_id": str(task.org_id),
            "assigned_user_id": str(data.assigned_user_id),
        })

    await db.flush()
    return await task_to_response(db, task)


@router.post("/{task_id}/claim", response_model=TaskResponse)
async def claim_task(
    task_id: UUID,
    current_user: User = Depends(require_roles("admin", "manager", "editor")),
    db: AsyncSession = Depends(get_db),
):
    """Quick claim an unassigned task."""
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.org_id == current_user.org_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status != "unassigned":
        raise HTTPException(status_code=400, detail="Task is not unassigned")

    task.assigned_user_id = current_user.id
    task.status = "claimed"
    await db.flush()

    await event_bus.publish(EVENT_TASK_STATUS_CHANGED, {
        "task_id": str(task.id),
        "org_id": str(task.org_id),
        "old_status": "unassigned",
        "new_status": "claimed",
        "user_id": str(current_user.id),
    })

    return await task_to_response(db, task, current_user.nickname or current_user.full_name)


@router.post("/{task_id}/transition", response_model=TaskResponse)
async def transition_task(
    task_id: UUID,
    data: TaskTransition,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Transition task to a new status following the state machine."""
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.org_id == current_user.org_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    old_status = task.status

    if not task.can_transition_to(data.target_status):
        raise InvalidTransitionException(task.status, data.target_status)

    role = current_user.role
    target = data.target_status
    is_private_owner = task.is_private and task.assigned_user_id == current_user.id

    if role != "admin" and not is_private_owner:
        if target == "editing" and task.assigned_user_id != current_user.id:
            raise ForbiddenException("Only the assigned editor can start editing")
        if target == "internal_review" and task.assigned_user_id != current_user.id:
            raise ForbiddenException("Only the assigned editor can submit for review")
        if target in ("delivered",) and role not in ("manager",):
            raise ForbiddenException("Only managers can approve for delivery")
        if target == "revision" and old_status == "internal_review" and role not in ("manager", "client"):
            raise ForbiddenException("Only managers or clients can reject for revision")
        if target == "closed" and role not in ("client", "manager"):
            raise ForbiddenException("Only clients or managers can close a task")

    task.status = data.target_status

    if data.target_status == "internal_review" and data.attachment_link:
        task.attachment_link = data.attachment_link

    if data.target_status == "revision":
        task.revision_badge_count = int(task.revision_badge_count or 0) + 1
        task.last_revision_at = datetime.now(timezone.utc)
    elif old_status == "revision" and data.target_status in ("editing", "internal_review", "delivered", "closed"):
        task.revision_badge_count = 0

    if data.target_status == "editing":
        time_entry = TimeEntry(
            org_id=current_user.org_id,
            user_id=current_user.id,
            task_id=task.id,
            started_at=datetime.now(timezone.utc),
        )
        db.add(time_entry)
    elif old_status == "editing" and data.target_status != "editing":
        open_entry_result = await db.execute(
            select(TimeEntry).where(
                TimeEntry.task_id == task.id,
                TimeEntry.user_id == current_user.id,
                TimeEntry.ended_at.is_(None),
            )
        )
        open_entry = open_entry_result.scalar_one_or_none()
        if open_entry:
            open_entry.ended_at = datetime.now(timezone.utc)
            open_entry.duration_seconds = int((open_entry.ended_at - open_entry.started_at).total_seconds())

    # Points automation
    if target == "delivered":
        await _award_points(
            db,
            org_id=task.org_id,
            user_id=task.assigned_user_id,
            points=15,
            reason="Client Video delivered",
            category="client_video",
            reference_type="task",
            reference_id=task.id,
        )
    if target == "revision":
        await _award_points(
            db,
            org_id=task.org_id,
            user_id=task.assigned_user_id,
            points=-0.5,
            reason="Revision requested",
            category="revision",
            reference_type="task",
            reference_id=task.id,
        )

    if target == "closed":
        log_exists_result = await db.execute(
            select(ProductivityLogbookEntry.id).where(
                ProductivityLogbookEntry.task_id == task.id,
                ProductivityLogbookEntry.user_id == (task.assigned_user_id or current_user.id),
            )
        )
        if not log_exists_result.scalar_one_or_none():
            db.add(
                ProductivityLogbookEntry(
                    org_id=task.org_id,
                    user_id=task.assigned_user_id or current_user.id,
                    task_id=task.id,
                    project_id=task.project_id,
                    title=task.title,
                    status="closed",
                    completed_at=datetime.now(timezone.utc),
                    snapshot={
                        "description": task.description,
                        "priority": task.priority,
                        "task_type": task.task_type,
                        "attachment_link": task.attachment_link,
                        "updated_at": task.updated_at.isoformat() if task.updated_at else None,
                    },
                )
            )

    await db.flush()

    await event_bus.publish(EVENT_TASK_STATUS_CHANGED, {
        "task_id": str(task.id),
        "org_id": str(task.org_id),
        "old_status": old_status,
        "new_status": data.target_status,
        "user_id": str(current_user.id),
    })

    return await task_to_response(db, task)
