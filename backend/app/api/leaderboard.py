from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from datetime import datetime, timezone, timedelta
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
    """Get leaderboard rankings for a period."""
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
            User.avatar_url,
            User.role,
            func.sum(LeaderboardEntry.points).label("total_points"),
            func.count(LeaderboardEntry.id).label("entry_count"),
        )
        .join(User, LeaderboardEntry.user_id == User.id)
        .where(
            LeaderboardEntry.org_id == current_user.org_id,
            LeaderboardEntry.created_at >= since,
        )
        .group_by(LeaderboardEntry.user_id, User.full_name, User.avatar_url, User.role)
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
            "avatar_url": row.avatar_url,
            "role": row.role,
            "total_points": float(row.total_points),
            "entry_count": row.entry_count,
        })

    return {"period": period, "rankings": rankings}
