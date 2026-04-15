import asyncio
import json
import re
from datetime import datetime, timezone
from typing import AsyncIterator
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.workspaces import require_superadmin
from app.core.crypto import decrypt_secret, encrypt_secret
from app.database import async_session, get_db
from app.dependencies import get_current_user, require_workspace_service
from app.models.ai_chat import AIChat
from app.models.ai_memory import AIMemory
from app.models.ai_message import AIMessage
from app.models.ai_provider_setting import AIProviderSetting
from app.models.lead import Lead
from app.models.organization import Organization
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.schemas.ai import (
    AIChatCreateRequest,
    AIChatResponse,
    AIChatUpdateRequest,
    AIMemoryCreateRequest,
    AIMemoryResponse,
    AIMemoryUpdateRequest,
    AIMessageResponse,
    AIProviderSettingResponse,
    AIProviderSettingUpdateRequest,
    AIStreamRequest,
)

router = APIRouter(
    prefix="/ai",
    tags=["ai"],
    dependencies=[Depends(require_workspace_service("ai_assistant", "AI Assistant"))],
)

SUPPORTED_PROVIDERS = ("openai", "openrouter", "gemini", "ollama")

DEFAULT_PROVIDER_CONFIGS = {
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-4.1-mini",
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "model": "openai/gpt-4.1-mini",
    },
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com",
        "model": "gemini-2.5-flash",
    },
    "ollama": {
        "base_url": "http://localhost:11434",
        "model": "llama3.1:8b",
    },
}


def _mask_api_key(api_key: str | None) -> str | None:
    if not api_key:
        return None
    trimmed = api_key.strip()
    if len(trimmed) <= 8:
        return "*" * len(trimmed)
    return f"{trimmed[:4]}{'*' * (len(trimmed) - 8)}{trimmed[-4:]}"


def _ensure_provider_name(provider: str) -> str:
    normalized = provider.strip().lower()
    if normalized not in SUPPORTED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider '{provider}'")
    return normalized


def _build_provider_response(setting: AIProviderSetting | None, provider: str) -> AIProviderSettingResponse:
    defaults = DEFAULT_PROVIDER_CONFIGS[provider]
    masked = None
    has_api_key = False

    if setting and setting.api_key_encrypted:
        try:
            masked = _mask_api_key(decrypt_secret(setting.api_key_encrypted))
            has_api_key = True
        except ValueError:
            masked = None
            has_api_key = True

    return AIProviderSettingResponse(
        provider=provider,
        enabled=bool(setting.enabled) if setting else False,
        is_default=bool(setting.is_default) if setting else False,
        base_url=(setting.base_url if setting else defaults["base_url"]),
        model=(setting.model if setting else defaults["model"]),
        has_api_key=has_api_key,
        api_key_masked=masked,
        extra_config=setting.extra_config if setting else None,
        updated_at=setting.updated_at if setting else None,
    )


