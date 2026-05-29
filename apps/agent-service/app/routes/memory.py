from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents.memory_agent import summarize_memory
from app.dependencies import get_settings
from app.memory.store import MemoryStore
from app.schemas.models import MemoryEntry

router = APIRouter()

memory_store = MemoryStore()


class SummarizeRequest(BaseModel):
    npc_id: str
    raw_content: str


@router.post("/{session_id}/store", response_model=MemoryEntry)
async def store_memory(session_id: str, entry: MemoryEntry):
    try:
        stored = await memory_store.store(session_id, entry)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Failed to store memory via NestJS: {e}")
    return stored


@router.get("/{session_id}/retrieve", response_model=list[MemoryEntry])
async def retrieve_memories(session_id: str, npc_id: str, limit: int = 20):
    try:
        memories = await memory_store.retrieve(session_id, npc_id, limit)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Failed to retrieve memories via NestJS: {e}")
    return memories


@router.post("/{session_id}/summarize", response_model=list[MemoryEntry])
async def summarize_memories(session_id: str, body: SummarizeRequest):
    settings = get_settings()
    try:
        summaries = await summarize_memory(body.raw_content, body.npc_id, settings)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    stored_summaries: list[MemoryEntry] = []
    for summary in summaries:
        try:
            stored = await memory_store.store(session_id, summary)
            stored_summaries.append(stored)
        except Exception:
            stored_summaries.append(summary)

    return stored_summaries