from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from pydantic import BaseModel
from pydantic_ai import Agent

from app.dependencies import Settings
from app.schemas.models import MemoryEntry

MEMORY_SUMMARIZE_PROMPT = """You are the Memory Compressor for 变分无限 (Variational Infinity), a math-xianxia life-simulator game.

Your task: Compress a sequence of dialogue messages and events into concise memory entries that an NPC can recall in future interactions.

## NPC Context
NPC ID: {npc_id}

## Compression Rules (MUST follow)

### Importance Filtering
- Assign importance (0-1) based on: emotional impact, revelation of secrets, cultivation insights, trust changes
- Discard trivial exchanges (greetings, small talk) — they are NOT memorable
- Keep: promises made, secrets hinted, emotional moments, cultivation advice, conflict points

### Memory Types
- observation: What the NPC observed about the player's behavior or state
- reflection: What the NPC thinks/feels about the interaction
- plan: What the NPC intends to do next based on this interaction

### Compression Quality
- Each memory entry should be 1-3 sentences — concise but information-dense
- Preserve emotional nuance (anger, gratitude, suspicion)
- Preserve factual content (specific claims, promises, revelations)
- Preserve relational context (trust level, shared history)

### Trust Sensitivity
- High trust NPCs remember more personal details
- Low trust NPCs only remember transactional facts
- Trust changes are themselves memorable events

Raw content to compress:
{raw_content}

Return ONLY a JSON array of memory entry objects with fields: memory_type, content, importance, source. Do not include id, npc_id, session_id, or created_at — those will be added automatically."""


class CompressedMemory(BaseModel):
    memory_type: str
    content: str
    importance: float
    source: str


def _validate_llm_config(settings: Settings) -> None:
    if not settings.llm_provider:
        raise ValueError("LLM provider is not configured. Set AGENT_LLM_PROVIDER environment variable.")
    if not settings.llm_base_url:
        raise ValueError("LLM base URL is not configured. Set AGENT_LLM_BASE_URL environment variable.")
    if not settings.llm_api_key:
        raise ValueError("LLM API key is not configured. Set AGENT_LLM_API_KEY environment variable.")


async def summarize_memory(raw_content: str, npc_id: str, settings: Settings) -> list[MemoryEntry]:
    _validate_llm_config(settings)

    agent = Agent(
        model=f"openai:{settings.llm_model}",
        output_type=list[CompressedMemory],
        system_prompt=MEMORY_SUMMARIZE_PROMPT.format(
            npc_id=npc_id,
            raw_content=raw_content,
        ),
    )

    result = await agent.run(
        f"Compress the following content into memory entries for NPC {npc_id}: {raw_content}",
        model_settings={"base_url": settings.llm_base_url, "api_key": settings.llm_api_key},
    )

    now = datetime.now(timezone.utc).isoformat()
    entries = []
    for compressed in result.output:
        entries.append(
            MemoryEntry(
                id=str(uuid4()),
                npc_id=npc_id,
                memory_type=compressed.memory_type,
                content=compressed.content,
                importance=compressed.importance,
                source=compressed.source,
                created_at=now,
            )
        )

    return entries