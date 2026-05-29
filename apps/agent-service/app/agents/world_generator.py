from __future__ import annotations

from string import Template

from pydantic_ai import Agent

from app.dependencies import Settings
from app.schemas.models import GenerationPreferences, WorldBlueprint

WORLD_GENERATION_PROMPT = Template("""You are the World Architect for 变分无限 (Variational Infinity), a math-xianxia life-simulator game.

Your task: Generate a complete World Blueprint JSON that defines an entire world for the player to explore over their lifetime.

## World Rules (MUST follow all)

### Realm System — 14 Fixed Realms (DO NOT rename or reorder)
The cultivation hierarchy uses exactly these 14 realm IDs and names, ordered from lowest to highest:
1. lianTi → 炼体 (Body Tempering)
2. lianQi → 练气 (Qi Refining)
3. zhuJi → 筑基 (Foundation Building)
4. benYuan → 本元 (Origin Core)
5. tongMing → 通明 (Clarity Illumination)
6. huaShen → 化神 (Spirit Transformation)
7. guiYi → 归一 (Unity Return)
8. duJie → 渡劫 (tribulation Crossing)
9. tianMen → 天门 (Heaven's Gate)
10. xianJing → 仙境 (Immortal Realm)
11. shengJing → 圣境 (Sage Realm)
12. bianFenJing → 变分境 (Variational Realm)
13. tianDaoJing → 天道境 (Celestial Dao Realm)
14. wuXian → 无限 (Infinity / Limitless)

### 8 Attributes (DO NOT rename)
- calculation (计算): Computational and arithmetic reasoning
- geometry (几何): Spatial and geometric reasoning
- abstraction (抽象): Abstract and conceptual reasoning
- proof (证明): Logical proof and deductive reasoning
- intuition (直觉): Mathematical intuition and insight
- focus (专注): Concentration and mental endurance
- physique (体魄): Physical health and vitality
- family (家世): Family background and social resources

Each attribute ranges 0-100. Cultivation tiers define minimum thresholds per attribute for advancement.

### Math-Xianxia Setting
This world blends cultivation (修仙) with mathematical truth-seeking. Cultivation is NOT martial combat — it is the pursuit of mathematical enlightenment. Each realm represents a deeper understanding of mathematical reality. The ultimate truth is "变分" (the variational principle) — the idea that nature optimizes, that the shortest path, the least action, the minimal energy reveals truth.

### Annual Event Structure
Each game year, the player faces 2-3 event choices with REAL trade-offs. Every choice has attribute effects, risk levels, and realm requirements. Choices are not obvious — they require strategic thinking about the player's attribute profile and long-term goals.

### Generation Requirements
You MUST produce valid JSON matching the WorldBlueprint schema. Include:
- worldProfile: name, coreConflict, worldRules (3-5), taboos (2-3), narrativeTone, powerSystem (with all 14 realms in cultivationTiers, 1-3 cultivationPaths)
- factions: 2-5 factions, each with mathematicalDoctrine
- locations: 3-7, each with connections, riskLevel, exploreActions (1-4)
- npcs: 3-7, each with personality (2-5 traits), goal, secret, forbiddenTopics, dialogueStyle, trustLevel
- clues: 3-15, each with name, description, category, optional locationId/npcId/relatedEndingIds
- rumors: 2-10, each with credibility and optional relatedLocation/relatedNpc
- events: 3-8, each with 2-4 options, each option having attributeEffects and optional requiresRealm
- endingCandidates: 2-5, each with requiredEvidence (clue IDs), requiredRealm (optional), tone

Theme: $theme
Scale: $scale
Tone: $tone
Seed: $seed

Return ONLY the JSON object. No commentary, no explanation.""")


def _validate_llm_config(settings: Settings) -> None:
    if not settings.llm_provider:
        raise ValueError("LLM provider is not configured. Set AGENT_LLM_PROVIDER environment variable.")
    if not settings.llm_base_url:
        raise ValueError("LLM base URL is not configured. Set AGENT_LLM_BASE_URL environment variable.")
    if not settings.llm_api_key:
        raise ValueError("LLM API key is not configured. Set AGENT_LLM_API_KEY environment variable.")


async def generate_world(preferences: GenerationPreferences, settings: Settings) -> WorldBlueprint:
    _validate_llm_config(settings)

    agent = Agent(
        model=f"openai:{settings.llm_model}",
        output_type=WorldBlueprint,
        system_prompt=WORLD_GENERATION_PROMPT.substitute(
            theme=preferences.theme,
            scale=preferences.scale,
            tone=preferences.tone,
            seed=str(preferences.seed or "none"),
        ),
    )

    result = await agent.run(
        f"Generate a world blueprint for theme '{preferences.theme}', scale '{preferences.scale}', tone '{preferences.tone}'.",
        model_settings={"base_url": settings.llm_base_url, "api_key": settings.llm_api_key, "max_tokens": 4096},
    )

    return result.output