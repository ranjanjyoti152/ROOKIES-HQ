from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json


class ConnectionManager:
    """Manages WebSocket connections per organization."""

    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, org_id: str):
        await websocket.accept()
        if org_id not in self.active_connections:
            self.active_connections[org_id] = set()
        self.active_connections[org_id].add(websocket)

    def disconnect(self, websocket: WebSocket, org_id: str):
        if org_id in self.active_connections:
            self.active_connections[org_id].discard(websocket)

    async def broadcast(self, org_id: str, message: dict):
        """Broadcast message to all connections in an organization."""
        connections = self.active_connections.get(org_id, set())
        dead = set()
        for conn in connections:
            try:
                await conn.send_json(message)
            except Exception:
                dead.add(conn)
        for d in dead:
            connections.discard(d)

    async def send_to_user(self, websocket: WebSocket, message: dict):
        try:
            await websocket.send_json(message)
        except Exception:
            pass


manager = ConnectionManager()
