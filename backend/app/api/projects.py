from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from uuid import UUID
from app.database import get_db
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.dependencies import get_current_user, require_roles
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectStatsResponse

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List projects for the organization. Editors see only assigned projects."""
    query = select(Project).where(Project.org_id == current_user.org_id)

    if status_filter:
        query = query.where(Project.status == status_filter)

    # Editors only see projects where they have assigned tasks
    if current_user.role == "editor":
        subq = select(Task.project_id).where(Task.assigned_user_id == current_user.id).distinct()
        query = query.where(Project.id.in_(subq))

    query = query.order_by(Project.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    current_user: User = Depends(require_roles("admin", "manager", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new project."""
    project = Project(
        org_id=current_user.org_id,
        name=data.name,
        client_name=data.client_name,
        description=data.description,
        status=data.status,
    )
    db.add(project)
    await db.flush()
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get project details."""
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.org_id == current_user.org_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    current_user: User = Depends(require_roles("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Update a project."""
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.org_id == current_user.org_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)

    await db.flush()
    return project


@router.delete("/{project_id}")
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Delete (archive) a project. Admin only."""
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.org_id == current_user.org_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.status = "archived"
    await db.flush()
    return {"message": "Project archived"}


@router.get("/{project_id}/stats", response_model=ProjectStatsResponse)
async def get_project_stats(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get project task statistics."""
    base = select(Task).where(Task.project_id == project_id, Task.org_id == current_user.org_id)

    # Total
    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar() or 0

    # Short form count
    sf_result = await db.execute(
        select(func.count()).select_from(
            base.where(Task.task_type == "short_form").subquery()
        )
    )
    short_form = sf_result.scalar() or 0

    # Long form count
    lf_result = await db.execute(
        select(func.count()).select_from(
            base.where(Task.task_type == "long_form").subquery()
        )
    )
    long_form = lf_result.scalar() or 0

    # Revision count
    rev_result = await db.execute(
        select(func.count()).select_from(
            base.where(Task.status == "revision").subquery()
        )
    )
    revision = rev_result.scalar() or 0

    # Completed (closed)
    comp_result = await db.execute(
        select(func.count()).select_from(
            base.where(Task.status == "closed").subquery()
        )
    )
    completed = comp_result.scalar() or 0

    completion_pct = (completed / total * 100) if total > 0 else 0.0

    return ProjectStatsResponse(
        total_tasks=total,
        short_form_count=short_form,
        long_form_count=long_form,
        revision_count=revision,
        completed_count=completed,
        completion_percentage=round(completion_pct, 1),
    )
