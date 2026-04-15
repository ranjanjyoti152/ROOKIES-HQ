from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.user import User
from app.models.tag import Tag
from app.models.user_tag_assignment import UserTagAssignment
from app.schemas.tag import TagCreate, TagResponse, AssignTagsRequest

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagResponse])
async def list_tags(
    kind: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Tag).where(Tag.org_id == current_user.org_id)
    if kind:
        query = query.where(Tag.kind == kind)
    query = query.order_by(Tag.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    data: TagCreate,
    current_user: User = Depends(require_roles("admin", "manager", "hr")),
    db: AsyncSession = Depends(get_db),
):
    tag = Tag(
        org_id=current_user.org_id,
        name=data.name.strip(),
        color=data.color,
        kind=data.kind,
        parent_tag_id=data.parent_tag_id,
    )
    db.add(tag)
    await db.flush()
    return tag


@router.get("/me", response_model=list[TagResponse])
async def list_my_tags(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Tag)
        .join(UserTagAssignment, UserTagAssignment.tag_id == Tag.id)
        .where(UserTagAssignment.user_id == current_user.id)
        .order_by(Tag.kind, Tag.name)
    )
    return result.scalars().all()


@router.post("/users/{user_id}/assign")
async def assign_tags_to_user(
    user_id: str,
    data: AssignTagsRequest,
    current_user: User = Depends(require_roles("admin", "manager", "hr")),
    db: AsyncSession = Depends(get_db),
):
    target_result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == current_user.org_id)
    )
    target_user = target_result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    valid_tags_result = await db.execute(
        select(Tag.id).where(Tag.org_id == current_user.org_id, Tag.id.in_(data.tag_ids))
    )
    valid_tag_ids = set(valid_tags_result.scalars().all())
    if len(valid_tag_ids) != len(set(data.tag_ids)):
        raise HTTPException(status_code=400, detail="One or more tag ids are invalid")

    await db.execute(delete(UserTagAssignment).where(UserTagAssignment.user_id == target_user.id))
    for tag_id in valid_tag_ids:
        db.add(UserTagAssignment(user_id=target_user.id, tag_id=tag_id))

    await db.flush()
    return {"message": "User tag assignments updated", "user_id": str(target_user.id), "tag_count": len(valid_tag_ids)}
