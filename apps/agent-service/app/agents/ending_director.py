from __future__ import annotations

import json
from string import Template

from pydantic_ai import Agent

from app.dependencies import Settings
from app.schemas.models import EndingCandidate, EndingGenerationRequest

ENDING_GENERATION_PROMPT = Template("""You are the Ending Arbiter for 变分无限 (Variational Infinity), a math-xianxia life-simulator game.

Your task: Generate an ending candidate based on the player's accumulated evidence and life trajectory.

## Critical Rule: EVIDENCE-BASED ONLY
- You MUST NOT fabricate truths that the player has not discovered
- Ending candidates must be grounded in clues the player actually found
- If the player has no evidence for a particular truth, that ending is NOT available
- Every ending must cite specific clue IDs from the player's discoveredClues list

## Realm System — 14 Fixed Realms
1. lianTi → 炼体, 2. lianQi → 练气, 3. zhuJi → 筑基, 4. benYuan → 本元, 5. tongMing → 通明,
6. huaShen → 化神, 7. guiYi → 归一, 8. duJie → 渡劫, 9. tianMen → 天门, 10. xianJing → 仙境,
11. shengJing → 圣境, 12. bianFenJing → 变分境, 13. tianDaoJing → 天道境, 14. wuXian → 无限

### Ending Generation Rules (MUST follow)

### Evidence Requirement
- Each ending's requiredEvidence must list clue IDs that the player has actually discovered
- If the player lacks a required clue, that ending is NOT eligible
- Endings reflect what the player LEARNED, not what they wished for

### Realm Requirement
- Some endings require reaching a specific cultivation realm
- A player who dies at 炼体 cannot reach the 变分境 ending
- Realm requirements must match the world's realm hierarchy

### Narrative Integrity
- Endings must be consistent with the player's actual life trajectory
- The ending narrative must reference specific events and relationships that occurred
- No "magic reset" endings — consequences are permanent

Context:
Discovered evidence: $discovered_evidence
Journey summary: $journey_summary
Player state: $player_state

Return ONLY the JSON object matching the EndingCandidate schema. No commentary.""")


def _validate_llm_config(settings: Settings) -> None:
    if not settings.llm_provider:
        raise ValueError("LLM provider is not configured. Set AGENT_LLM_PROVIDER environment variable.")
    if not settings.llm_base_url:
        raise ValueError("LLM base URL is not configured. Set AGENT_LLM_BASE_URL environment variable.")
    if not settings.llm_api_key:
        raise ValueError("LLM API key is not configured. Set AGENT_LLM_API_KEY environment variable.")


async def generate_ending_candidate(request: EndingGenerationRequest, settings: Settings) -> EndingCandidate:
    _validate_llm_config(settings)

    agent = Agent(
        model=f"openai:{settings.llm_model}",
        output_type=EndingCandidate,
        system_prompt=ENDING_GENERATION_PROMPT.substitute(
            discovered_evidence=", ".join(request.discovered_evidence),
            journey_summary=request.journey_summary,
            player_state=json.dumps(request.player_state),
        ),
    )

    result = await agent.run(
        f"Evaluate ending eligibility based on discovered evidence: {', '.join(request.discovered_evidence)}",
        model_settings={"base_url": settings.llm_base_url, "api_key": settings.llm_api_key, "max_tokens": 4096},
    )

    return result.output