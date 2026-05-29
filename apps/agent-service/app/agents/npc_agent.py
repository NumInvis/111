from __future__ import annotations

from pydantic_ai import Agent

from app.dependencies import Settings
from app.safety.pipeline import check_input_safety
from app.schemas.models import NpcDialogueOutput, NpcDialogueRequest

NPC_DIALOGUE_PROMPT = """You are an NPC in the 变分无限 (Variational Infinity) world — a math-xianxia life-simulator where cultivation is the pursuit of mathematical truth.

## NPC Profile
Name: {npc_name}
Role: {npc_role}
Personality: {npc_personality}
Goal: {npc_goal}
Secret: {npc_secret}
Forbidden topics: {npc_forbidden_topics}
Dialogue style: {npc_dialogue_style}
Cultivation realm: {npc_realm}
Trust level toward player: {npc_trust}
Mathematical strength: {npc_math_strength}

## Dialogue Rules (MUST follow)

### Realm-Matched Dialogue
- A 炼体 realm NPC cannot discuss 变分境 concepts — they speak of basic arithmetic and bodily discipline
- A 渡劫 realm NPC speaks of calculus of variations, functional analysis, deep optimization principles
- NEVER let a low-realm NPC reveal high-realm truths — they simply don't understand them
- If the player asks about concepts beyond this NPC's realm, the NPC responds with confusion, dismissal, or their own limited understanding

### Character Consistency
- Stay true to the NPC's personality traits
- Their goal drives their conversation agenda
- Their secret may surface IF trust is high enough (trust >= 0.7)
- Forbidden topics cause the NPC to deflect, get angry, or lie — NEVER freely discuss them

### Memory Reference
- Reference past interactions when relevant
- Build on previously shared knowledge
- Acknowledge the player's known cultivation level
- Remember promises and debts between player and NPC"""

PLAYER_CONTEXT = """
Player's current realm: {player_realm}
Player's message: {player_message}
Previous interaction summary: {memory_summary}
Location context: {location_context}"""


def _validate_llm_config(settings: Settings) -> None:
    if not settings.llm_provider:
        raise ValueError("LLM provider is not configured. Set AGENT_LLM_PROVIDER environment variable.")
    if not settings.llm_base_url:
        raise ValueError("LLM base URL is not configured. Set AGENT_LLM_BASE_URL environment variable.")
    if not settings.llm_api_key:
        raise ValueError("LLM API key is not configured. Set AGENT_LLM_API_KEY environment variable.")


async def generate_npc_dialogue(request: NpcDialogueRequest, settings: Settings) -> NpcDialogueOutput:
    _validate_llm_config(settings)

    ctx = request.npc_context or {}

    for key, val in ctx.items():
        if isinstance(val, str):
            result = check_input_safety(val)
            if not result.safe:
                raise ValueError(f"NPC context field '{key}' failed safety check: {result.errors}")

    system_prompt = NPC_DIALOGUE_PROMPT.format(
        npc_name=ctx.get("name", "Unknown NPC"),
        npc_role=ctx.get("role", "unknown"),
        npc_personality=", ".join(ctx.get("personality", [])),
        npc_goal=ctx.get("goal", "unknown"),
        npc_secret=ctx.get("secret", "unknown"),
        npc_forbidden_topics=", ".join(ctx.get("forbidden_topics", [])),
        npc_dialogue_style=ctx.get("dialogue_style", "neutral"),
        npc_realm=ctx.get("cultivationLevel", ctx.get("cultivation_level", "unknown")),
        npc_trust=str(ctx.get("trust_level", 0.3)),
        npc_math_strength=ctx.get("mathematical_strength", "unknown"),
    )

    user_prompt = PLAYER_CONTEXT.format(
        player_realm=ctx.get("player_realm", "unknown"),
        player_message=request.player_input,
        memory_summary=ctx.get("memory_summary", "No prior interactions."),
        location_context=request.current_location_id or "unknown",
    )

    agent = Agent(
        model=f"openai:{settings.llm_model}",
        output_type=NpcDialogueOutput,
        system_prompt=system_prompt,
    )

    result = await agent.run(
        user_prompt,
        model_settings={"base_url": settings.llm_base_url, "api_key": settings.llm_api_key, "max_tokens": 4096},
    )

    return result.output