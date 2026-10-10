from fastapi import APIRouter
from app.api.v1.endpoints import sessions, catalog, sizing, telemetry, ws

api_router = APIRouter()

api_router.include_router(sessions.router, prefix="/sessions", tags=["Sessions & Try-On"])
api_router.include_router(catalog.router, prefix="/catalog", tags=["Garment Catalog"])
api_router.include_router(sizing.router, prefix="/sizing", tags=["3D Sizing Engine"])
api_router.include_router(telemetry.router, prefix="/telemetry", tags=["Fleet Diagnostics"])
api_router.include_router(ws.router, prefix="/sessions", tags=["WebSocket Stream"])
