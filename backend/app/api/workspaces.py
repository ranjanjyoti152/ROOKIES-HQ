import re
import logging
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from datetime import datetime, timezone
from uuid import UUID

from app.database import get_db
from app.models.organization import Organization
from app.models.user import User
from app.core.security import hash_password
from app.core.otp_store import create_otp, verify_otp
from app.core.email import send_workspace_provision_otp_email, send_workspace_credentials_email
from app.dependencies import get_current_user
from app.schemas.workspace import (
    CreateWorkspaceRequest,
    WorkspacePauseRequest,
    WorkspaceResponse,
    WorkspaceProvisionInitiateResponse,
    WorkspaceProvisionVerifyRequest,
    ResetWorkspaceOwnerPasswordRequest,
    WorkspaceServiceCatalogItem,
    WorkspaceServiceUpdateRequest,
)

router = APIRouter(prefix="/workspaces", tags=["workspaces"])
logger = logging.getLogger(__name__)


WORKSPACE_PROVISION_OTP_PURPOSE = "workspace_provision"
WORKSPACE_SERVICE_CATALOG: list[tuple[str, str]] = [
    ("ai_assistant", "AI Assistant"),
    ("automations", "Automations"),
    ("pipeline", "Pipeline"),
    ("projects", "Projects"),
    ("leads_funnel", "Leads Funnel"),
    ("team_management", "Team Management"),
    ("client_portal", "Client Portal"),
]
DEFAULT_WORKSPACE_SERVICES: dict[str, bool] = {key: True for key, _ in WORKSPACE_SERVICE_CATALOG}


def normalize_email(email: str) -> str:
    return email.strip().lower()


def slugify_org_name(org_name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", org_name.lower()).strip("-")


def require_superadmin(current_user: User = Depends(get_current_user)):
    """Dependency to ensure the user is a superadmin."""
    if not current_user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmins can access this resource."
        )
    return current_user


