import re
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, func
from typing import List, Optional

from app.database import get_db
from app.models.project import Project
from app.models.project_members import ProjectMember
from app.models.task import Task
from app.models.tag import Tag, project_tags
from app.models.user import User
from app.models.notification import Notification
from app.core.email import send_project_assigned_email
from app.core.tag_acl import get_user_assigned_tag_ids, apply_project_scope
from app.dependencies import get_current_user, require_roles
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectStatsResponse

router = APIRouter(prefix="/projects", tags=["projects"])


def _generate_tag_key(name: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", (name or "project").lower()).strip("-")[:24]
    suffix = str(uuid4()).split("-")[0]
    return f"{cleaned}-{suffix}" if cleaned else f"project-{suffix}"


async def _project_to_response(db: AsyncSession, project: Project) -> ProjectResponse:
    task_count_result = await db.execute(select(func.count(Task.id)).where(Task.project_id == project.id))
    task_count = int(task_count_result.scalar() or 0)
    project_tag_name = project.project_tag.name if project.project_tag else None
    client_tags = [t.name for t in (project.tags or []) if t.kind == "client"]

    return ProjectResponse(
        id=project.id,
        org_id=project.org_id,
        name=project.name,
        tag_key=project.tag_key,
        project_tag_id=project.project_tag_id,
        project_tag=project_tag_name,
        client_tags=client_tags,
        lead_origin=str(project.lead_id) if project.lead_id else None,
        task_count=task_count,
        client_name=project.client_name,
        description=project.description,
        status=project.status,
        assigned_members=project.assigned_members or [],
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    status_filter: Optional[str] = None,
    tag_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List projects for the organization using tag-first access control."""
    query = (
        select(Project)
        .options(
            selectinload(Project.assigned_members),
            selectinload(Project.tags),
            selectinload(Project.project_tag),
        )
        .where(Project.org_id == current_user.org_id)
    )

    if status_filter:
        query = query.where(Project.status == status_filter)

    if tag_id:
        query = query.where(
            (Project.project_tag_id == tag_id)
            | (Project.id.in_(select(project_tags.c.project_id).where(project_tags.c.tag_id == tag_id)))
        )

    assigned_tag_ids = await get_user_assigned_tag_ids(db, current_user)
    query = apply_project_scope(query, current_user, assigned_tag_ids)

    query = query.order_by(Project.created_at.desc())
    result = await db.execute(query)
    projects = result.scalars().all()

    return [await _project_to_response(db, p) for p in projects]


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles("admin", "manager", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new project with auto project-tag generation."""
    project_tag: Tag | None = None

    if data.project_tag_id:
        tag_result = await db.execute(
            select(Tag).where(Tag.id == data.project_tag_id, Tag.org_id == current_user.org_id)
        )
        project_tag = tag_result.scalar_one_or_none()
        if not project_tag:
            raise HTTPException(status_code=404, detail="Project tag not found")
    else:
        project_tag = Tag(
            org_id=current_user.org_id,
            name=f"{data.name} Tag",
            color="#f97316",
            kind="project",
        )
        db.add(project_tag)
        await db.flush()

    project = Project(
        org_id=current_user.org_id,
        name=data.name,
        client_name=data.client_name,
        description=data.description,
        status=data.status,
        project_tag_id=project_tag.id,
        tag_key=_generate_tag_key(data.name),
        lead_id=data.lead_id,
    )
    db.add(project)
    await db.flush()

    # Attach explicit project tags/client tags
    if data.client_tag_ids:
        client_tags_result = await db.execute(
            select(Tag).where(Tag.org_id == current_user.org_id, Tag.id.in_(data.client_tag_ids))
        )
        for tag in client_tags_result.scalars().all():
            if tag not in project.tags:
                project.tags.append(tag)

    if data.tag_ids:
        generic_tags_result = await db.execute(
            select(Tag).where(Tag.org_id == current_user.org_id, Tag.id.in_(data.tag_ids))
        )
        for tag in generic_tags_result.scalars().all():
            if tag not in project.tags:
                project.tags.append(tag)

    if data.member_ids:
        members_query = await db.execute(
            select(User).where(
                User.id.in_(data.member_ids),
                User.org_id == current_user.org_id,
            )
        )
        for member in members_query.scalars().all():
            db.add(ProjectMember(project_id=project.id, user_id=member.id, status="pending"))
            db.add(Notification(
                org_id=project.org_id,
                user_id=member.id,
                type="project_assignment",
                title="New Project Assignment",
                message=f"You have been assigned to the '{project.name}' project.",
                reference_type="project",
                reference_id=project.id,
            ))
            background_tasks.add_task(send_project_assigned_email, member.email, project.name, member.full_name)

    await db.flush()
    await db.refresh(project, ["assigned_members", "tags", "project_tag"])
    return await _project_to_response(db, project)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get project details with tag-first access control."""
    query = (
        select(Project)
        .options(
            selectinload(Project.memberships),
            selectinload(Project.assigned_members),
            selectinload(Project.tags),
            selectinload(Project.project_tag),
        )
        .where(Project.id == project_id, Project.org_id == current_user.org_id)
    )
    assigned_tag_ids = await get_user_assigned_tag_ids(db, current_user)
    query = apply_project_scope(query, current_user, assigned_tag_ids)

    result = await db.execute(query)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return await _project_to_response(db, project)


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
        select(Project)
        .options(selectinload(Project.memberships), selectinload(Project.assigned_members), selectinload(Project.tags), selectinload(Project.project_tag))
        .where(Project.id == project_id, Project.org_id == current_user.org_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = data.model_dump(exclude_unset=True)

    if "project_tag_id" in update_data and update_data["project_tag_id"]:
        tag_result = await db.execute(
            select(Tag).where(Tag.id == update_data["project_tag_id"], Tag.org_id == current_user.org_id)
        )
        tag = tag_result.scalar_one_or_none()
        if not tag:
            raise HTTPException(status_code=404, detail="Project tag not found")
        project.project_tag_id = tag.id

    if "client_tag_ids" in update_data and update_data["client_tag_ids"] is not None:
        tag_result = await db.execute(
            select(Tag).where(Tag.org_id == current_user.org_id, Tag.id.in_(update_data["client_tag_ids"]))
        )
        selected = list(tag_result.scalars().all())
        # Replace only client tags; keep other tags
        existing_non_client = [t for t in (project.tags or []) if t.kind != "client"]
        project.tags = existing_non_client + selected

    if "member_ids" in update_data:
        existing_memberships_result = await db.execute(
            select(ProjectMember).where(ProjectMember.project_id == project.id)
        )
        existing_memberships = {str(m.user_id): m for m in existing_memberships_result.scalars().all()}
        member_ids = update_data.pop("member_ids")
        members_query = await db.execute(
            select(User).where(
                User.id.in_(member_ids),
                User.org_id == current_user.org_id,
            )
        )
        new_users = members_query.scalars().all()
        new_user_ids = {str(u.id) for u in new_users}

        for user_id_str, membership in existing_memberships.items():
            if user_id_str not in new_user_ids:
                await db.delete(membership)

        for member in new_users:
            if str(member.id) not in existing_memberships:
                db.add(ProjectMember(project_id=project.id, user_id=member.id, status="pending"))
                db.add(Notification(
                    org_id=project.org_id,
                    user_id=member.id,
                    type="project_assignment",
                    title="New Project Assignment",
                    message=f"You have been assigned to the '{project.name}' project.",
                    reference_type="project",
                    reference_id=project.id,
                ))
                background_tasks.add_task(send_project_assigned_email, member.email, project.name, member.full_name)

    for field, value in update_data.items():
        setattr(project, field, value)

    await db.flush()
    await db.refresh(project, ["assigned_members", "tags", "project_tag"])
    return await _project_to_response(db, project)


@router.delete("/{project_id}")
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Archive a project. Admin only."""
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
    project_result = await db.execute(
        select(Project).where(Project.id == project_id, Project.org_id == current_user.org_id)
    )
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    assigned_tag_ids = await get_user_assigned_tag_ids(db, current_user)
    if current_user.role != "admin":
        can_view = project.project_tag_id in set(assigned_tag_ids)
        if not can_view:
            linked_tags = {t.id for t in project.tags}
            can_view = bool(linked_tags.intersection(set(assigned_tag_ids)))
        if not can_view:
            raise HTTPException(status_code=404, detail="Project not found")

    base = select(Task).where(Task.project_id == project_id, Task.org_id == current_user.org_id)

    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar() or 0

    sf_result = await db.execute(
        select(func.count()).select_from(
            base.where(Task.task_type == "short_form").subquery()
        )
    )
    short_form = sf_result.scalar() or 0

    lf_result = await db.execute(
        select(func.count()).select_from(
            base.where(Task.task_type == "long_form").subquery()
        )
    )
    long_form = lf_result.scalar() or 0

    rev_result = await db.execute(
        select(func.count()).select_from(
            base.where(Task.status == "revision").subquery()
        )
    )
    revision = rev_result.scalar() or 0

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
            ProjectMember.user_id == current_user.id,
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
            ProjectMember.user_id == current_user.id,
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")

    membership.status = "rejected"

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
                message=f"{current_user.full_name} has rejected their assignment to the '{project.name}' project.",
            ))

    await db.flush()
    return {"message": "Project rejected"}
