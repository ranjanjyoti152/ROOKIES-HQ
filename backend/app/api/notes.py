from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime
from app.database import get_db
from app.models.note import Note
from app.models.user import User
from app.dependencies import get_current_user
from app.core.tag_acl import get_user_assigned_tag_ids, accessible_project_ids_subquery

router = APIRouter(prefix="/notes", tags=["notes"])


class NoteCreate(BaseModel):
    title: str
    content: str = ""
    tags: List[str] = []
    project_id: Optional[UUID] = None


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    project_id: Optional[UUID] = None


class NoteResponse(BaseModel):
    id: UUID
    title: str
    content: str
    tags: List[str]
    project_id: Optional[UUID] = None
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


@router.get("", response_model=List[NoteResponse])
async def list_notes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List notes in org scope filtered by tag-based project visibility."""
    query = select(Note).where(Note.org_id == current_user.org_id)

    if current_user.role != "admin":
        assigned_tag_ids = await get_user_assigned_tag_ids(db, current_user)
        query = query.where(
            (Note.user_id == current_user.id)
            | (
                Note.project_id.in_(accessible_project_ids_subquery(assigned_tag_ids))
            )
        )

    query = query.order_by(Note.updated_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    data: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new note."""
    if data.project_id and current_user.role != "admin":
        assigned_tag_ids = await get_user_assigned_tag_ids(db, current_user)
        allowed_project_ids = set((await db.execute(accessible_project_ids_subquery(assigned_tag_ids))).scalars().all())
        if data.project_id not in allowed_project_ids:
            raise HTTPException(status_code=403, detail="Not authorized for this project")

    note = Note(
        org_id=current_user.org_id,
        user_id=current_user.id,
        title=data.title,
        content=data.content,
        tags=data.tags,
        project_id=data.project_id,
    )
    db.add(note)
    await db.flush()
    return note


@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: UUID,
    data: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a note."""
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.org_id == current_user.org_id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if current_user.role != "admin" and note.user_id != current_user.id:
        assigned_tag_ids = await get_user_assigned_tag_ids(db, current_user)
        allowed_project_ids = set((await db.execute(accessible_project_ids_subquery(assigned_tag_ids))).scalars().all())
        if not note.project_id or note.project_id not in allowed_project_ids:
            raise HTTPException(status_code=403, detail="Not authorized")

    if data.title is not None:
        note.title = data.title
    if data.content is not None:
        note.content = data.content
    if data.tags is not None:
        note.tags = data.tags
    if data.project_id is not None:
        note.project_id = data.project_id

    await db.flush()
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a note."""
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.org_id == current_user.org_id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if current_user.role != "admin" and note.user_id != current_user.id:
        assigned_tag_ids = await get_user_assigned_tag_ids(db, current_user)
        allowed_project_ids = set((await db.execute(accessible_project_ids_subquery(assigned_tag_ids))).scalars().all())
        if not note.project_id or note.project_id not in allowed_project_ids:
            raise HTTPException(status_code=403, detail="Not authorized")

    await db.delete(note)
