import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.queue import connection_manager
from app.models.schemas import TryOnProgressMessage
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.websocket("/ws/{session_id}")
async def websocket_session_stream(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint streaming live VTON inference logs & progress.
    """
    await connection_manager.connect(session_id, websocket)
    try:
        # Send initial connected handshake
        await websocket.send_json({
            "stage": "CONNECTED",
            "progressPercent": 0,
            "logMessage": f"Kiosk WebSocket handshake established for session: {session_id}"
        })

        while True:
            # Keep-alive loop
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        connection_manager.disconnect(session_id, websocket)
    except Exception as e:
        logger.warning(f"WebSocket error on session {session_id}: {e}")
        connection_manager.disconnect(session_id, websocket)
