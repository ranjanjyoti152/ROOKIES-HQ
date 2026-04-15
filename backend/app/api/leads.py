from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.lead import Lead, LeadFollowup
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.models.tag import Tag, task_tags
from app.models.leaderboard import LeaderboardEntry
from app.dependencies import get_current_user, require_roles
from app.schemas.lead import (
    LeadCreate,
    LeadUpdate,
    LeadTransition,
    FollowupCreate,
    LeadResponse,
    FollowupResponse,
    LeadsSummaryResponse,
)
from app.core.exceptions import InvalidTransitionException
from app.core.events import event_bus, EVENT_LEAD_STATUS_CHANGED, EVENT_LEAD_CONVERTED

router = APIRouter(prefix="/leads", tags=["leads"])


def _lead_to_response(lead: Lead, assigned_user_name: str | None = None) -> LeadResponse:
    return LeadResponse(
        id=lead.id,
        org_id=lead.org_id,
        name=lead.name,
        email=lead.email,
        contact_email=lead.contact_email,
        phone=lead.phone,
        company=lead.company,
        source=lead.source,
        site_url=lead.site_url,
        reference_link=lead.reference_link,
        priority=lead.priority,
        niche=lead.niche,
        custom_comments=lead.custom_comments,
        description=lead.description,
        task_tags=lead.task_tags or [],
        niche_tags=lead.niche_tags or [],
        status=lead.status,
        value=float(lead.value) if lead.value else None,
        notes=lead.notes,
        assigned_user_id=lead.assigned_user_id,
        assigned_user_name=assigned_user_name,
        converted_project_id=lead.converted_project_id,
        converted_task_id=lead.converted_task_id,
        converted_at=lead.converted_at,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
    )


async def _ensure_tag(db: AsyncSession, org_id, name: str, *, kind: str, color: str = "#f97316") -> Tag:
    existing_result = await db.execute(
        select(Tag).where(Tag.org_id == org_id, Tag.name == name, Tag.kind == kind)
    )
    tag = existing_result.scalar_one_or_none()
    if tag:
        return tag

    tag = Tag(org_id=org_id, name=name, kind=kind, color=color)
    db.add(tag)
    await db.flush()
    return tag


async def _ensure_conversion_for_lead(db: AsyncSession, lead: Lead, acting_user: User):
    """Idempotent lead -> project -> task conversion."""
    if lead.converted_project_id and lead.converted_task_id:
        return lead.converted_project_id, lead.converted_task_id

    project_tag = await _ensure_tag(
        db,
        acting_user.org_id,
        name=f"{lead.name} Tag",
        kind="project",
    )

    project = Project(
        org_id=acting_user.org_id,
        name=lead.name,
        client_name=lead.company or lead.name,
        description=lead.description or lead.notes or f"Auto-created from lead: {lead.name}",
        status="active",
        project_tag_id=project_tag.id,
        tag_key=f"lead-{str(lead.id).split('-')[0]}",
        lead_id=lead.id,
    )
    db.add(project)
    await db.flush()

    inherited_description_parts = [
        lead.description or "",
        lead.notes or "",
        f"Contact: {lead.contact_email or lead.email or 'n/a'}",
        f"Reference: {lead.reference_link or lead.site_url or 'n/a'}",
        f"Company/Channel: {lead.company or 'n/a'}",
    ]
    task = Task(
        org_id=acting_user.org_id,
        project_id=project.id,
        title=f"{lead.name} - Initial Unassigned Task",
        description="\n".join([p for p in inherited_description_parts if p]).strip(),
        created_by_user_id=acting_user.id,
        status="unassigned",
        priority=lead.priority or "medium",
        attachment_link=lead.reference_link or lead.site_url,
        is_private=False,
    )
    db.add(task)
    await db.flush()

    inherited_tag_names = set((lead.task_tags or []) + (lead.niche_tags or []))
    if lead.niche:
        inherited_tag_names.add(lead.niche)

    if inherited_tag_names:
        tag_ids = set()
        lead_niche_tags = set(lead.niche_tags or [])
        for tag_name in inherited_tag_names:
            clean = (tag_name or "").strip()
            if not clean:
                continue
            kind = "niche" if clean in lead_niche_tags or clean == lead.niche else "task"
            tag = await _ensure_tag(db, acting_user.org_id, clean, kind=kind)
            tag_ids.add(tag.id)

        # Use direct association insert to avoid async lazy-load on relationship assignment.
        if tag_ids:
            await db.execute(
                task_tags.insert(),
                [{"task_id": task.id, "tag_id": tag_id} for tag_id in tag_ids],
            )

    lead.converted_project_id = project.id
    lead.converted_task_id = task.id
    lead.converted_at = datetime.now(timezone.utc)

    return project.id, task.id


