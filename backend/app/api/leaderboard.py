from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case

from app.database import get_db
from app.models.leaderboard import LeaderboardEntry
from app.models.user import User
from app.dependencies import get_current_user, require_roles

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("")
async def get_leaderboard(
    period: str = Query("weekly", regex="^(daily|weekly|monthly)$"),
    current_user: User = Depends(require_roles("admin", "manager", "editor", "hr", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """Get leaderboard rankings for a period including active/penalty breakdown."""
    now = datetime.now(timezone.utc)
    if period == "daily":
        since = now - timedelta(days=1)
    elif period == "weekly":
        since = now - timedelta(weeks=1)
    else:
        since = now - timedelta(days=30)

    query = (
        select(
            LeaderboardEntry.user_id,
            User.full_name,
            User.nickname,
            User.avatar_url,
            User.role,
            func.sum(LeaderboardEntry.points).label("total_points"),
            func.sum(case((LeaderboardEntry.points > 0, LeaderboardEntry.points), else_=0)).label("active_points"),
            func.sum(case((LeaderboardEntry.points < 0, LeaderboardEntry.points), else_=0)).label("penalty_points"),
            func.count(LeaderboardEntry.id).label("entry_count"),
        )
        .join(User, LeaderboardEntry.user_id == User.id)
        .where(
            LeaderboardEntry.org_id == current_user.org_id,
            LeaderboardEntry.created_at >= since,
        )
        .group_by(LeaderboardEntry.user_id, User.full_name, User.nickname, User.avatar_url, User.role)
        .order_by(func.sum(LeaderboardEntry.points).desc())
    )

    result = await db.execute(query)
    rows = result.all()

    rankings = []
    for i, row in enumerate(rows, 1):
        rankings.append({
            "rank": i,
            "user_id": str(row.user_id),
            "full_name": row.full_name,
            "nickname": row.nickname,
            "display_name": row.nickname or row.full_name,
            "avatar_url": row.avatar_url,
            "role": row.role,
            "total_points": float(row.total_points or 0),
            "active_points": float(row.active_points or 0),
            "penalty_points": abs(float(row.penalty_points or 0)),
            "entry_count": row.entry_count,
        })

    return {"period": period, "rankings": rankings}


@router.get("/events")
async def list_point_events(
    user_id: str | None = None,
    limit: int = 100,
    current_user: User = Depends(require_roles("admin", "manager", "hr")),
    db: AsyncSession = Depends(get_db),
):
    query = select(LeaderboardEntry).where(LeaderboardEntry.org_id == current_user.org_id).order_by(LeaderboardEntry.created_at.desc()).limit(limit)
    if user_id:
        query = query.where(LeaderboardEntry.user_id == user_id)

    result = await db.execute(query)
    rows = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "user_id": str(r.user_id),
            "points": float(r.points),
            "reason": r.reason,
            "category": r.category,
            "is_penalty": r.is_penalty,
            "entry_type": r.entry_type,
            "reference_type": r.reference_type,
            "reference_id": str(r.reference_id) if r.reference_id else None,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.post("/adjust")
async def add_manual_points(
    payload: dict,
    current_user: User = Depends(require_roles("admin", "manager", "hr")),
    db: AsyncSession = Depends(get_db),
):
    """Manual manager adjustments for point system."""
    user_id = payload.get("user_id")
    points = float(payload.get("points", 0))
    reason = (payload.get("reason") or "Manual adjustment").strip()
    category = payload.get("category") or "manual"

    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    if points == 0:
        raise HTTPException(status_code=400, detail="points must be non-zero")

    user_result = await db.execute(select(User).where(User.id == user_id, User.org_id == current_user.org_id))
    target = user_result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    entry = LeaderboardEntry(
        org_id=current_user.org_id,
        user_id=target.id,
        points=points,
        reason=reason,
        category=category,
        is_penalty=points < 0,
        entry_type="manual",
        reference_type="user",
        reference_id=target.id,
        meta={"actor_id": str(current_user.id)},
    )
    db.add(entry)
    await db.flush()

    return {
        "message": "Manual point adjustment applied",
        "entry_id": str(entry.id),
        "user_id": str(target.id),
        "points": float(entry.points),
    }
