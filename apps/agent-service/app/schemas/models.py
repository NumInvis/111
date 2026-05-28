from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class CultivationPath(BaseModel):
    id: str = Field(description="Unique identifier for the cultivation path")
    name: str = Field(description="Display name of the cultivation path")
    description: str = Field(description="Description of the cultivation path philosophy and methods")
    tier_ids: list[str] = Field(description="Ordered list of cultivation tier IDs along this path")


class CultivationTier(BaseModel):
    id: str = Field(description="Unique identifier for the cultivation tier/realm")
    name: str = Field(description="Display name of the cultivation realm in Chinese")
    required_attributes: dict[str, int] = Field(description="Minimum attribute values required to reach this realm")


class PowerSystem(BaseModel):
    cultivation_paths: list[CultivationPath] = Field(min_length=1, description="Available cultivation paths a player may follow")
    cultivation_tiers: list[CultivationTier] = Field(description="Ordered list of all cultivation tiers/realm stages")


class WorldProfile(BaseModel):
    name: str = Field(description="Name of the generated world")
    core_conflict: str = Field(description="The central conflict driving the world's narrative")
    world_rules: list[str] = Field(description="Fundamental rules governing this world")
    taboos: list[str] = Field(description="Taboos and forbidden actions in this world")
    narrative_tone: str = Field(description="Overall narrative tone (e.g., dark, humorous, philosophical)")
    power_system: PowerSystem = Field(description="The cultivation/power system defining realm progression")


class Faction(BaseModel):
    id: str = Field(description="Unique identifier for the faction")
    name: str = Field(description="Display name of the faction")
    goal: str = Field(description="The faction's primary objective or motivation")
    conflict: str = Field(description="What this faction is in conflict over or against")
    mathematical_doctrine: Optional[str] = Field(default=None, description="Optional mathematical philosophy or doctrine the faction follows")


class Location(BaseModel):
    id: str = Field(description="Unique identifier for the location")
    name: str = Field(description="Display name of the location")
    description: str = Field(description="Detailed description of the location's appearance and atmosphere")
    connections: list[str] = Field(description="IDs of locations connected to this one for navigation")
    risk_level: str = Field(description="Danger level of this location: low, medium, high, or extreme")
    explore_actions: list[str] = Field(min_length=1, max_length=4, description="Available exploration actions at this location (1-4)")
    atmosphere: Optional[str] = Field(default=None, description="Optional atmospheric description or mood tags")


class NpcSeed(BaseModel):
    id: str = Field(description="Unique identifier for the NPC")
    name: str = Field(description="Display name of the NPC")
    role: str = Field(description="Role archetype of the NPC in the world (e.g., mentor, rival, merchant)")
    faction: Optional[str] = Field(default=None, description="Optional faction ID the NPC belongs to")
    personality: list[str] = Field(min_length=2, max_length=5, description="Personality trait tags for this NPC (2-5 traits)")
    goal: str = Field(description="The NPC's primary personal goal or motivation")
    secret: str = Field(description="A hidden secret the NPC conceals from the player")
    forbidden_topics: list[str] = Field(description="Topics the NPC refuses to discuss or reacts negatively to")
    dialogue_style: str = Field(description="Description of the NPC's speech pattern and conversational style")
    cultivation_level: Optional[str] = Field(default=None, description="Optional cultivation realm name the NPC has achieved")
    mathematical_strength: Optional[str] = Field(default=None, description="Optional mathematical domain the NPC excels in")
    trust_level: float = Field(default=0.3, ge=0.0, le=1.0, description="Initial trust level toward the player (0-1, default 0.3)")


class Rumor(BaseModel):
    id: str = Field(description="Unique identifier for the rumor")
    content: str = Field(description="The rumor text content")
    credibility: float = Field(ge=0.0, le=1.0, description="How credible this rumor is perceived to be (0-1)")
    related_location: Optional[str] = Field(default=None, description="Optional location ID where this rumor originates or relates to")
    related_npc: Optional[str] = Field(default=None, description="Optional NPC ID who is the source or subject of this rumor")


class EventOption(BaseModel):
    label: str = Field(description="Short label for the choice option")
    description: str = Field(description="Detailed description of what this choice entails")
    risk_level: Optional[str] = Field(default=None, description="Optional risk level: low, medium, high, extreme")
    consequence_hint: str = Field(description="Brief hint about potential consequences of this choice")
    attribute_effects: Optional[dict[str, int]] = Field(default=None, description="Optional attribute name to numeric effect mapping")
    requires_realm: Optional[str] = Field(default=None, description="Optional realm ID required to be eligible for this option")


