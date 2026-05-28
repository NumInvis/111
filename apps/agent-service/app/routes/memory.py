from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.agents.memory_agent import summarize_memory
from app.dependencies import get_settings
from app.memory.store import MemoryStore
from app.schemas.models import MemoryEntry

router = APIRouter()

memory_store = MemoryStore()


@router.post("/store", response_model=MemoryEntry)
async def store_memory(entry: MemoryEntry):
    entry.created_at = datetime.now(timezone.utc).isoformat()
    memory_store.add_long_term(entry)
    return entry


@router.post("/retrieve", response_model=list[MemoryEntry])
async def retrieve_memories(npc_id: str, limit: int = 20):
    memories = memory_store.get_long_term(npc_id, limit)
    return memories


@router.post("/summarize", response_model=list[MemoryEntry])
async def summarize_memories(npc_id: str, raw_content: str):
    settings = get_settings()
    try:
        summaries = await summarize_memory(raw_content, npc_id, settings)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    for summary in summaries:
        memory_store.add_long_term(summary)
    return summaries