from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "variational-infinity-agent-service",
    }


@router.get("/info")
async def service_info():
    return {
        "name": "variational-infinity-agent-service",
        "version": "0.1.0",
        "description": "Agent microservice for 变分无限 (Variational Infinity) — math-xianxia life simulator",
    }