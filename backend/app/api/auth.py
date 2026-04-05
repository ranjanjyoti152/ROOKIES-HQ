import re
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.organization import Organization
from app.models.user import User
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.core.permissions import get_sidebar_items
from app.core.otp_store import create_otp, verify_otp, has_pending
from app.core.email import send_otp_email
from app.schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse, RefreshRequest, UserResponse, MeResponse,
    OTPVerifyRequest, JoinRequest, JoinOTPVerifyRequest,
)
from app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/setup-status")
async def setup_status(db: AsyncSession = Depends(get_db)):
    """
    Returns whether any workspace has been created yet.
    Frontend uses this to decide: show 'Create Workspace' (first user = admin)
    or 'Join Workspace' (subsequent users).
    """
    result = await db.execute(select(Organization).limit(1))
    org = result.scalar_one_or_none()
    return {"needs_setup": org is None}


@router.post("/register/initiate", status_code=status.HTTP_200_OK)
async def register_initiate(
    data: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Step 1 of registration: validate, generate OTP, send email."""
    slug = re.sub(r"[^a-z0-9]+", "-", data.org_name.lower()).strip("-")

    # Check org slug
    existing = await db.execute(select(Organization).where(Organization.slug == slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Organization name already taken")

    # Check email
    existing_email = await db.execute(select(User).where(User.email == data.email))
    if existing_email.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # Store pending registration and generate OTP
    registration_data = {
        "org_name": data.org_name,
        "email": data.email,
        "password": data.password,
        "full_name": data.full_name,
        "slug": slug,
    }
    otp = create_otp(data.email, registration_data)

    # Send email in background so the response is instant
    background_tasks.add_task(send_otp_email, data.email, otp, data.full_name, data.org_name)

    return {"message": "OTP sent", "email": data.email}


@router.post("/register/verify", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_verify(
    data: OTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Step 2 of registration: verify OTP and create the org + user."""
    reg = verify_otp(data.email, data.otp)
    if not reg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP. Please request a new one.",
        )

    # Double-check no one registered in the meantime
    existing_email = await db.execute(select(User).where(User.email == reg["email"]))
    if existing_email.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # Check if this is the very first organization in the system
    first_org_check = await db.execute(select(Organization).limit(1))
    is_first_org = first_org_check.scalar_one_or_none() is None

    # Create organization
    org = Organization(name=reg["org_name"], slug=reg["slug"])
    db.add(org)
    await db.flush()

    # Create admin user
    user = User(
        org_id=org.id,
        email=reg["email"],
        password_hash=hash_password(reg["password"]),
        full_name=reg["full_name"],
        role="admin",
        is_owner=True,
        is_superadmin=is_first_org,  # The very first user ever gets superadmin rights
    )
    db.add(user)
    await db.flush()

    access_token = create_access_token({"sub": str(user.id), "org_id": str(org.id), "role": user.role})
    refresh_token = create_refresh_token({"sub": str(user.id), "org_id": str(org.id)})

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/register/resend", status_code=status.HTTP_200_OK)
async def register_resend(
    data: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Resend OTP if still in pending state."""
    if not has_pending(data.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No pending registration. Please start again.")

    slug = re.sub(r"[^a-z0-9]+", "-", data.org_name.lower()).strip("-")
    registration_data = {
        "org_name": data.org_name,
        "email": data.email,
        "password": data.password,
        "full_name": data.full_name,
        "slug": slug,
    }
    otp = create_otp(data.email, registration_data)
    background_tasks.add_task(send_otp_email, data.email, otp, data.full_name, data.org_name)
    return {"message": "OTP resent", "email": data.email}



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


@router.post("/join/initiate", status_code=status.HTTP_200_OK)
async def join_initiate(
    data: JoinRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Step 1 of joining an existing workspace: validate org + email, send OTP."""
    # Verify org exists
    result = await db.execute(select(Organization).where(Organization.slug == data.org_slug))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found. Check your workspace ID."
        )

    # Check email not already in this org
    existing = await db.execute(
        select(User).where(User.org_id == org.id, User.email == data.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered in this workspace")

    # Store pending join and generate OTP
    join_data = {
        "org_id": str(org.id),
        "org_name": org.name,
        "org_slug": data.org_slug,
        "email": data.email,
        "password": data.password,
        "full_name": data.full_name,
        "is_join": True,
    }
    otp = create_otp(f"join:{data.email}:{data.org_slug}", join_data)
    background_tasks.add_task(send_otp_email, data.email, otp, data.full_name, org.name)
    return {"message": "OTP sent", "email": data.email, "org_name": org.name}


@router.post("/join/verify", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def join_verify(
    data: JoinOTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Step 2 of joining: verify OTP, create user under the existing org as 'editor'."""
    store_key = f"join:{data.email}:{data.org_slug}"
    reg = verify_otp(store_key, data.otp)
    if not reg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP. Please request a new one.",
        )

    # Re-fetch org
    import uuid as _uuid
    org_id = _uuid.UUID(reg["org_id"])
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Workspace no longer exists")

    # Check email not already registered
    existing = await db.execute(select(User).where(User.org_id == org.id, User.email == reg["email"]))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered in this workspace")

    # Create user as editor — admin will assign the real role from Team page
    user = User(
        org_id=org.id,
        email=reg["email"],
        password_hash=hash_password(reg["password"]),
        full_name=reg["full_name"],
        role="editor",    # default; admin promotes via Team page
        is_owner=False,
    )
    db.add(user)
    await db.flush()

    access_token = create_access_token({"sub": str(user.id), "org_id": str(org.id), "role": user.role})
    refresh_token_val = create_refresh_token({"sub": str(user.id), "org_id": str(org.id)})
    return TokenResponse(access_token=access_token, refresh_token=refresh_token_val)


@router.get("/me", response_model=MeResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user profile with sidebar items."""
    # Load organization
    result = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    org = result.scalar_one_or_none()

    sidebar_items = get_sidebar_items(current_user)

    user_data = UserResponse(
        id=current_user.id,
        org_id=current_user.org_id,
        email=current_user.email,
        full_name=current_user.full_name,
        avatar_url=current_user.avatar_url,
        role=current_user.role,
        is_owner=current_user.is_owner,
        is_superadmin=current_user.is_superadmin,
        is_active=current_user.is_active,
        is_checked_in=current_user.is_checked_in,
        last_check_in=current_user.last_check_in,
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
