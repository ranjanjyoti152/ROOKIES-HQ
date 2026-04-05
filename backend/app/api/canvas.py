from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Any
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime
from app.database import get_db
from app.models.canvas_board import CanvasBoard
from app.models.user import User
from app.dependencies import get_current_user

router = APIRouter(prefix="/canvas", tags=["canvas"])


class CanvasSave(BaseModel):
    name: str = "My Canvas"
    items: List[Any] = []


class CanvasResponse(BaseModel):
    id: UUID
    name: str
    items: List[Any]
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


@router.get("", response_model=CanvasResponse)
async def get_canvas(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's canvas (auto-creates if not exists)."""
    result = await db.execute(
        select(CanvasBoard).where(
            CanvasBoard.org_id == current_user.org_id,
            CanvasBoard.user_id == current_user.id,
        )
    )
    board = result.scalar_one_or_none()

    if not board:
        board = CanvasBoard(
            org_id=current_user.org_id,
            user_id=current_user.id,
            name="My Canvas",
            items=[],
        )
        db.add(board)
        await db.flush()

    return board


@router.put("", response_model=CanvasResponse)
async def save_canvas(
    data: CanvasSave,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save (upsert) the user's canvas items."""
    result = await db.execute(
        select(CanvasBoard).where(
            CanvasBoard.org_id == current_user.org_id,
            CanvasBoard.user_id == current_user.id,
        )
    )
    board = result.scalar_one_or_none()

    if not board:
        board = CanvasBoard(
            org_id=current_user.org_id,
            user_id=current_user.id,
            name=data.name,
            items=data.items,
        )
        db.add(board)
    else:
        board.name = data.name
        board.items = data.items

    await db.flush()
    return board
