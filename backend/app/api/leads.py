from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID
from app.database import get_db
from app.models.lead import Lead, LeadFollowup
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.dependencies import get_current_user, require_roles
from app.schemas.lead import LeadCreate, LeadUpdate, LeadTransition, FollowupCreate, LeadResponse, FollowupResponse
from app.core.exceptions import InvalidTransitionException
from app.core.events import event_bus, EVENT_LEAD_STATUS_CHANGED, EVENT_LEAD_CONVERTED

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("", response_model=List[LeadResponse])
async def list_leads(
    status_filter: Optional[str] = None,
    current_user: User = Depends(require_roles("admin", "manager", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """List all leads."""
    query = select(Lead).where(Lead.org_id == current_user.org_id)
    if status_filter:
        query = query.where(Lead.status == status_filter)
    query = query.order_by(Lead.created_at.desc())

    result = await db.execute(query)
    leads = result.scalars().all()

    responses = []
    for lead in leads:
        user_name = None
        if lead.assigned_user_id:
            u = await db.execute(select(User.full_name).where(User.id == lead.assigned_user_id))
            user_name = u.scalar_one_or_none()
        responses.append(LeadResponse(
            id=lead.id, org_id=lead.org_id, name=lead.name, email=lead.email,
            phone=lead.phone, company=lead.company, source=lead.source,
            status=lead.status, value=float(lead.value) if lead.value else None,
            notes=lead.notes, assigned_user_id=lead.assigned_user_id,
            assigned_user_name=user_name,
            created_at=lead.created_at, updated_at=lead.updated_at,
        ))
    return responses


@router.post("", response_model=LeadResponse, status_code=201)
async def create_lead(
    data: LeadCreate,
    current_user: User = Depends(require_roles("admin", "manager", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new lead."""
    lead = Lead(
        org_id=current_user.org_id,
        name=data.name,
        email=data.email,
        phone=data.phone,
        company=data.company,
        source=data.source,
        value=data.value,
        notes=data.notes,
        assigned_user_id=data.assigned_user_id,
    )
    db.add(lead)
    await db.flush()

    return LeadResponse(
        id=lead.id, org_id=lead.org_id, name=lead.name, email=lead.email,
        phone=lead.phone, company=lead.company, source=lead.source,
        status=lead.status, value=float(lead.value) if lead.value else None,
        notes=lead.notes, assigned_user_id=lead.assigned_user_id,
        created_at=lead.created_at, updated_at=lead.updated_at,
    )


@router.put("/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: UUID,
    data: LeadUpdate,
    current_user: User = Depends(require_roles("admin", "manager", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """Update lead details."""
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.org_id == current_user.org_id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(lead, field, value)

    await db.flush()

    return LeadResponse(
        id=lead.id, org_id=lead.org_id, name=lead.name, email=lead.email,
        phone=lead.phone, company=lead.company, source=lead.source,
        status=lead.status, value=float(lead.value) if lead.value else None,
        notes=lead.notes, assigned_user_id=lead.assigned_user_id,
        created_at=lead.created_at, updated_at=lead.updated_at,
    )


@router.post("/{lead_id}/transition")
async def transition_lead(
    lead_id: UUID,
    data: LeadTransition,
    current_user: User = Depends(require_roles("admin", "manager", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """Move lead to next stage."""
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.org_id == current_user.org_id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if not lead.can_transition_to(data.target_status):
        raise InvalidTransitionException(lead.status, data.target_status)

    old_status = lead.status
    lead.status = data.target_status
    await db.flush()

    await event_bus.publish(EVENT_LEAD_STATUS_CHANGED, {
        "lead_id": str(lead.id),
        "org_id": str(lead.org_id),
        "old_status": old_status,
        "new_status": data.target_status,
    })

    return {"message": f"Lead moved to '{data.target_status}'", "lead_id": str(lead.id)}


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
        id=followup.id, lead_id=followup.lead_id, user_id=followup.user_id,
        user_name=current_user.full_name, note=followup.note,
        follow_up_date=followup.follow_up_date, created_at=followup.created_at,
    )


@router.post("/{lead_id}/convert")
async def convert_lead(
    lead_id: UUID,
    current_user: User = Depends(require_roles("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Convert 'client_won' lead → create project + unassigned task."""
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.org_id == current_user.org_id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if lead.status != "client_won":
        raise HTTPException(status_code=400, detail="Lead must be in 'client_won' status to convert")

    # Create project
    project = Project(
        org_id=current_user.org_id,
        name=f"{lead.name} Project",
        client_name=lead.company or lead.name,
        description=f"Auto-created from lead: {lead.name}",
    )
    db.add(project)
    await db.flush()

    # Create initial unassigned task
    task = Task(
        org_id=current_user.org_id,
        project_id=project.id,
        title=f"Initial setup for {lead.name}",
        status="unassigned",
    )
    db.add(task)

    # Close the lead
    lead.status = "closed"
    await db.flush()

    await event_bus.publish(EVENT_LEAD_CONVERTED, {
        "lead_id": str(lead.id),
        "org_id": str(lead.org_id),
        "project_id": str(project.id),
    })

    return {
        "message": "Lead converted successfully",
        "project_id": str(project.id),
        "task_id": str(task.id),
    }
