from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from app.core.security import decode_token
from app.websockets.manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = ""):
    """WebSocket endpoint. Authenticate via token query param."""
    # Validate token
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid token")
        return

    org_id = payload.get("org_id", "")
    user_id = payload.get("sub", "")

    await manager.connect(websocket, org_id)

    try:
        while True:
            data = await websocket.receive_text()
            # For now, just echo or handle pings
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, org_id)
