from __future__ import annotations

import httpx

from app.dependencies import get_settings
from app.schemas.models import MemoryEntry


class MemoryStore:
    def __init__(self) -> None:
        self._settings = get_settings()

    async def _get_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self._settings.nestjs_api_url,
            timeout=30.0,
        )

    async def store(self, session_id: str, entry: MemoryEntry) -> MemoryEntry:
        client = await self._get_client()
        try:
            payload = {
                "npcId": entry.npc_id,
                "memoryType": entry.memory_type,
                "content": entry.content,
                "importance": entry.importance,
                "source": entry.source,
            }
            if entry.session_id:
                payload["sessionId"] = entry.session_id

            response = await client.post(
                f"/api/game/sessions/{session_id}/agent-memory",
                json=payload,
            )
            if response.status_code != 200 and response.status_code != 201:
                raise httpx.HTTPStatusError(
                    f"NestJS agent-memory POST returned {response.status_code}",
                    request=response.request,
                    response=response,
                )
            body = response.json()
            data = body.get("data", body)
            return MemoryEntry.model_validate(data)
        finally:
            await client.aclose()

    async def retrieve(self, session_id: str, npc_id: str, limit: int = 20) -> list[MemoryEntry]:
        client = await self._get_client()
        try:
            response = await client.get(
                f"/api/game/sessions/{session_id}/agent-memory",
                params={"npcId": npc_id, "limit": limit},
            )
            if response.status_code != 200:
                raise httpx.HTTPStatusError(
                    f"NestJS agent-memory GET returned {response.status_code}",
                    request=response.request,
                    response=response,
                )
            body = response.json()
            data = body.get("data", body)
            if isinstance(data, list):
                return [MemoryEntry.model_validate(item) for item in data]
            return []
        finally:
            await client.aclose()