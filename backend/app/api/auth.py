import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.organization import Organization
from app.models.user import User
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.core.permissions import get_sidebar_items
from app.schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse, RefreshRequest, UserResponse, MeResponse
)
from app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new organization. The first user becomes Admin (is_owner=True)."""
    # Create slug from org name
    slug = re.sub(r"[^a-z0-9]+", "-", data.org_name.lower()).strip("-")

    # Check if slug already exists
    existing = await db.execute(select(Organization).where(Organization.slug == slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Organization name already taken")

    # Check if email already exists
    existing_email = await db.execute(select(User).where(User.email == data.email))
    if existing_email.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # Create organization
    org = Organization(name=data.org_name, slug=slug)
    db.add(org)
    await db.flush()

    # Create admin user (first user = owner)
    user = User(
        org_id=org.id,
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        role="admin",
        is_owner=True,
    )
    db.add(user)
    await db.flush()

    # Generate tokens
    access_token = create_access_token({"sub": str(user.id), "org_id": str(org.id), "role": user.role})
    refresh_token = create_refresh_token({"sub": str(user.id), "org_id": str(org.id)})

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email and password."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    access_token = create_access_token({"sub": str(user.id), "org_id": str(user.org_id), "role": user.role})
    refresh_token = create_refresh_token({"sub": str(user.id), "org_id": str(user.org_id)})

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Refresh access token."""
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    access_token = create_access_token({"sub": str(user.id), "org_id": str(user.org_id), "role": user.role})
    new_refresh_token = create_refresh_token({"sub": str(user.id), "org_id": str(user.org_id)})

    return TokenResponse(access_token=access_token, refresh_token=new_refresh_token)


@router.get("/me", response_model=MeResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user profile with sidebar items."""
    # Load organization
    result = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    org = result.scalar_one_or_none()

    sidebar_items = get_sidebar_items(current_user.role)

    user_data = UserResponse(
        id=current_user.id,
        org_id=current_user.org_id,
        email=current_user.email,
        full_name=current_user.full_name,
        avatar_url=current_user.avatar_url,
        role=current_user.role,
        is_owner=current_user.is_owner,
        is_active=current_user.is_active,
        is_checked_in=current_user.is_checked_in,
        sidebar_items=sidebar_items,
    )

    return MeResponse(
        user=user_data,
        organization={
            "id": str(org.id),
            "name": org.name,
            "slug": org.slug,
            "logo_url": org.logo_url,
        },
    )
