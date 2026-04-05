from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, func
from typing import List, Optional
from uuid import UUID
from app.database import get_db
from app.models.project import Project
from app.models.project_members import ProjectMember
from app.models.task import Task
from app.models.user import User
from app.models.notification import Notification
from app.core.email import send_project_assigned_email
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
    query = select(Project).options(selectinload(Project.assigned_members)).where(Project.org_id == current_user.org_id)

    if status_filter:
        query = query.where(Project.status == status_filter)

    # Editors only see projects where they have assigned tasks or are assigned members
    if current_user.role == "editor":
        subq = select(Task.project_id).where(Task.assigned_user_id == current_user.id).distinct()
        query = query.where(
            Project.id.in_(subq) | Project.assigned_members.any(User.id == current_user.id)
        )

    query = query.order_by(Project.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    background_tasks: BackgroundTasks,
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
    if data.member_ids:
        members_query = await db.execute(select(User).where(User.id.in_(data.member_ids)))
        for member in members_query.scalars().all():
            project.memberships.append(ProjectMember(user_id=member.id, status="pending"))
            db.add(Notification(
                org_id=project.org_id,
                user_id=member.id,
                type="project_assignment",
                title="New Project Assignment",
                message=f"You have been assigned to the '{project.name}' project.",
                reference_type="project",
                reference_id=project.id
            ))
            background_tasks.add_task(send_project_assigned_email, member.email, project.name, member.full_name)

    db.add(project)
    await db.flush()
    # Need to load assigned_members explicitly to return them 
    await db.refresh(project, ["assigned_members"])
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get project details."""
    result = await db.execute(
        select(Project).options(selectinload(Project.memberships), selectinload(Project.assigned_members)).where(Project.id == project_id, Project.org_id == current_user.org_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Update a project."""
    result = await db.execute(
        select(Project).options(selectinload(Project.memberships), selectinload(Project.assigned_members)).where(Project.id == project_id, Project.org_id == current_user.org_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = data.model_dump(exclude_unset=True)
    if "member_ids" in update_data:
        existing_memberships = {str(m.user_id): m for m in project.memberships} if project.memberships else {}
        member_ids = update_data.pop("member_ids")
        members_query = await db.execute(select(User).where(User.id.in_(member_ids)))
        new_users = members_query.scalars().all()
        new_user_ids = {str(u.id) for u in new_users}

        # Remove old memberships
        for user_id_str, membership in list(existing_memberships.items()):
            if user_id_str not in new_user_ids:
                project.memberships.remove(membership)

        # Add new memberships
        for member in new_users:
            if str(member.id) not in existing_memberships:
                project.memberships.append(ProjectMember(user_id=member.id, status="pending"))
                db.add(Notification(
                    org_id=project.org_id,
                    user_id=member.id,
                    type="project_assignment",
                    title="New Project Assignment",
                    message=f"You have been assigned to the '{project.name}' project.",
                    reference_type="project",
                    reference_id=project.id
                ))
                background_tasks.add_task(send_project_assigned_email, member.email, project.name, member.full_name)

    for field, value in update_data.items():
        setattr(project, field, value)

    await db.flush()
    await db.refresh(project, ["assigned_members"])
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


@router.post("/{project_id}/members/accept")
async def accept_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept a project assignment."""
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == current_user.id
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")

    if membership.status == "accepted":
        return {"message": "Already accepted"}
        
    membership.status = "accepted"
    await db.flush()
    return {"message": "Project accepted successfully"}


@router.post("/{project_id}/members/reject")
async def reject_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject a project assignment."""
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == current_user.id
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")

    membership.status = "rejected"
    
    # Notify admins/managers
    project_result = await db.execute(select(Project).where(Project.id == project_id))
    project = project_result.scalar_one_or_none()
    
    if project:
        admins_result = await db.execute(
            select(User).where(User.org_id == current_user.org_id, User.role.in_(["admin", "manager"]))
        )
        for admin in admins_result.scalars().all():
            db.add(Notification(
                org_id=current_user.org_id,
                user_id=admin.id,
                type="project_rejection",
                title="Project Assignment Rejected",
                message=f"{current_user.full_name} has rejected their assignment to the '{project.name}' project."
            ))
    
    await db.flush()
    return {"message": "Project rejected"}