async def _get_chat_or_404(chat_id: UUID, current_user: User, db: AsyncSession) -> AIChat:
    result = await db.execute(
        select(AIChat).where(
            AIChat.id == chat_id,
            AIChat.org_id == current_user.org_id,
            AIChat.user_id == current_user.id,
        )
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


async def _get_memory_or_404(memory_id: UUID, current_user: User, db: AsyncSession) -> AIMemory:
    result = await db.execute(
        select(AIMemory).where(
            AIMemory.id == memory_id,
            AIMemory.org_id == current_user.org_id,
            AIMemory.user_id == current_user.id,
        )
    )
    memory = result.scalar_one_or_none()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


async def _collect_platform_snapshot(current_user: User, db: AsyncSession) -> dict:
    org_id = current_user.org_id

    task_rows = await db.execute(
        select(Task.status, func.count().label("count"))
        .where(Task.org_id == org_id)
        .group_by(Task.status)
    )
    tasks_by_stage = {row.status: int(row.count) for row in task_rows.all()}

    lead_rows = await db.execute(
        select(Lead.status, func.count().label("count"))
        .where(Lead.org_id == org_id)
        .group_by(Lead.status)
    )
    leads_by_stage = {row.status: int(row.count) for row in lead_rows.all()}

    active_projects_result = await db.execute(
        select(func.count(Project.id)).where(
            Project.org_id == org_id,
            Project.status == "active",
        )
    )
    active_projects = int(active_projects_result.scalar() or 0)

    open_tasks_result = await db.execute(
        select(func.count(Task.id)).where(
            Task.org_id == org_id,
            Task.status.notin_(["delivered", "closed"]),
        )
    )
    open_tasks = int(open_tasks_result.scalar() or 0)

    closed_tasks_result = await db.execute(
        select(func.count(Task.id)).where(
            Task.org_id == org_id,
            Task.status.in_(["delivered", "closed"]),
        )
    )
    closed_tasks = int(closed_tasks_result.scalar() or 0)

    team_result = await db.execute(
        select(func.count(User.id)).where(
            and_(
                User.org_id == org_id,
                User.is_active == True,
                User.role != "client",
            )
        )
    )
    active_team = int(team_result.scalar() or 0)

    project_samples_result = await db.execute(
        select(Project.name, Project.status)
        .where(Project.org_id == org_id)
        .order_by(Project.updated_at.desc())
        .limit(5)
    )
    project_samples = [
        {"name": row.name, "status": row.status}
        for row in project_samples_result.all()
    ]

    return {
        "metrics": {
            "open_tasks": open_tasks,
            "closed_tasks": closed_tasks,
            "active_projects": active_projects,
            "active_team_members": active_team,
        },
        "tasks_by_stage": tasks_by_stage,
        "leads_by_stage": leads_by_stage,
        "projects": project_samples,
    }


def _build_visual_spec(user_message: str, snapshot: dict, force: bool = False) -> dict | None:
    msg = user_message.lower()
    wants_visual = any(k in msg for k in ["chart", "graph", "infographic", "visual", "dashboard"])
    if force:
        wants_visual = True
    if not wants_visual:
        return None

    metrics = snapshot.get("metrics", {})
    tasks = snapshot.get("tasks_by_stage", {})
    leads = snapshot.get("leads_by_stage", {})

    if any(k in msg for k in ["lead", "sales", "pipeline"]):
        labels = list(leads.keys())
        values = [int(leads[k]) for k in labels]
        return {
            "kind": "chart",
            "chart_type": "donut",
            "title": "Lead Pipeline Snapshot",
            "description": "Current distribution of leads by stage.",
            "labels": labels,
            "values": values,
        }

    labels = list(tasks.keys())
    values = [int(tasks[k]) for k in labels]
    return {
        "kind": "infographic",
        "title": "Operations Pulse",
        "description": "Live view of workload and delivery health.",
        "cards": [
            {"label": "Open Tasks", "value": metrics.get("open_tasks", 0), "accent": "orange"},
            {"label": "Closed Tasks", "value": metrics.get("closed_tasks", 0), "accent": "green"},
            {"label": "Active Projects", "value": metrics.get("active_projects", 0), "accent": "blue"},
            {"label": "Team Members", "value": metrics.get("active_team_members", 0), "accent": "purple"},
        ],
        "chart": {
            "chart_type": "bar",
            "title": "Tasks by Stage",
            "labels": labels,
            "values": values,
        },
    }


def _extract_memory_candidate(message: str) -> tuple[str, int] | None:
    msg = message.strip()

    remember_match = re.search(r"remember(?: that)?\s+(.+)", msg, flags=re.IGNORECASE)
    if remember_match:
        text = remember_match.group(1).strip()
        if text:
            return text[:400], 4

    preference_patterns = [
        r"my preference is\s+(.+)",
        r"i prefer\s+(.+)",
        r"my timezone is\s+(.+)",
        r"my role is\s+(.+)",
    ]

    for pattern in preference_patterns:
        match = re.search(pattern, msg, flags=re.IGNORECASE)
        if match:
            text = match.group(1).strip()
            if text:
                return text[:400], 3

    return None


def _compose_model_messages(
    org_name: str,
    chat_messages: list[AIMessage],
    memories: list[AIMemory],
    tools_snapshot: dict | None,
) -> list[dict]:
    system_lines = [
        "You are the in-product AI assistant for Rookies HQ.",
        f"Current workspace: {org_name}.",
        "Be concise, helpful, and action-oriented.",
        "If asked for a graph/infographic, explain the story from data before visuals.",
    ]

    if memories:
        memory_text = "\n".join([f"- {m.content}" for m in memories])
        system_lines.append(f"User memory context:\n{memory_text}")

    if tools_snapshot:
        system_lines.append("Platform snapshot (JSON):")
        system_lines.append(json.dumps(tools_snapshot, ensure_ascii=True))

    payload = [{"role": "system", "content": "\n".join(system_lines)}]
    payload.extend({"role": m.role, "content": m.content} for m in chat_messages)
    return payload


async def _stream_openai_compatible(
    *,
    provider: str,
    base_url: str,
    model: str,
    api_key: str,
    messages: list[dict],
) -> AsyncIterator[str]:
    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    if provider == "openrouter":
        headers["HTTP-Referer"] = "https://rookishq.local"
        headers["X-Title"] = "Rookies HQ AI Assistant"

    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "temperature": 0.4,
    }

    timeout = httpx.Timeout(connect=20.0, read=300.0, write=20.0, pool=20.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue

                data = line[5:].strip()
                if not data or data == "[DONE]":
                    continue

                try:
                    obj = json.loads(data)
                except json.JSONDecodeError:
                    continue

                choices = obj.get("choices") or []
                if not choices:
                    continue

                delta = choices[0].get("delta") or {}
                token = delta.get("content")
                if token:
                    yield token


async def _stream_ollama(
    *,
    base_url: str,
    model: str,
    messages: list[dict],
) -> AsyncIterator[str]:
    url = f"{base_url.rstrip('/')}/api/chat"
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
    }

    timeout = httpx.Timeout(connect=20.0, read=300.0, write=20.0, pool=20.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", url, json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue

                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue

                msg_obj = obj.get("message") or {}
                token = msg_obj.get("content")
                if token:
                    yield token

                if obj.get("done"):
                    break


async def _stream_gemini(
    *,
    base_url: str,
    model: str,
    api_key: str,
    messages: list[dict],
) -> AsyncIterator[str]:
    # Gemini API is called in one shot and then emitted in chunks to the SSE channel.
    gemini_model = model.replace("models/", "", 1)
    url = f"{base_url.rstrip('/')}/v1beta/models/{gemini_model}:generateContent?key={api_key}"

    merged_prompt = "\n\n".join([f"{m['role'].upper()}: {m['content']}" for m in messages])
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": merged_prompt}],
            }
        ]
    }

    timeout = httpx.Timeout(connect=20.0, read=300.0, write=20.0, pool=20.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()

    text = ""
    candidates = data.get("candidates") or []
    if candidates:
        parts = ((candidates[0].get("content") or {}).get("parts") or [])
        text = " ".join(part.get("text", "") for part in parts if part.get("text"))

    if not text:
        text = "I could not generate a response from Gemini for this request."

    for sentence in re.split(r"(?<=[.!?])\s+", text):
        if sentence.strip():
            yield f"{sentence.strip()} "
            await asyncio.sleep(0.01)


async def _stream_fallback_response(user_message: str, snapshot: dict | None) -> AsyncIterator[str]:
    metrics = (snapshot or {}).get("metrics", {})
    text = (
        "AI provider is not configured yet. "
        "Please ask your superadmin to enable OpenAI, OpenRouter, Gemini, or Ollama in Settings. "
        f"Current snapshot: {metrics.get('open_tasks', 0)} open tasks, "
        f"{metrics.get('active_projects', 0)} active projects, "
        f"{metrics.get('active_team_members', 0)} active team members. "
        f"Your request was: {user_message.strip()}"
    )
    for token in text.split(" "):
        if token:
            yield token + " "
            await asyncio.sleep(0.01)


async def _resolve_provider(
    requested_provider: str | None,
    db: AsyncSession,
) -> tuple[str, AIProviderSetting | None]:
    provider_rows = await db.execute(select(AIProviderSetting))
    settings = provider_rows.scalars().all()

    if requested_provider:
        requested_provider = _ensure_provider_name(requested_provider)
        for row in settings:
            if row.provider == requested_provider:
                return requested_provider, row
        return requested_provider, None

    default_setting = next((row for row in settings if row.is_default and row.enabled), None)
    if default_setting:
        return default_setting.provider, default_setting

    first_enabled = next((row for row in settings if row.enabled), None)
    if first_enabled:
        return first_enabled.provider, first_enabled

    return "openai", None


async def _fetch_provider_models(
    provider: str,
    base_url: str,
    api_key: str | None,
) -> tuple[list[str], str | None]:
    timeout = httpx.Timeout(connect=20.0, read=30.0, write=20.0, pool=20.0)

    if provider in {"openai", "openrouter"}:
        if not api_key:
            return [], "API key required to fetch models."

        headers = {"Authorization": f"Bearer {api_key}"}
        if provider == "openrouter":
            headers["HTTP-Referer"] = "https://rookishq.local"
            headers["X-Title"] = "Rookies HQ AI Settings"

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(f"{base_url.rstrip('/')}/models", headers=headers)
            response.raise_for_status()
            payload = response.json()

        models = sorted(
            {
                str(item.get("id", "")).strip()
                for item in (payload.get("data") or [])
                if item.get("id")
            }
        )
        return models, None

    if provider == "gemini":
        if not api_key:
            return [], "API key required to fetch models."

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(f"{base_url.rstrip('/')}/v1beta/models?key={api_key}")
            response.raise_for_status()
            payload = response.json()

        parsed = []
        for item in payload.get("models") or []:
            name = str(item.get("name", "")).strip()
            if not name:
                continue
            parsed.append(name.replace("models/", "", 1))

        return sorted(set(parsed)), None

    if provider == "ollama":
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(f"{base_url.rstrip('/')}/api/tags")
            response.raise_for_status()
            payload = response.json()

        models = sorted(
            {
                str(item.get("name", "")).strip()
                for item in (payload.get("models") or [])
                if item.get("name")
            }
        )
        return models, None

    return [], "Unsupported provider."


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


@router.get("/providers", response_model=list[AIProviderSettingResponse])
async def list_provider_settings(
    _: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AIProviderSetting))
    existing = {row.provider: row for row in result.scalars().all()}

    response = []
    for provider in SUPPORTED_PROVIDERS:
        response.append(_build_provider_response(existing.get(provider), provider))

    return response


