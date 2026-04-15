from __future__ import annotations

from typing import Sequence
from sqlalchemy import select, or_, false
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.project import Project
from app.models.task import Task
from app.models.project_members import ProjectMember
from app.models.tag import project_tags
from app.models.user_tag_assignment import UserTagAssignment


async def get_user_assigned_tag_ids(db: AsyncSession, user: User) -> list:
    """Return assigned tag ids for a user. Admin has unrestricted access."""
    if user.role == "admin":
        return []

    result = await db.execute(
        select(UserTagAssignment.tag_id).where(UserTagAssignment.user_id == user.id)
    )
    assigned = list(result.scalars().all())
    if assigned:
        return assigned

    # Backward-compatible bootstrap: derive tag scope from existing assignments.
    project_tag_result = await db.execute(
        select(Project.project_tag_id)
        .where(
            Project.org_id == user.org_id,
            Project.id.in_(
                select(ProjectMember.project_id).where(
                    ProjectMember.user_id == user.id,
                    ProjectMember.status != "rejected",
                )
            ),
            Project.project_tag_id.isnot(None),
        )
        .distinct()
    )
    derived = {tag_id for tag_id in project_tag_result.scalars().all() if tag_id}

    task_tag_result = await db.execute(
        select(Project.project_tag_id)
        .join(Task, Task.project_id == Project.id)
        .where(
            Task.org_id == user.org_id,
            Task.assigned_user_id == user.id,
            Project.project_tag_id.isnot(None),
        )
        .distinct()
    )
    derived.update({tag_id for tag_id in task_tag_result.scalars().all() if tag_id})
    return list(derived)


def apply_project_scope(query, user: User, assigned_tag_ids: Sequence):
    """Apply tag-first project visibility. Admin bypasses restrictions."""
    if user.role == "admin":
        return query

    if not assigned_tag_ids:
        return query.where(false())

    return query.where(
        or_(
            Project.project_tag_id.in_(assigned_tag_ids),
            Project.id.in_(
                select(project_tags.c.project_id).where(project_tags.c.tag_id.in_(assigned_tag_ids))
            ),
        )
    )


def accessible_project_ids_subquery(assigned_tag_ids: Sequence):
    """Subquery of project ids visible via assigned tags."""
    if not assigned_tag_ids:
        return select(Project.id).where(false())

    return select(Project.id).where(
        or_(
            Project.project_tag_id.in_(assigned_tag_ids),
            Project.id.in_(
                select(project_tags.c.project_id).where(project_tags.c.tag_id.in_(assigned_tag_ids))
            ),
        )
    )
