from __future__ import annotations

import re
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


def to_camel(name: str) -> str:
    parts = name.split('_')
    return parts[0] + ''.join(p.capitalize() for p in parts[1:])


class CultivationPath(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: str = Field(description="Unique identifier for the cultivation path")
    name: str = Field(description="Display name of the cultivation path")
    description: str = Field(description="Description of the cultivation path philosophy and methods")
    tier_ids: list[str] = Field(alias="tierIds", description="Ordered list of cultivation tier IDs along this path")


class CultivationTier(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: str = Field(description="Unique identifier for the cultivation tier/realm")
    name: str = Field(description="Display name of the cultivation realm in Chinese")
    required_attributes: dict[str, int] = Field(alias="requiredAttributes", description="Minimum attribute values required to reach this realm")


class LegendaryFigure(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: str = Field(description="Unique identifier for the legendary figure")
    name: str = Field(description="Display name of the legendary figure")
    realm: str = Field(description="The cultivation realm this figure has achieved")
    mathematical_contribution: str = Field(alias="mathematicalContribution", description="This figure's key mathematical insight or contribution")
    legend: str = Field(description="Brief legend or lore about this figure")


class PowerSystem(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    cultivation_paths: list[CultivationPath] = Field(alias="cultivationPaths", min_length=1, description="Available cultivation paths a player may follow")
    cultivation_tiers: list[CultivationTier] = Field(alias="cultivationTiers", description="Ordered list of all cultivation tiers/realm stages")
    legendary_figures: Optional[list[LegendaryFigure]] = Field(alias="legendaryFigures", default=None, description="Optional legendary figures who have reached high realms")


class WorldProfile(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    name: str = Field(description="Name of the generated world")
    core_conflict: str = Field(alias="coreConflict", description="The central conflict driving the world's narrative")
    world_rules: list[str] = Field(alias="worldRules", description="Fundamental rules governing this world")
    taboos: list[str] = Field(description="Taboos and forbidden actions in this world")
    narrative_tone: str = Field(alias="narrativeTone", description="Overall narrative tone (e.g., dark, humorous, philosophical)")
    power_system: PowerSystem = Field(alias="powerSystem", description="The cultivation/power system defining realm progression")


class Faction(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: str = Field(description="Unique identifier for the faction")
    name: str = Field(description="Display name of the faction")
    goal: str = Field(description="The faction's primary objective or motivation")
    conflict: str = Field(description="What this faction is in conflict over or against")
    mathematical_doctrine: Optional[str] = Field(alias="mathematicalDoctrine", default=None, description="Optional mathematical philosophy or doctrine the faction follows")


class Location(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: str = Field(description="Unique identifier for the location")
    name: str = Field(description="Display name of the location")
    description: str = Field(description="Detailed description of the location's appearance and atmosphere")
    connections: list[str] = Field(description="IDs of locations connected to this one for navigation")
    risk_level: str = Field(alias="riskLevel", description="Danger level of this location: low, medium, high, or extreme")
    explore_actions: list[str] = Field(alias="exploreActions", min_length=1, max_length=4, description="Available exploration actions at this location (1-4)")
    atmosphere: Optional[str] = Field(default=None, description="Optional atmospheric description or mood tags")


class NpcSeed(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: str = Field(description="Unique identifier for the NPC")
    name: str = Field(description="Display name of the NPC")
    role: str = Field(description="Role archetype of the NPC in the world (e.g., mentor, rival, merchant)")
    faction: Optional[str] = Field(default=None, description="Optional faction ID the NPC belongs to")
    personality: list[str] = Field(min_length=2, max_length=5, description="Personality trait tags for this NPC (2-5 traits)")
    goal: str = Field(description="The NPC's primary personal goal or motivation")
    secret: str = Field(description="A hidden secret the NPC conceals from the player")
    forbidden_topics: list[str] = Field(alias="forbiddenTopics", description="Topics the NPC refuses to discuss or reacts negatively to")
    dialogue_style: str = Field(alias="dialogueStyle", description="Description of the NPC's speech pattern and conversational style")
    cultivation_level: Optional[str] = Field(alias="cultivationLevel", default=None, description="Optional cultivation realm name the NPC has achieved")
    mathematical_strength: Optional[str] = Field(alias="mathematicalStrength", default=None, description="Optional mathematical domain the NPC excels in")
    trust_level: float = Field(alias="trustLevel", default=0.3, ge=0.0, le=1.0, description="Initial trust level toward the player (0-1, default 0.3)")


class Rumor(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: str = Field(description="Unique identifier for the rumor")
    content: str = Field(description="The rumor text content")
    credibility: float = Field(ge=0.0, le=1.0, description="How credible this rumor is perceived to be (0-1)")
    related_location: Optional[str] = Field(alias="relatedLocation", default=None, description="Optional location ID where this rumor originates or relates to")
    related_npc: Optional[str] = Field(alias="relatedNpc", default=None, description="Optional NPC ID who is the source or subject of this rumor")


class EventOption(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    label: str = Field(description="Short label for the choice option")
    description: str = Field(description="Detailed description of what this choice entails")
    risk_level: Optional[str] = Field(alias="riskLevel", default=None, description="Optional risk level: low, medium, high, extreme")
    consequence_hint: str = Field(alias="consequenceHint", description="Brief hint about potential consequences of this choice")
    attribute_effects: Optional[dict[str, int]] = Field(alias="attributeEffects", default=None, description="Optional attribute name to numeric effect mapping")
    requires_realm: Optional[str] = Field(alias="requiresRealm", default=None, description="Optional realm ID required to be eligible for this option")


class EventSeed(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: str = Field(description="Unique identifier for the event seed")
    trigger_condition: str = Field(alias="triggerCondition", description="Condition description for when this event triggers")
    location_id: str = Field(alias="locationId", description="Location ID where this event takes place")
    description: str = Field(description="Narrative description of the event scenario")
    one_time: bool = Field(alias="oneTime", default=True, description="Whether this event can only trigger once per game session")
    options: list[EventOption] = Field(min_length=2, max_length=4, description="Available choices for the player (2-4 options)")
    related_npc_ids: Optional[list[str]] = Field(alias="relatedNpcIds", default=None, description="Optional NPC IDs involved in this event")


class EndingCandidate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: str = Field(description="Unique identifier for the ending candidate")
    title: str = Field(description="Display title of the ending")
    description: str = Field(description="Narrative description of the ending scenario")
    required_evidence: list[str] = Field(alias="requiredEvidence", description="List of evidence/clue IDs required to unlock this ending")
    required_realm: Optional[str] = Field(alias="requiredRealm", default=None, description="Optional realm ID required to be eligible for this ending")
    tone: str = Field(description="Narrative tone of the ending (e.g., triumphant, tragic, mysterious)")


class WorldBlueprint(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    world_profile: WorldProfile = Field(alias="worldProfile", description="Core world profile defining the narrative setting")
    factions: list[Faction] = Field(min_length=2, max_length=5, description="Factions in this world (2-5)")
    locations: list[Location] = Field(min_length=3, max_length=7, description="Explorable locations in this world (3-7)")
    npcs: list[NpcSeed] = Field(min_length=3, max_length=7, description="NPCs populating this world (3-7)")
    rumors: list[Rumor] = Field(min_length=2, max_length=10, description="Rumors circulating in this world (2-10)")
    events: list[EventSeed] = Field(min_length=3, max_length=8, description="Event seeds that may trigger during play (3-8)")
    ending_candidates: list[EndingCandidate] = Field(alias="endingCandidates", min_length=2, max_length=5, description="Possible endings the player may reach (2-5)")
    state_model: Optional[dict[str, list[int]]] = Field(alias="stateModel", default=None, description="Optional model of state field names to allowed value ranges [min, max]")


class GenerationPreferences(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    theme: str = Field(description="Theme for world generation")
    scale: str = Field(description="Scale of world: small, medium, or large")
    tone: str = Field(description="Tone for world generation")
    seed: Optional[int] = Field(default=None, description="Optional seed for reproducible generation")
    mode: str = Field(description="Generation mode: quick, complete, or infinite")


class NpcDialogueRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    session_id: str = Field(alias="sessionId", description="The game session ID for this dialogue")
    npc_id: str = Field(alias="npcId", description="The NPC ID to generate dialogue for")
    player_input: str = Field(alias="playerInput", description="The player's message to the NPC")
    current_location_id: Optional[str] = Field(alias="currentLocationId", default=None, description="Optional current location ID context")
    npc_context: Optional[dict] = Field(alias="npcContext", default=None, description="Optional NPC context data (personality, realm, trust, etc.)")


class NpcDialogueOutput(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    content: str = Field(description="The NPC's dialogue response text")
    emotion: str = Field(description="The NPC's emotional state in this response")
    trust_change: float = Field(alias="trustChange", ge=-0.1, le=0.1, description="Change in trust level toward the player (-0.1 to 0.1)")
    suggested_follow_up: Optional[str] = Field(alias="suggestedFollowUp", default=None, description="Optional suggested follow-up topic or action")
    memory_reference: Optional[str] = Field(alias="memoryReference", default=None, description="Optional reference to a past memory entry that informed this response")


class EventGenerationRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    session_id: str = Field(alias="sessionId", description="The game session ID for this event")
    current_location_id: str = Field(alias="currentLocationId", description="The location ID where the event takes place")
    player_state: dict = Field(alias="playerState", description="Current player state including attributes, realm, age")
    discovered_clues: list[str] = Field(alias="discoveredClues", description="Clue IDs the player has discovered so far")


class EndingGenerationRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    session_id: str = Field(alias="sessionId", description="The game session ID for this ending evaluation")
    discovered_evidence: list[str] = Field(alias="discoveredEvidence", description="Evidence/clue IDs the player has discovered")
    journey_summary: str = Field(alias="journeySummary", description="Narrative summary of the player's life journey")
    player_state: dict = Field(alias="playerState", description="Current player state including attributes, realm, age")


class MemoryEntry(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: str = Field(description="Unique identifier for the memory entry")
    npc_id: str = Field(alias="npcId", description="The NPC ID this memory belongs to")
    session_id: Optional[str] = Field(alias="sessionId", default=None, description="Optional game session ID context for this memory")
    memory_type: str = Field(alias="memoryType", description="The classification of this memory entry: observation, reflection, or plan")
    content: str = Field(description="The text content of the memory")
    importance: float = Field(ge=0.0, le=1.0, description="How important this memory is to the NPC (0-1)")
    source: str = Field(description="Where this memory originated from: dialogue, event, or reflection")
    created_at: str = Field(alias="createdAt", description="Timestamp when this memory was created (ISO 8601)")