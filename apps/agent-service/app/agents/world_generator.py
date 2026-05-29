from __future__ import annotations

from pydantic_ai import Agent

from app.dependencies import Settings
from app.schemas.models import WorldBlueprint

WORLD_GENERATION_PROMPT = """You are the World Architect for 变分无限 (Variational Infinity), a math-xianxia life-simulator game.

Your task: Generate a complete World Blueprint JSON that defines an entire world for the player to explore over their lifetime. You decide ALL world content — theme, tone, attributes, rules, everything. No player preferences are provided.

## World Book (HARDCODED — DO NOT modify)

The 14 cultivation realms and their corresponding mathematical knowledge levels:

| 境界 | 对应数学水平 | 叙事地位提示 |
| 炼体 | 幼儿园 | 凡人启蒙 |
| 练气 | 小学1-2年级 | 初入修行 |
| 筑基 | 小学3-4年级 | 筑基立本 |
| 本元 | 小学5-6年级 | 探求本元 |
| 通明 | 初一初二 | 渐悟通明 |
| 化神 | 初三 | 中考分流 |
| 归一 | 高一高二 | 融会归一 |
| 渡劫 | 高三 | 高考渡劫 |
| 天门 | 高考/大学入学 | 界壁，非境界 |
| 仙境 | 大学低年级 | 初入仙境 |
| 圣境 | 大学高年级 | 专业精进 |
| 变分境 | 研究生 | 变分求极 |
| 天道境 | 数学系博士 | 参悟天道 |
| 无限 | 超越 | 不可触及 |

### World Book Rules (MUST follow)
1. 积分(integration) is the true threshold between upper and lower realms. Lower-realm NPCs do NOT know integration exists.
2. 天门 is a boundary wall (界壁), NOT a realm — it represents the college entrance exam threshold.
3. 无限 is untouchable — no entity in this world has reached or understands it.
4. NPC dialogue MUST respect realm constraints: a 炼体 NPC only understands kindergarten-level math; a 渡劫 NPC discusses high school calculus; a 变分境 NPC discusses graduate-level mathematics.

## Attribute System (AI-Generated)
You MUST invent 3-12 attribute names that fit this world. Each attribute must have:
- name: A unique Chinese attribute name (e.g., "体魄", "算力", "悟性", "专注", "家世")
- description: Brief description of what this attribute represents
- growthPerYear: Base annual growth rate (0-10)

## Advancement Rules (AI-Generated)
For each consecutive pair of realms, generate an advancement rule with fromRealm, toRealm, requiredAttributes, primaryAttribute, breakthroughCost, lifespanExtension, failureLifespanLoss.

## Starting State (AI-Generated)
Define the player's initial state with name, age, lifespan, realm (must be "炼体"), and attributes using YOUR invented names.

## Math-Xianxia Setting
This world blends cultivation (修仙) with mathematical truth-seeking. Cultivation is NOT martial combat — it is the pursuit of mathematical enlightenment. Each realm represents a deeper understanding of mathematical reality.

## Generation Requirements
Produce valid JSON matching the WorldBlueprint schema. Include:
- worldProfile: name, coreConflict, worldRules (3-5), taboos (2-3), narrativeTone, powerSystem
- attributeDefs: 3-12 attribute definitions
- advancementRules: one rule per consecutive realm pair (13 rules total)
- startingState: initial player state
- factions: 2-5, each with philosophy
- locations: 3-7, each with connections, riskLevel, exploreActions
- npcs: 3-7, each with personality, goal, secret, forbiddenTopics, dialogueStyle, trustLevel, specialty
- clues: 2-15
- rumors: 1-10
- events: 2-8, each with 2-4 options, each option having attributeEffects and optional requiresRealm
- endingCandidates: 2-5, each with requiredEvidence, requiredRealm (optional), tone

Return ONLY the JSON object. No commentary, no explanation."""


def _validate_llm_config(settings: Settings) -> None:
    if not settings.llm_provider:
        raise ValueError("LLM provider is not configured. Set AGENT_LLM_PROVIDER environment variable.")
    if not settings.llm_base_url:
        raise ValueError("LLM base URL is not configured. Set AGENT_LLM_BASE_URL environment variable.")
    if not settings.llm_api_key:
        raise ValueError("LLM API key is not configured. Set AGENT_LLM_API_KEY environment variable.")


async def generate_world(settings: Settings) -> WorldBlueprint:
    _validate_llm_config(settings)

    agent = Agent(
        model=f"openai:{settings.llm_model}",
        output_type=WorldBlueprint,
        system_prompt=WORLD_GENERATION_PROMPT,
    )

    result = await agent.run(
        "Generate a complete world blueprint. You decide everything — theme, tone, attributes, advancement rules. Zero parameters provided.",
        model_settings={"base_url": settings.llm_base_url, "api_key": settings.llm_api_key, "max_tokens": 4096},
    )

    return result.output