@router.get("/summary", response_model=LeadsSummaryResponse)
async def leads_summary(
    current_user: User = Depends(require_roles("admin", "manager", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    pipeline_result = await db.execute(
        select(func.coalesce(func.sum(Lead.value), 0)).where(
            Lead.org_id == current_user.org_id,
            Lead.status != "closed",
        )
    )
    closed_result = await db.execute(
        select(func.coalesce(func.sum(Lead.value), 0)).where(
            Lead.org_id == current_user.org_id,
            Lead.status == "closed",
        )
    )
    return LeadsSummaryResponse(
        pipeline_value=float(pipeline_result.scalar() or 0),
        closed_value=float(closed_result.scalar() or 0),
    )


@router.get("", response_model=List[LeadResponse])
async def list_leads(
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(require_roles("admin", "manager", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """List all leads for leads funnel view."""
    query = select(Lead).where(Lead.org_id == current_user.org_id)
    if status_filter:
        query = query.where(Lead.status == status_filter)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            Lead.name.ilike(pattern)
            | Lead.company.ilike(pattern)
            | Lead.email.ilike(pattern)
            | Lead.contact_email.ilike(pattern)
        )

    query = query.order_by(Lead.created_at.desc())
    result = await db.execute(query)
    leads = result.scalars().all()

    normalized_any = False
    responses = []
    for lead in leads:
        normalized_status = Lead.normalize_status(lead.status)
        if normalized_status != lead.status:
            lead.status = normalized_status
            normalized_any = True
        user_name = None
        if lead.assigned_user_id:
            u = await db.execute(select(User.nickname, User.full_name).where(User.id == lead.assigned_user_id))
            user_row = u.first()
            if user_row:
                user_name = user_row.nickname or user_row.full_name
        responses.append(_lead_to_response(lead, user_name))
    if normalized_any:
        await db.flush()
    return responses


@router.post("", response_model=LeadResponse, status_code=201)
async def create_lead(
    data: LeadCreate,
    current_user: User = Depends(require_roles("admin", "manager", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new lead (quick add + full add)."""
    lead = Lead(
        org_id=current_user.org_id,
        name=data.name,
        email=data.email,
        contact_email=data.contact_email,
        phone=data.phone,
        company=data.company,
        source=data.source,
        site_url=data.site_url,
        reference_link=data.reference_link,
        priority=data.priority,
        niche=data.niche,
        custom_comments=data.custom_comments,
        description=data.description,
        task_tags=data.task_tags or [],
        niche_tags=data.niche_tags or [],
        value=data.value,
        notes=data.notes,
        assigned_user_id=data.assigned_user_id,
    )
    db.add(lead)
    await db.flush()

    return _lead_to_response(lead)


@router.put("/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: UUID,
    data: LeadUpdate,
    current_user: User = Depends(require_roles("admin", "manager", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """Update lead details from full edit modal."""
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.org_id == current_user.org_id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lead, field, value)

    await db.flush()
    return _lead_to_response(lead)


@router.post("/{lead_id}/transition")
async def transition_lead(
    lead_id: UUID,
    data: LeadTransition,
    current_user: User = Depends(require_roles("admin", "manager", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """Move lead through the new 8-stage funnel."""
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.org_id == current_user.org_id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    current_status = Lead.normalize_status(lead.status)
    target_status = Lead.normalize_status(data.target_status)
    if lead.status != current_status:
        lead.status = current_status

    if not lead.can_transition_to(target_status):
        raise InvalidTransitionException(current_status, target_status)

    old_status = current_status
    lead.status = target_status

    project_id = task_id = None
    if target_status in ("vfa_send", "client_won"):
        project_id, task_id = await _ensure_conversion_for_lead(db, lead, current_user)
        # sales positive signal
        if lead.assigned_user_id:
            db.add(
                LeaderboardEntry(
                    org_id=lead.org_id,
                    user_id=lead.assigned_user_id,
                    points=12,
                    reason="Successful VFA",
                    category="successful_vfa",
                    is_penalty=False,
                    entry_type="auto",
                    reference_type="lead",
                    reference_id=lead.id,
                    meta={"target_status": target_status},
                )
            )

    await db.flush()

    await event_bus.publish(EVENT_LEAD_STATUS_CHANGED, {
        "lead_id": str(lead.id),
        "org_id": str(lead.org_id),
        "old_status": old_status,
        "new_status": target_status,
    })

    payload = {"message": f"Lead moved to '{target_status}'", "lead_id": str(lead.id)}
    if project_id:
        payload["project_id"] = str(project_id)
    if task_id:
        payload["task_id"] = str(task_id)
    return payload


@router.post("/{lead_id}/followup", response_model=FollowupResponse, status_code=201)
async def add_followup(
    lead_id: UUID,
    data: FollowupCreate,
    current_user: User = Depends(require_roles("admin", "manager", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """Add a follow-up note to a lead."""
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.org_id == current_user.org_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Lead not found")

    followup = LeadFollowup(
        lead_id=lead_id,
        user_id=current_user.id,
        note=data.note,
        follow_up_date=data.follow_up_date,
    )
    db.add(followup)
    await db.flush()

    return FollowupResponse(
        id=followup.id,
        lead_id=followup.lead_id,
        user_id=followup.user_id,
        user_name=current_user.nickname or current_user.full_name,
        note=followup.note,
        follow_up_date=followup.follow_up_date,
        created_at=followup.created_at,
    )


@router.post("/{lead_id}/convert")
async def convert_lead(
    lead_id: UUID,
    current_user: User = Depends(require_roles("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Explicit lead conversion endpoint (kept for backwards compatibility)."""
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.org_id == current_user.org_id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    project_id, task_id = await _ensure_conversion_for_lead(db, lead, current_user)

    # Closed sale points on explicit convert
    if lead.assigned_user_id:
        db.add(
            LeaderboardEntry(
                org_id=lead.org_id,
                user_id=lead.assigned_user_id,
                points=15,
                reason="Closed Sale",
                category="closed_sale",
                is_penalty=False,
                entry_type="auto",
                reference_type="lead",
                reference_id=lead.id,
                meta={},
            )
        )

    lead.status = "closed"
    await db.flush()

    await event_bus.publish(EVENT_LEAD_CONVERTED, {
        "lead_id": str(lead.id),
        "org_id": str(lead.org_id),
        "project_id": str(project_id),
    })

    return {
        "message": "Lead converted successfully",
        "project_id": str(project_id),
        "task_id": str(task_id),
    }