async def get_founding_superadmin_id(db: AsyncSession) -> UUID | None:
    result = await db.execute(
        select(User.id)
        .where(User.is_superadmin == True)
        .order_by(User.created_at.asc(), User.id.asc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def is_founding_superadmin(db: AsyncSession, current_user: User) -> bool:
    if not current_user.is_superadmin:
        return False
    founding_id = await get_founding_superadmin_id(db)
    return founding_id == current_user.id


async def require_founding_superadmin(
    current_user: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    if not await is_founding_superadmin(db, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the first-created superadmin can pause or delete workspaces.",
        )
    return current_user


def normalize_workspace_services(raw_services: dict | None) -> dict[str, bool]:
    services = DEFAULT_WORKSPACE_SERVICES.copy()
    if isinstance(raw_services, dict):
        for key, value in raw_services.items():
            if key in services:
                services[key] = bool(value)
    return services


async def build_workspace_response(
    db: AsyncSession,
    org: Organization,
    current_user: User,
    can_manage_workspaces: bool,
) -> WorkspaceResponse:
    owner_result = await db.execute(
        select(User).where(User.org_id == org.id, User.is_owner == True).limit(1)
    )
    owner = owner_result.scalar_one_or_none()

    count_result = await db.execute(
        select(func.count(User.id)).where(User.org_id == org.id)
    )
    user_count = count_result.scalar_one()

    return WorkspaceResponse(
        id=str(org.id),
        name=org.name,
        slug=org.slug,
        is_paused=org.is_paused,
        paused_at=org.paused_at.isoformat() if org.paused_at else None,
        owner_name=owner.full_name if owner else "Unknown",
        owner_email=owner.email if owner else "Unknown",
        users_count=user_count,
        created_at=org.created_at.isoformat(),
        can_manage=can_manage_workspaces and org.id != current_user.org_id,
        services=normalize_workspace_services(org.service_flags),
    )


@router.get("", response_model=List[WorkspaceResponse])
async def list_workspaces(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """
    List all workspaces (Organizations) with their owner details and user count.
    Only accessible by superadmin.
    """
    can_manage_workspaces = await is_founding_superadmin(db, current_user)

    # Fetch all organizations
    orgs_result = await db.execute(select(Organization).order_by(Organization.created_at.desc()))
    orgs = orgs_result.scalars().all()

    response = []
    for org in orgs:
        response.append(
            await build_workspace_response(db, org, current_user, can_manage_workspaces)
        )

    return response


@router.get("/service-catalog", response_model=List[WorkspaceServiceCatalogItem])
async def get_workspace_service_catalog(
    current_user: User = Depends(require_superadmin),
):
    _ = current_user
    return [
        WorkspaceServiceCatalogItem(key=key, label=label)
        for key, label in WORKSPACE_SERVICE_CATALOG
    ]


@router.post("/initiate", response_model=WorkspaceProvisionInitiateResponse, status_code=status.HTTP_200_OK)
async def initiate_workspace_creation(
    data: CreateWorkspaceRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """
    Step 1: validate new workspace payload and send OTP to owner email.
    """
    slug = slugify_org_name(data.org_name)
    if not slug:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Organization name must include at least one letter or number.",
        )

    normalized_owner_email = normalize_email(str(data.owner_email))

    existing_org = await db.execute(select(Organization).where(Organization.slug == slug))
    if existing_org.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Organization name already taken")

    existing_user = await db.execute(
        select(User).where(func.lower(User.email) == normalized_owner_email)
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Owner email already registered in the system")

    otp_payload = {
        "org_name": data.org_name,
        "slug": slug,
        "owner_email": normalized_owner_email,
        "owner_full_name": data.owner_full_name,
        "owner_password": data.owner_password,
        "requested_by": str(current_user.id),
    }
    otp = create_otp(
        normalized_owner_email,
        otp_payload,
        purpose=WORKSPACE_PROVISION_OTP_PURPOSE,
    )
    background_tasks.add_task(
        send_workspace_provision_otp_email,
        normalized_owner_email,
        otp,
        data.owner_full_name,
        data.org_name,
    )
    return WorkspaceProvisionInitiateResponse(
        message="OTP sent to owner email. Verify OTP to create workspace.",
        owner_email=normalized_owner_email,
    )


@router.post("/verify", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def verify_workspace_creation(
    data: WorkspaceProvisionVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """
    Step 2: verify OTP and create workspace + owner user.
    """
    normalized_owner_email = normalize_email(str(data.owner_email))
    pending = verify_otp(
        normalized_owner_email,
        data.otp,
        purpose=WORKSPACE_PROVISION_OTP_PURPOSE,
    )
    if not pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP. Please request a new one.",
        )

    if pending.get("requested_by") != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This OTP was issued by another superadmin.",
        )

    slug = pending["slug"]
    org_name = pending["org_name"]
    owner_full_name = pending["owner_full_name"]
    owner_password = pending["owner_password"]

    existing_org = await db.execute(select(Organization).where(Organization.slug == slug))
    if existing_org.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Organization name already taken")

    existing_user = await db.execute(
        select(User).where(func.lower(User.email) == normalized_owner_email)
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Owner email already registered in the system")

    org = Organization(name=org_name, slug=slug, service_flags=DEFAULT_WORKSPACE_SERVICES.copy())
    db.add(org)
    await db.flush()

    user = User(
        org_id=org.id,
        email=normalized_owner_email,
        password_hash=hash_password(owner_password),
        full_name=owner_full_name,
        role="admin",
        is_owner=True,
        is_superadmin=False,
        must_change_password=True,
    )
    db.add(user)
    await db.flush()

    # Send credentials to both:
    # 1) OTP-verified owner email
    # 2) requesting superadmin email
    recipients = {normalized_owner_email}
    superadmin_email = normalize_email(current_user.email)
    if superadmin_email:
        recipients.add(superadmin_email)

    try:
        for recipient in recipients:
            recipient_name = owner_full_name if recipient == normalized_owner_email else current_user.full_name
            await send_workspace_credentials_email(
                recipient,
                recipient_name,
                org_name,
                org.slug,
                owner_password,
            )
    except Exception as exc:
        logger.exception("Workspace credentials email failed for workspace=%s: %s", org.slug, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Workspace credentials email failed to send. Please verify SMTP config and retry.",
        )

    can_manage_workspaces = await is_founding_superadmin(db, current_user)

    return await build_workspace_response(db, org, current_user, can_manage_workspaces)


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    data: CreateWorkspaceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """
    Create a new workspace (Organization) and a user assigned as the owner of that workspace.
    Only accessible by superadmin.
    """
    slug = slugify_org_name(data.org_name)
    if not slug:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Organization name must include at least one letter or number.",
        )

    normalized_owner_email = normalize_email(str(data.owner_email))

    # Check org slug conflict
    existing_org = await db.execute(select(Organization).where(Organization.slug == slug))
    if existing_org.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Organization name already taken")

    # Check user email conflict
    existing_user = await db.execute(
        select(User).where(func.lower(User.email) == normalized_owner_email)
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Owner email already registered in the system")

    # 1. Create Organization
    org = Organization(name=data.org_name, slug=slug, service_flags=DEFAULT_WORKSPACE_SERVICES.copy())
    db.add(org)
    await db.flush()

    # 2. Create User as owner of this new organization
    user = User(
        org_id=org.id,
        email=normalized_owner_email,
        password_hash=hash_password(data.owner_password),
        full_name=data.owner_full_name,
        role="admin",   # Admin within their workspace
        is_owner=True,  # They own this workspace
        is_superadmin=False, # They are not a global superadmin
        must_change_password=True,
    )
    db.add(user)
    await db.flush()

    # Legacy direct-create path: send credentials to owner + superadmin email.
    recipients = {normalized_owner_email}
    superadmin_email = normalize_email(current_user.email)
    if superadmin_email:
        recipients.add(superadmin_email)
    try:
        for recipient in recipients:
            recipient_name = data.owner_full_name if recipient == normalized_owner_email else current_user.full_name
            await send_workspace_credentials_email(
                recipient,
                recipient_name,
                data.org_name,
                slug,
                data.owner_password,
            )
    except Exception as exc:
        logger.exception("Workspace credentials email failed for workspace=%s: %s", slug, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Workspace credentials email failed to send. Please verify SMTP config and retry.",
        )

    can_manage_workspaces = await is_founding_superadmin(db, current_user)

    return await build_workspace_response(db, org, current_user, can_manage_workspaces)


@router.post("/{workspace_id}/owner-password/reset")
async def reset_workspace_owner_password(
    workspace_id: UUID,
    data: ResetWorkspaceOwnerPasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """Reset the owner/admin password for a workspace (superadmin only)."""
    if workspace_id == current_user.org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use your profile temporary-password flow for your own superadmin account.",
        )

    org_result = await db.execute(select(Organization).where(Organization.id == workspace_id))
    org = org_result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    owner_result = await db.execute(
        select(User).where(User.org_id == org.id, User.is_owner == True).limit(1)
    )
    owner = owner_result.scalar_one_or_none()
    if not owner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace owner not found")

    owner.password_hash = hash_password(data.new_password)
    owner.must_change_password = True
    await db.flush()

    recipients = {normalize_email(owner.email), normalize_email(current_user.email)}
    try:
        owner_email_normalized = normalize_email(owner.email)
        for recipient in recipients:
            display_name = owner.full_name if recipient == owner_email_normalized else current_user.full_name
            await send_workspace_credentials_email(
                recipient,
                display_name,
                org.name,
                org.slug,
                data.new_password,
            )
    except Exception as exc:
        logger.exception("Workspace owner reset email failed for workspace=%s: %s", org.slug, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Password reset was aborted because credentials email failed to send. Check SMTP and retry.",
        )

    return {
        "message": "Workspace owner password reset successfully",
        "workspace_id": str(org.id),
        "owner_user_id": str(owner.id),
        "must_change_password": owner.must_change_password,
    }


@router.patch("/{workspace_id}/services", response_model=WorkspaceResponse)
async def update_workspace_services(
    workspace_id: UUID,
    data: WorkspaceServiceUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """Enable/disable workspace services. Superadmin only."""
    org_result = await db.execute(select(Organization).where(Organization.id == workspace_id))
    org = org_result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    can_manage_workspaces = await is_founding_superadmin(db, current_user)
    org.service_flags = normalize_workspace_services(data.services)
    await db.flush()
    return await build_workspace_response(db, org, current_user, can_manage_workspaces)


@router.patch("/{workspace_id}/pause", response_model=WorkspaceResponse)
async def pause_workspace(
    workspace_id: UUID,
    data: WorkspacePauseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_founding_superadmin),
):
    can_manage_workspaces = await is_founding_superadmin(db, current_user)

    if workspace_id == current_user.org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot pause your own workspace.",
        )

    org_result = await db.execute(select(Organization).where(Organization.id == workspace_id))
    org = org_result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    org.is_paused = data.is_paused
    org.paused_at = datetime.now(timezone.utc) if data.is_paused else None
    await db.flush()

    return await build_workspace_response(db, org, current_user, can_manage_workspaces)


@router.delete("/{workspace_id}")
async def delete_workspace(
    workspace_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_founding_superadmin),
):
    if workspace_id == current_user.org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own workspace.",
        )

    org_result = await db.execute(select(Organization).where(Organization.id == workspace_id))
    org = org_result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    await db.delete(org)
    await db.flush()
    return {"message": "Workspace deleted successfully"}
