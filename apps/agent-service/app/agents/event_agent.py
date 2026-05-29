from __future__ import annotations

import json
from string import Template

from pydantic_ai import Agent

from app.dependencies import Settings
from app.schemas.models import EventGenerationRequest, EventSeed

EVENT_GENERATION_PROMPT = Template("""You are the Event Engine for 变分无限 (Variational Infinity), a math-xianxia life-simulator game.

Your task: Generate an event with 2-3 meaningful choices that present REAL trade-offs for the player.

## Realm System — 14 Fixed Realms
1. lianTi → 炼体, 2. lianQi → 练气, 3. zhuJi → 筑基, 4. benYuan → 本元, 5. tongMing → 通明,
6. huaShen → 化神, 7. guiYi → 归一, 8. duJie → 渡劫, 9. tianMen → 天门, 10. xianJing → 仙境,
11. shengJing → 圣境, 12. bianFenJing → 变分境, 13. tianDaoJing → 天道境, 14. wuXian → 无限

### 8 Attributes
- calculation (计算), geometry (几何), abstraction (抽象), proof (证明),
- intuition (直觉), focus (专注), physique (体魄), family (家世)

## Event Generation Rules (MUST follow)

### Real Trade-Offs
Every choice must have:
- Clear attribute effects (positive AND negative on different attributes)
- Risk level (low/medium/high/extreme)
- Realm requirements for certain options (some choices only available to higher realms)
- Consequence hints that are honest but not fully revealing
- NO "obviously best" option — each choice has genuine pros and cons

### Attribute Effects
Each option must specify attributeEffects as a map of attribute name → numeric change (positive or negative).
Range per effect: -15 to +15 (significant but not overwhelming)

### Math-Xianxia Theme
Events blend mathematical challenges with cultivation life:
- A teacher offers a breakthrough method — but it costs family connections
- A rival challenges you to a proof duel — losing hurts your confidence
- A mysterious manuscript appears — studying it strains your focus
- A faction recruits you — membership grants resources but demands obedience

Context:
Player state: $player_state
Current location: $location_id
Discovered clues: $discovered_clues

Return ONLY the JSON object matching the EventSeed schema. No commentary.""")


def _validate_llm_config(settings: Settings) -> None:
    if not settings.llm_provider:
        raise ValueError("LLM provider is not configured. Set AGENT_LLM_PROVIDER environment variable.")
    if not settings.llm_base_url:
        raise ValueError("LLM base URL is not configured. Set AGENT_LLM_BASE_URL environment variable.")
    if not settings.llm_api_key:
        raise ValueError("LLM API key is not configured. Set AGENT_LLM_API_KEY environment variable.")


async def generate_event(request: EventGenerationRequest, settings: Settings) -> EventSeed:
    _validate_llm_config(settings)

    agent = Agent(
        model=f"openai:{settings.llm_model}",
        output_type=EventSeed,
        system_prompt=EVENT_GENERATION_PROMPT.substitute(
            player_state=json.dumps(request.player_state),
            location_id=request.current_location_id,
            discovered_clues=", ".join(request.discovered_clues),
        ),
    )

    result = await agent.run(
        f"Generate an event at location '{request.current_location_id}' for this player state.",
        model_settings={"base_url": settings.llm_base_url, "api_key": settings.llm_api_key, "max_tokens": 4096},
    )

    return result.output