class EventSeed(BaseModel):
    id: str = Field(description="Unique identifier for the event seed")
    trigger_condition: str = Field(description="Condition description for when this event triggers")
    location_id: str = Field(description="Location ID where this event takes place")
    description: str = Field(description="Narrative description of the event scenario")
    options: list[EventOption] = Field(min_length=2, max_length=4, description="Available choices for the player (2-4 options)")
    related_npc_ids: Optional[list[str]] = Field(default=None, description="Optional NPC IDs involved in this event")


class EndingCandidate(BaseModel):
    id: str = Field(description="Unique identifier for the ending candidate")
    title: str = Field(description="Display title of the ending")
    description: str = Field(description="Narrative description of the ending scenario")
    required_evidence: list[str] = Field(description="List of evidence/clue IDs required to unlock this ending")
    required_realm: Optional[str] = Field(default=None, description="Optional realm ID required to be eligible for this ending")
    tone: str = Field(description="Narrative tone of the ending (e.g., triumphant, tragic, mysterious)")


class WorldBlueprint(BaseModel):
    world_profile: WorldProfile = Field(description="Core world profile defining the narrative setting")
    factions: list[Faction] = Field(min_length=2, max_length=5, description="Factions in this world (2-5)")
    locations: list[Location] = Field(min_length=3, max_length=7, description="Explorable locations in this world (3-7)")
    npcs: list[NpcSeed] = Field(min_length=3, max_length=7, description="NPCs populating this world (3-7)")
    rumors: list[Rumor] = Field(min_length=2, max_length=10, description="Rumors circulating in this world (2-10)")
    events: list[EventSeed] = Field(min_length=3, max_length=8, description="Event seeds that may trigger during play (3-8)")
    ending_candidates: list[EndingCandidate] = Field(min_length=2, max_length=5, description="Possible endings the player may reach (2-5)")
    state_model: Optional[dict[str, list[int]]] = Field(default=None, description="Optional model of state field names to allowed value ranges [min, max]")


class GenerationPreferences(BaseModel):
    theme: str = Field(description="Theme for world generation")
    scale: str = Field(description="Scale of world: small, medium, or large")
    tone: str = Field(description="Tone for world generation")
    seed: Optional[int] = Field(default=None, description="Optional seed for reproducible generation")
    mode: str = Field(description="Generation mode: quick, complete, or infinite")


class NpcDialogueRequest(BaseModel):
    session_id: str = Field(description="The game session ID for this dialogue")
    npc_id: str = Field(description="The NPC ID to generate dialogue for")
    player_input: str = Field(description="The player's message to the NPC")
    current_location_id: Optional[str] = Field(default=None, description="Optional current location ID context")
    npc_context: Optional[dict] = Field(default=None, description="Optional NPC context data (personality, realm, trust, etc.)")


class NpcDialogueOutput(BaseModel):
    content: str = Field(description="The NPC's dialogue response text")
    emotion: str = Field(description="The NPC's emotional state in this response")
    trust_change: float = Field(ge=-0.1, le=0.1, description="Change in trust level toward the player (-0.1 to 0.1)")
    suggested_follow_up: Optional[str] = Field(default=None, description="Optional suggested follow-up topic or action")
    memory_reference: Optional[str] = Field(default=None, description="Optional reference to a past memory entry that informed this response")


class EventGenerationRequest(BaseModel):
    session_id: str = Field(description="The game session ID for this event")
    current_location_id: str = Field(description="The location ID where the event takes place")
    player_state: dict = Field(description="Current player state including attributes, realm, age")
    discovered_clues: list[str] = Field(description="Clue IDs the player has discovered so far")


class EndingGenerationRequest(BaseModel):
    session_id: str = Field(description="The game session ID for this ending evaluation")
    discovered_evidence: list[str] = Field(description="Evidence/clue IDs the player has discovered")
    journey_summary: str = Field(description="Narrative summary of the player's life journey")
    player_state: dict = Field(description="Current player state including attributes, realm, age")


class MemoryEntry(BaseModel):
    id: str = Field(description="Unique identifier for the memory entry")
    npc_id: str = Field(description="The NPC ID this memory belongs to")
    session_id: Optional[str] = Field(default=None, description="Optional game session ID context for this memory")
    memory_type: str = Field(description="The classification of this memory entry: observation, reflection, or plan")
    content: str = Field(description="The text content of the memory")
    importance: float = Field(ge=0.0, le=1.0, description="How important this memory is to the NPC (0-1)")
    source: str = Field(description="Where this memory originated from: dialogue, event, or reflection")
    created_at: str = Field(description="Timestamp when this memory was created (ISO 8601)")