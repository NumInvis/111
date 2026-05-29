import httpx

from fastapi import APIRouter, HTTPException

from app.dependencies import get_settings

router = APIRouter()


@router.get("/session/{session_id}/world-blueprint")
async def fetch_world_blueprint(session_id: str):
    settings = get_settings()
    url = f"{settings.nestjs_api_url}/api/generation/world/{session_id}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=503, detail=f"NestJS callback failed: {exc}")

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=f"NestJS returned {response.status_code}")

    body = response.json()
    if not body.get("success"):
        raise HTTPException(status_code=404, detail=body.get("error", "World blueprint not found"))

    return body["data"]


@router.get("/session/{session_id}/player-state")
async def fetch_player_state(session_id: str):
    settings = get_settings()
    url = f"{settings.nestjs_api_url}/api/game/sessions/{session_id}/state"

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=503, detail=f"NestJS callback failed: {exc}")

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=f"NestJS returned {response.status_code}")

    body = response.json()
    if not body.get("success"):
        raise HTTPException(status_code=404, detail="Player state not found")

    return body["data"]