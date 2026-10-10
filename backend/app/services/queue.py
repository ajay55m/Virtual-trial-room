import json
import logging
from typing import Dict, Set
from fastapi import WebSocket
from app.models.schemas import TryOnProgressMessage

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages active WebSocket client connections for progress broadcasting."""

    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = set()
        self.active_connections[session_id].add(websocket)
        logger.info(f"WebSocket client connected for session: {session_id}")

    def disconnect(self, session_id: str, websocket: WebSocket):
        if session_id in self.active_connections:
            self.active_connections[session_id].discard(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
        logger.info(f"WebSocket client disconnected for session: {session_id}")

    async def broadcast_progress(self, session_id: str, message: TryOnProgressMessage):
        if session_id in self.active_connections:
            data = message.model_dump_json()
            dead_connections = set()
            for connection in self.active_connections[session_id]:
                try:
                    await connection.send_text(data)
                except Exception as e:
                    logger.warning(f"Error sending WebSocket message: {e}")
                    dead_connections.add(connection)
            for dead in dead_connections:
                self.active_connections[session_id].discard(dead)

connection_manager = ConnectionManager()
