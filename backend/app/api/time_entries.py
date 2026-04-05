from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone, timedelta
from app.database import get_db
from app.models.time_entry import TimeEntry
from app.models.user import User
from app.dependencies import get_current_user, require_roles
from app.schemas.time_entry import TimeEntryStart, TimeEntryStop, TimeEntryResponse, TimeReportEntry, TimeReportResponse

router = APIRouter(prefix="/time-entries", tags=["time-entries"])


@router.post("/start", response_model=TimeEntryResponse)
async def start_timer(
    data: TimeEntryStart,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually start a time entry for a task."""
    # Check for existing open entry
    existing = await db.execute(
        select(TimeEntry).where(
            TimeEntry.user_id == current_user.id,
            TimeEntry.task_id == data.task_id,
            TimeEntry.ended_at.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Timer already running for this task")

    entry = TimeEntry(
        org_id=current_user.org_id,
        user_id=current_user.id,
        task_id=data.task_id,
        started_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    await db.flush()
    return entry


@router.post("/stop", response_model=TimeEntryResponse)
async def stop_timer(
    data: TimeEntryStop,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stop the running timer for a task."""
    result = await db.execute(
        select(TimeEntry).where(
            TimeEntry.user_id == current_user.id,
            TimeEntry.task_id == data.task_id,
            TimeEntry.ended_at.is_(None),
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="No running timer found for this task")

    entry.ended_at = datetime.now(timezone.utc)
    entry.duration_seconds = int((entry.ended_at - entry.started_at).total_seconds())
    await db.flush()
    return entry


@router.get("/report", response_model=TimeReportResponse)
async def get_time_report(
    days: int = 7,
    user_id: Optional[UUID] = None,
    project_id: Optional[UUID] = None,
    current_user: User = Depends(require_roles("admin", "manager", "editor", "hr")),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated time report."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    query = (
        select(
            TimeEntry.user_id,
            User.full_name,
            func.coalesce(func.sum(TimeEntry.duration_seconds), 0).label("total_seconds"),
            func.count(func.distinct(TimeEntry.task_id)).label("task_count"),
        )
        .join(User, TimeEntry.user_id == User.id)
        .where(
            TimeEntry.org_id == current_user.org_id,
            TimeEntry.started_at >= since,
            TimeEntry.duration_seconds.isnot(None),
        )
    )

    # Editors can only see their own
    if current_user.role == "editor":
        query = query.where(TimeEntry.user_id == current_user.id)
    elif user_id:
        query = query.where(TimeEntry.user_id == user_id)

    query = query.group_by(TimeEntry.user_id, User.full_name)
    result = await db.execute(query)
    rows = result.all()

    entries = [
        TimeReportEntry(
            user_id=row.user_id,
            user_name=row.full_name,
            total_seconds=row.total_seconds,
            task_count=row.task_count,
        )
        for row in rows
    ]

    total = sum(e.total_seconds for e in entries)

    return TimeReportResponse(entries=entries, total_seconds=total)