@router.get("/providers/public")
async def list_public_provider_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # `current_user` is intentionally unused beyond access control.
    _ = current_user
    result = await db.execute(select(AIProviderSetting))
    existing = {row.provider: row for row in result.scalars().all()}

    providers = []
    default_provider = None
    for provider in SUPPORTED_PROVIDERS:
        setting = existing.get(provider)
        defaults = DEFAULT_PROVIDER_CONFIGS[provider]
        enabled = bool(setting.enabled) if setting else False
        is_default = bool(setting.is_default) if setting else False
        if is_default:
            default_provider = provider
        providers.append(
            {
                "provider": provider,
                "enabled": enabled,
                "is_default": is_default,
                "model": setting.model if setting else defaults["model"],
                "base_url": setting.base_url if setting else defaults["base_url"],
            }
        )

    if not default_provider:
        default_provider = next((p["provider"] for p in providers if p["enabled"]), "openai")

    return {
        "default_provider": default_provider,
        "providers": providers,
    }


@router.put("/providers/{provider}", response_model=AIProviderSettingResponse)
async def upsert_provider_settings(
    provider: str,
    payload: AIProviderSettingUpdateRequest,
    current_user: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    provider_name = _ensure_provider_name(provider)

    result = await db.execute(select(AIProviderSetting).where(AIProviderSetting.provider == provider_name))
    setting = result.scalar_one_or_none()

    if payload.is_default and not payload.enabled:
        raise HTTPException(status_code=400, detail="Default provider must be enabled")

    if not setting:
        setting = AIProviderSetting(
            provider=provider_name,
            created_by=current_user.id,
        )
        db.add(setting)

    setting.enabled = payload.enabled
    setting.is_default = payload.is_default
    setting.base_url = payload.base_url or DEFAULT_PROVIDER_CONFIGS[provider_name]["base_url"]
    normalized_model = payload.model or DEFAULT_PROVIDER_CONFIGS[provider_name]["model"]
    if provider_name == "gemini" and normalized_model:
        normalized_model = normalized_model.replace("models/", "", 1)
    setting.model = normalized_model
    setting.extra_config = payload.extra_config
    setting.updated_by = current_user.id

    if payload.api_key is not None:
        cleaned_key = payload.api_key.strip()
        setting.api_key_encrypted = encrypt_secret(cleaned_key) if cleaned_key else None

    if payload.is_default:
        await db.execute(
            AIProviderSetting.__table__.update()
            .where(AIProviderSetting.provider != provider_name)
            .values(is_default=False)
        )

    await db.flush()

    return _build_provider_response(setting, provider_name)


@router.get("/providers/{provider}/models")
async def list_provider_models(
    provider: str,
    api_key: str | None = None,
    base_url: str | None = None,
    current_user: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    # Access is restricted to superadmin via dependency.
    _ = current_user
    provider_name = _ensure_provider_name(provider)

    result = await db.execute(select(AIProviderSetting).where(AIProviderSetting.provider == provider_name))
    setting = result.scalar_one_or_none()
    defaults = DEFAULT_PROVIDER_CONFIGS[provider_name]

    resolved_base_url = (base_url or (setting.base_url if setting else None) or defaults["base_url"]).strip()
    resolved_key = (api_key or "").strip() or None
    if not resolved_key and setting and setting.api_key_encrypted:
        try:
            resolved_key = decrypt_secret(setting.api_key_encrypted)
        except ValueError:
            resolved_key = None

    try:
        models, message = await _fetch_provider_models(
            provider=provider_name,
            base_url=resolved_base_url,
            api_key=resolved_key,
        )
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:300] if exc.response is not None else str(exc)
        return {
            "provider": provider_name,
            "base_url": resolved_base_url,
            "models": [],
            "current_model": (setting.model if setting else defaults["model"]),
            "message": f"Model fetch failed: {detail}",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "provider": provider_name,
            "base_url": resolved_base_url,
            "models": [],
            "current_model": (setting.model if setting else defaults["model"]),
            "message": f"Model fetch failed: {str(exc)}",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }

    return {
        "provider": provider_name,
        "base_url": resolved_base_url,
        "models": models,
        "current_model": (setting.model if setting else defaults["model"]),
        "message": message,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/chats", response_model=list[AIChatResponse])
async def list_ai_chats(
    archived: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AIChat)
        .where(
            AIChat.org_id == current_user.org_id,
            AIChat.user_id == current_user.id,
            AIChat.is_archived == archived,
        )
        .order_by(AIChat.updated_at.desc())
        .limit(100)
    )
    return result.scalars().all()


@router.post("/chats", response_model=AIChatResponse, status_code=status.HTTP_201_CREATED)
async def create_ai_chat(
    payload: AIChatCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    chat = AIChat(
        org_id=current_user.org_id,
        user_id=current_user.id,
        title=(payload.title or "New Chat").strip()[:255] or "New Chat",
    )
    db.add(chat)
    await db.flush()
    return chat


@router.patch("/chats/{chat_id}", response_model=AIChatResponse)
async def update_ai_chat(
    chat_id: UUID,
    payload: AIChatUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    chat = await _get_chat_or_404(chat_id, current_user, db)

    if payload.title is not None:
        cleaned = payload.title.strip()
        chat.title = cleaned[:255] if cleaned else "New Chat"

    if payload.is_archived is not None:
        chat.is_archived = payload.is_archived

    chat.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return chat


@router.delete("/chats/{chat_id}")
async def delete_ai_chat(
    chat_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    chat = await _get_chat_or_404(chat_id, current_user, db)
    await db.delete(chat)
    await db.flush()
    return {"message": "Chat deleted"}


@router.get("/chats/{chat_id}/messages", response_model=list[AIMessageResponse])
async def list_ai_messages(
    chat_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_chat_or_404(chat_id, current_user, db)
    result = await db.execute(
        select(AIMessage)
        .where(AIMessage.chat_id == chat_id)
        .order_by(AIMessage.created_at.asc())
    )
    return result.scalars().all()


@router.get("/memories", response_model=list[AIMemoryResponse])
async def list_memories(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clamped_limit = max(1, min(limit, 200))
    result = await db.execute(
        select(AIMemory)
        .where(
            AIMemory.org_id == current_user.org_id,
            AIMemory.user_id == current_user.id,
        )
        .order_by(AIMemory.importance.desc(), AIMemory.updated_at.desc())
        .limit(clamped_limit)
    )
    return result.scalars().all()


@router.post("/memories", response_model=AIMemoryResponse, status_code=status.HTTP_201_CREATED)
async def create_memory(
    payload: AIMemoryCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    memory = AIMemory(
        org_id=current_user.org_id,
        user_id=current_user.id,
        content=payload.content.strip(),
        importance=payload.importance,
    )
    db.add(memory)
    await db.flush()
    return memory


@router.patch("/memories/{memory_id}", response_model=AIMemoryResponse)
async def update_memory(
    memory_id: UUID,
    payload: AIMemoryUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    memory = await _get_memory_or_404(memory_id, current_user, db)

    if payload.content is not None:
        memory.content = payload.content.strip()
    if payload.importance is not None:
        memory.importance = payload.importance

    memory.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return memory


@router.delete("/memories/{memory_id}")
async def delete_memory(
    memory_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    memory = await _get_memory_or_404(memory_id, current_user, db)
    await db.delete(memory)
    await db.flush()
    return {"message": "Memory deleted"}


@router.get("/tools")
async def list_ai_tools(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    snapshot = await _collect_platform_snapshot(current_user, db)
    return {
        "tools": [
            {
                "key": "platform_snapshot",
                "name": "Platform Snapshot",
                "description": "Reads tasks, leads, projects, and team metrics for analysis.",
            },
            {
                "key": "visual_spec",
                "name": "Graph & Infographic Spec",
                "description": "Builds chart-ready and infographic-ready structures from platform data.",
            },
        ],
        "snapshot_preview": snapshot,
    }


@router.post("/assistant/stream")
async def stream_assistant_response(
    payload: AIStreamRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_result = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    org = org_result.scalar_one_or_none()
    org_name = org.name if org else "Workspace"

    if payload.chat_id:
        chat = await _get_chat_or_404(payload.chat_id, current_user, db)
    else:
        chat = AIChat(
            org_id=current_user.org_id,
            user_id=current_user.id,
            title=(payload.title or payload.message[:48] or "New Chat").strip()[:255],
        )
        db.add(chat)
        await db.flush()

    chat.updated_at = datetime.now(timezone.utc)

    user_message = AIMessage(
        chat_id=chat.id,
        role="user",
        content=payload.message.strip(),
    )
    db.add(user_message)
    await db.flush()

    memory_rows: list[AIMemory] = []
    if payload.memory_enabled:
        memory_result = await db.execute(
            select(AIMemory)
            .where(
                AIMemory.org_id == current_user.org_id,
                AIMemory.user_id == current_user.id,
            )
            .order_by(AIMemory.importance.desc(), AIMemory.updated_at.desc())
            .limit(8)
        )
        memory_rows = memory_result.scalars().all()

    tools_snapshot = None
    if payload.tools_enabled:
        tools_snapshot = await _collect_platform_snapshot(current_user, db)

    recent_result = await db.execute(
        select(AIMessage)
        .where(AIMessage.chat_id == chat.id)
        .order_by(AIMessage.created_at.desc())
        .limit(20)
    )
    recent_messages = list(reversed(recent_result.scalars().all()))

    provider_name, provider_setting = await _resolve_provider(payload.provider, db)
    provider_defaults = DEFAULT_PROVIDER_CONFIGS[provider_name]
    base_url = (provider_setting.base_url if provider_setting else provider_defaults["base_url"]) or provider_defaults["base_url"]
    model = (provider_setting.model if provider_setting else provider_defaults["model"]) or provider_defaults["model"]

    decrypted_api_key = None
    if provider_setting and provider_setting.api_key_encrypted:
        try:
            decrypted_api_key = decrypt_secret(provider_setting.api_key_encrypted)
        except ValueError:
            decrypted_api_key = None

    model_messages = _compose_model_messages(
        org_name=org_name,
        chat_messages=recent_messages,
        memories=memory_rows if payload.memory_enabled else [],
        tools_snapshot=tools_snapshot if payload.tools_enabled else None,
    )

    visual_spec = _build_visual_spec(
        payload.message,
        tools_snapshot or {},
        force=payload.request_visual,
    )

    memory_candidate = _extract_memory_candidate(payload.message) if payload.memory_enabled else None
    if memory_candidate:
        memory_text, memory_importance = memory_candidate
        db.add(
            AIMemory(
                org_id=current_user.org_id,
                user_id=current_user.id,
                source_message_id=user_message.id,
                content=memory_text,
                importance=memory_importance,
            )
        )

    # Persist user message + optional extracted memory before streaming starts.
    await db.commit()

    async def event_stream() -> AsyncIterator[str]:
        assistant_parts: list[str] = []
        used_fallback = False

        try:
            yield _sse(
                "meta",
                {
                    "chat_id": str(chat.id),
                    "provider": provider_name,
                    "model": model,
                    "tools_enabled": payload.tools_enabled,
                    "memory_enabled": payload.memory_enabled,
                },
            )

            if visual_spec:
                yield _sse("visual", visual_spec)

            iterator: AsyncIterator[str]
            provider_enabled = bool(provider_setting.enabled) if provider_setting else False

            if provider_name in ("openai", "openrouter") and provider_enabled and decrypted_api_key:
                iterator = _stream_openai_compatible(
                    provider=provider_name,
                    base_url=base_url,
                    model=model,
                    api_key=decrypted_api_key,
                    messages=model_messages,
                )
            elif provider_name == "ollama" and provider_enabled:
                iterator = _stream_ollama(
                    base_url=base_url,
                    model=model,
                    messages=model_messages,
                )
            elif provider_name == "gemini" and provider_enabled and decrypted_api_key:
                iterator = _stream_gemini(
                    base_url=base_url,
                    model=model,
                    api_key=decrypted_api_key,
                    messages=model_messages,
                )
            else:
                used_fallback = True
                iterator = _stream_fallback_response(payload.message, tools_snapshot)

            async for token in iterator:
                if token:
                    assistant_parts.append(token)
                    yield _sse("delta", {"text": token})

            assistant_text = "".join(assistant_parts).strip()
            if not assistant_text:
                assistant_text = "I could not generate a response. Please try again."

            tool_payload = {
                "provider": provider_name,
                "model": model,
                "fallback": used_fallback,
                "visual": visual_spec,
                "tools_enabled": payload.tools_enabled,
            }

            async with async_session() as session:
                session.add(
                    AIMessage(
                        chat_id=chat.id,
                        role="assistant",
                        content=assistant_text,
                        tool_payload=tool_payload,
                    )
                )
                chat_row = await session.get(AIChat, chat.id)
                if chat_row:
                    chat_row.updated_at = datetime.now(timezone.utc)
                await session.commit()

            yield _sse(
                "done",
                {
                    "chat_id": str(chat.id),
                    "provider": provider_name,
                    "model": model,
                },
            )
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:300] if exc.response is not None else str(exc)
            yield _sse("error", {"message": f"Provider HTTP error: {detail}"})
        except Exception as exc:  # noqa: BLE001
            yield _sse("error", {"message": str(exc)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
