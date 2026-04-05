from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
from app.database import get_db
from app.models.automation_rule import AutomationRule
from app.models.user import User
from app.dependencies import get_current_user, require_roles
from app.schemas.automation import AutomationCreate, AutomationUpdate, AutomationResponse

router = APIRouter(prefix="/automations", tags=["automations"])


@router.get("", response_model=List[AutomationResponse])
async def list_automations(
    current_user: User = Depends(require_roles("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AutomationRule)
        .where(AutomationRule.org_id == current_user.org_id)
        .order_by(AutomationRule.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=AutomationResponse, status_code=201)
async def create_automation(
    data: AutomationCreate,
    current_user: User = Depends(require_roles("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    rule = AutomationRule(
        org_id=current_user.org_id,
        name=data.name,
        trigger_type=data.trigger_type,
        trigger_config=data.trigger_config,
        condition_config=data.condition_config,
        action_type=data.action_type,
        action_config=data.action_config,
    )
    db.add(rule)
    await db.flush()
    return rule


@router.put("/{rule_id}", response_model=AutomationResponse)
async def update_automation(
    rule_id: UUID,
    data: AutomationUpdate,
    current_user: User = Depends(require_roles("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AutomationRule).where(AutomationRule.id == rule_id, AutomationRule.org_id == current_user.org_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Automation rule not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)

    await db.flush()
    return rule


@router.delete("/{rule_id}")
async def delete_automation(
    rule_id: UUID,
    current_user: User = Depends(require_roles("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AutomationRule).where(AutomationRule.id == rule_id, AutomationRule.org_id == current_user.org_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Automation rule not found")

    await db.delete(rule)
    await db.flush()
    return {"message": "Automation rule deleted"}


@router.post("/{rule_id}/toggle")
async def toggle_automation(
    rule_id: UUID,
    current_user: User = Depends(require_roles("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AutomationRule).where(AutomationRule.id == rule_id, AutomationRule.org_id == current_user.org_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Automation rule not found")

    rule.is_active = not rule.is_active
    await db.flush()
    return {"message": f"Automation {'enabled' if rule.is_active else 'disabled'}", "is_active": rule.is_active}
