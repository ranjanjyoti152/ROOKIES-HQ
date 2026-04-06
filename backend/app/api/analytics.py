from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case
from datetime import datetime, timezone, timedelta, date
from app.database import get_db
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.models.lead import Lead
from app.models.leaderboard import LeaderboardEntry
from app.dependencies import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


# ─────────────────────────────────────────────────────────
# ENDPOINT 1: 8 Stat Cards
# ─────────────────────────────────────────────────────────
@router.get("/dashboard")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org = current_user.org_id
    today = datetime.now(timezone.utc)

    # ── Tasks ──
    task_rows = await db.execute(
        select(Task.status, func.count().label("n"))
        .where(Task.org_id == org)
        .group_by(Task.status)
    )
    task_counts = {r.status: r.n for r in task_rows}
    total_tasks = sum(task_counts.values())
    delivered = task_counts.get("delivered", 0)
    closed = task_counts.get("closed", 0)

    # Active = everything NOT delivered/closed
    active_tasks = total_tasks - delivered - closed

    # Overdue = deadline < now AND not delivered/closed
    overdue_result = await db.execute(
        select(func.count()).where(
            and_(
                Task.org_id == org,
                Task.deadline < today,
                Task.status.notin_(["delivered", "closed"]),
            )
        )
    )
    overdue_tasks = overdue_result.scalar() or 0

    # Needs Review = revision stage
    needs_review = task_counts.get("revision", 0)

    # Completion Rate % = delivered / total
    completion_rate = round((delivered / total_tasks * 100) if total_tasks > 0 else 0, 1)

    # ── Leads ──
    lead_rows = await db.execute(
        select(Lead.status, func.count().label("n"))
        .where(Lead.org_id == org)
        .group_by(Lead.status)
    )
    lead_counts = {r.status: r.n for r in lead_rows}
    total_leads = sum(lead_counts.values())
    won_leads = lead_counts.get("client_won", 0)
    lead_conversion = round((won_leads / total_leads * 100) if total_leads > 0 else 0, 1)

    # ── Projects ──
    proj_result = await db.execute(
        select(func.count()).where(
            and_(Project.org_id == org, Project.status == "active")
        )
    )
    active_projects = proj_result.scalar() or 0

    # ── Team Members (active, non-client) ──
    team_result = await db.execute(
        select(func.count()).where(
            and_(
                User.org_id == org,
                User.is_active == True,
                User.role != "client",
            )
        )
    )
    team_members = team_result.scalar() or 0

    return {
        "active_tasks": active_tasks,
        "completed_tasks": delivered,
        "overdue_tasks": overdue_tasks,
        "lead_conversion": lead_conversion,
        "active_projects": active_projects,
        "team_members": team_members,
        "needs_review": needs_review,
        "completion_rate": completion_rate,
    }


# ─────────────────────────────────────────────────────────
# ENDPOINT 2: All Chart Datasets
# ─────────────────────────────────────────────────────────
@router.get("/charts")
async def get_charts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org = current_user.org_id
    today = datetime.now(timezone.utc)

    # ─── A: Tasks by Stage ───
    stage_order = ["unassigned", "claimed", "editing", "revision", "delivered"]
    task_rows = await db.execute(
        select(Task.status, func.count().label("n"))
        .where(Task.org_id == org, Task.status.in_(stage_order))
        .group_by(Task.status)
    )
    raw_stages = {r.status: r.n for r in task_rows}
    tasks_by_stage = {s: raw_stages.get(s, 0) for s in stage_order}

    # ─── B: Lead Pipeline ───
    lead_stages = ["new_lead", "follow_ups", "vfa", "client_won", "closed"]
    lead_rows = await db.execute(
        select(Lead.status, func.count().label("n"))
        .where(Lead.org_id == org)
        .group_by(Lead.status)
    )
    raw_leads = {r.status: r.n for r in lead_rows}
    lead_pipeline = {s: raw_leads.get(s, 0) for s in lead_stages}

    # ─── C: Completions last 7 days ───
    completions_7d = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        res = await db.execute(
            select(func.count()).where(
                and_(
                    Task.org_id == org,
                    Task.status == "delivered",
                    Task.updated_at >= day_start,
                    Task.updated_at < day_end,
                )
            )
        )
        completions_7d.append({
            "date": day.strftime("%b %d"),
            "count": res.scalar() or 0,
        })

    # ─── D: Team Workload ───
    user_rows = await db.execute(
        select(User)
        .where(
            and_(User.org_id == org, User.is_active == True, User.role != "client")
        )
    )
    users = user_rows.scalars().all()

    team_workload = []
    for u in users:
        task_count_res = await db.execute(
            select(func.count()).where(
                and_(
                    Task.org_id == org,
                    Task.assigned_user_id == u.id,
                    Task.status.notin_(["delivered", "closed"]),
                )
            )
        )
        task_count = task_count_res.scalar() or 0

        # Most recent active task name
        current_task_res = await db.execute(
            select(Task.title).where(
                and_(
                    Task.org_id == org,
                    Task.assigned_user_id == u.id,
                    Task.status.notin_(["delivered", "closed"]),
                )
            ).order_by(Task.updated_at.desc()).limit(1)
        )
        current_task = current_task_res.scalar()

        team_workload.append({
            "user_id": str(u.id),
            "name": u.full_name,
            "task_count": task_count,
            "current_task": current_task,
        })

    # Sort by task_count desc
    team_workload.sort(key=lambda x: x["task_count"], reverse=True)

    # ─── E: Top Performers ───
    perf_rows = await db.execute(
        select(
            User.id,
            User.full_name,
            func.sum(LeaderboardEntry.points).label("total_points"),
        )
        .join(LeaderboardEntry, LeaderboardEntry.user_id == User.id)
        .where(User.org_id == org)
        .group_by(User.id, User.full_name)
        .order_by(func.sum(LeaderboardEntry.points).desc())
        .limit(5)
    )
    top_performers = [
        {
            "rank": i + 1,
            "user_id": str(r.id),
            "name": r.full_name,
            "points": float(r.total_points or 0),
        }
        for i, r in enumerate(perf_rows.all())
    ]

    return {
        "tasks_by_stage": tasks_by_stage,
        "lead_pipeline": lead_pipeline,
        "completions_7d": completions_7d,
        "team_workload": team_workload,
        "top_performers": top_performers,
    }


# ─────────────────────────────────────────────────────────
# ENDPOINT 3: Heatmap (kept from original)
# ─────────────────────────────────────────────────────────
@router.get("/heatmap")
async def get_heatmap(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = datetime.now(timezone.utc).date()
    start_of_this_week = today - timedelta(days=today.weekday())
    start_date = start_of_this_week - timedelta(weeks=11)

    query = (
        select(
            func.date(LeaderboardEntry.created_at).label("d"),
            func.count(LeaderboardEntry.id).label("c"),
        )
        .where(
            LeaderboardEntry.user_id == current_user.id,
            LeaderboardEntry.created_at
            >= datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc),
        )
        .group_by(func.date(LeaderboardEntry.created_at))
    )

    result = await db.execute(query)
    rows = result.all()
    counts_by_date = {str(row.d): row.c for row in rows}

    heatmap = []
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    for i, day_name in enumerate(day_names):
        cells = []
        for week_idx in range(12):
            target_date = start_date + timedelta(weeks=week_idx, days=i)
            c = counts_by_date.get(str(target_date), 0)
            level = 0
            if c >= 5:
                level = 3
            elif c >= 2:
                level = 2
            elif c == 1:
                level = 1
            cells.append(level)
        heatmap.append({"day": day_name, "cells": cells})

    return heatmap
