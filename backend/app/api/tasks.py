from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
from app.database import get_db
from app.models.task import Task
from app.models.user import User
from app.models.time_entry import TimeEntry
from app.dependencies import get_current_user, require_roles
from app.schemas.task import TaskCreate, TaskUpdate, TaskTransition, TaskResponse, PipelineResponse
from app.core.exceptions import InvalidTransitionException, ForbiddenException
from app.core.events import event_bus, EVENT_TASK_STATUS_CHANGED, EVENT_TASK_ASSIGNED, EVENT_TASK_CREATED

router = APIRouter(prefix="/tasks", tags=["tasks"])


def task_to_response(task: Task, user_name: str = None) -> TaskResponse:
    return TaskResponse(
        id=task.id,
        org_id=task.org_id,
        project_id=task.project_id,
        title=task.title,
        description=task.description,
        assigned_user_id=task.assigned_user_id,
        assigned_user_name=user_name,
        status=task.status,
        priority=task.priority,
        task_type=task.task_type,
        deadline=task.deadline,
        attachment_link=task.attachment_link,
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List tasks with optional filters."""
    query = select(Task).where(Task.org_id == current_user.org_id)

    if project_id:
        query = query.where(Task.project_id == project_id)
    if status_filter:
        query = query.where(Task.status == status_filter)
    if assigned_to:
        query = query.where(Task.assigned_user_id == assigned_to)
    if priority:
        query = query.where(Task.priority == priority)

    # Editors only see assigned tasks + unassigned tasks
    if current_user.role == "editor":
        query = query.where(
            (Task.assigned_user_id == current_user.id) |
            (Task.assigned_user_id.is_(None)) |
            (Task.is_private == False)
        )

    query = query.order_by(Task.sort_order, Task.created_at.desc())
    result = await db.execute(query)
    tasks = result.scalars().all()

    # Batch load user names
    responses = []
    for task in tasks:
        user_name = None
        if task.assigned_user_id:
            user_result = await db.execute(select(User.full_name).where(User.id == task.assigned_user_id))
            user_name = user_result.scalar_one_or_none()
        responses.append(task_to_response(task, user_name))

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

    task = Task(
        org_id=current_user.org_id,
        project_id=data.project_id,
        title=data.title,
        description=data.description,
        assigned_user_id=data.assigned_user_id,
        status=initial_status,
        priority=data.priority,
        task_type=data.task_type,
        deadline=data.deadline,
        is_private=data.is_private,
    )
    db.add(task)
    await db.flush()

    await event_bus.publish(EVENT_TASK_CREATED, {
        "task_id": str(task.id),
        "org_id": str(task.org_id),
        "project_id": str(task.project_id),
        "assigned_user_id": str(task.assigned_user_id) if task.assigned_user_id else None,
    })

    return task_to_response(task)


@router.get("/pipeline", response_model=PipelineResponse)
async def get_pipeline(
    project_id: Optional[UUID] = None,
    current_user: User = Depends(require_roles("admin", "manager", "editor")),
    db: AsyncSession = Depends(get_db),
):
    """Get tasks grouped by status for Kanban board."""
    query = select(Task).where(Task.org_id == current_user.org_id)
    if project_id:
        query = query.where(Task.project_id == project_id)

    query = query.order_by(Task.sort_order, Task.created_at)
    result = await db.execute(query)
    tasks = result.scalars().all()

    pipeline = PipelineResponse()

    for task in tasks:
        user_name = None
        if task.assigned_user_id:
            user_result = await db.execute(select(User.full_name).where(User.id == task.assigned_user_id))
            user_name = user_result.scalar_one_or_none()

        resp = task_to_response(task, user_name)
        getattr(pipeline, task.status).append(resp)

    return pipeline


@router.get("/my-work", response_model=List[TaskResponse])
async def get_my_work(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get tasks assigned to the current user."""
    query = (
        select(Task)
        .where(Task.assigned_user_id == current_user.id, Task.org_id == current_user.org_id)
        .order_by(Task.priority.desc(), Task.created_at.desc())
    )
    result = await db.execute(query)
    tasks = result.scalars().all()
    return [task_to_response(task, current_user.full_name) for task in tasks]


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

    user_name = None
    if task.assigned_user_id:
        user_result = await db.execute(select(User.full_name).where(User.id == task.assigned_user_id))
        user_name = user_result.scalar_one_or_none()

    return task_to_response(task, user_name)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    data: TaskUpdate,
    current_user: User = Depends(require_roles("admin", "manager", "editor")),
    db: AsyncSession = Depends(get_db),
):
    """Update task fields (not status - use /transition for that)."""
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.org_id == current_user.org_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = data.model_dump(exclude_unset=True)
    old_assigned = task.assigned_user_id

    for field, value in update_data.items():
        setattr(task, field, value)

    # If user was just assigned, emit event
    if data.assigned_user_id and data.assigned_user_id != old_assigned:
        await event_bus.publish(EVENT_TASK_ASSIGNED, {
            "task_id": str(task.id),
            "org_id": str(task.org_id),
            "assigned_user_id": str(data.assigned_user_id),
        })

    await db.flush()

    user_name = None
    if task.assigned_user_id:
        user_result = await db.execute(select(User.full_name).where(User.id == task.assigned_user_id))
        user_name = user_result.scalar_one_or_none()

    return task_to_response(task, user_name)


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

    return task_to_response(task, current_user.full_name)


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

    # Validate transition
    if not task.can_transition_to(data.target_status):
        raise InvalidTransitionException(task.status, data.target_status)

    # Role-based transition checks
    role = current_user.role
    target = data.target_status
    is_private_owner = task.is_private and task.assigned_user_id == current_user.id

    # Admin can do anything
    if role != "admin" and not is_private_owner:
        if target == "editing" and task.assigned_user_id != current_user.id:
            raise ForbiddenException("Only the assigned editor can start editing")
        if target == "internal_review" and task.assigned_user_id != current_user.id:
            raise ForbiddenException("Only the assigned editor can submit for review")
        if target in ("delivered",) and role not in ("manager",):
            raise ForbiddenException("Only managers can approve for delivery")
        if target == "revision" and old_status == "internal_review" and role not in ("manager",):
            raise ForbiddenException("Only managers can reject for revision")
        if target == "closed" and role not in ("client", "manager"):
            raise ForbiddenException("Only clients or managers can close a task")

    # Apply transition
    task.status = data.target_status

    # Handle attachment on internal_review
    if data.target_status == "internal_review" and data.attachment_link:
        task.attachment_link = data.attachment_link

    # Handle time tracking
    if data.target_status == "editing":
        # Start timer
        time_entry = TimeEntry(
            org_id=current_user.org_id,
            user_id=current_user.id,
            task_id=task.id,
            started_at=datetime.now(timezone.utc),
        )
        db.add(time_entry)
    elif old_status == "editing" and data.target_status != "editing":
        # Stop timer
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
            open_entry.duration_seconds = int(
                (open_entry.ended_at - open_entry.started_at).total_seconds()
            )

    await db.flush()

    # Publish event
    await event_bus.publish(EVENT_TASK_STATUS_CHANGED, {
        "task_id": str(task.id),
        "org_id": str(task.org_id),
        "old_status": old_status,
        "new_status": data.target_status,
        "user_id": str(current_user.id),
    })

    user_name = None
    if task.assigned_user_id:
        user_result = await db.execute(select(User.full_name).where(User.id == task.assigned_user_id))
        user_name = user_result.scalar_one_or_none()

    return task_to_response(task, user_name)
