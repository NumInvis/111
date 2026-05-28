import type {
  PlayerState,
  WorldBlueprint,
  Attribute,
  GameEvent,
  EventType,
  JournalEntry,
  JournalCategory,
  RelationshipState,
  FriendshipLevel,
} from '@variational-infinity/shared';
import { realmOrder } from '../state-machine/game-state-machine';
import { RealmAdvancementChecker, REALM_NAMES_ORDERED } from '../rules/rules';
import type { RealmName } from '@variational-infinity/shared';

export interface StateUpdate {
  newState: Partial<PlayerState>;
  journalEntries: JournalEntry[];
  events: GameEvent[];
  relationships: Record<string, RelationshipState>;
}

function createJournalEntry(
  sessionId: string,
  turn: number,
  locationId: string,
  action: string,
  result: string,
  category: JournalCategory,
  evidenceTag?: boolean,
): JournalEntry {
  return {
    id: crypto.randomUUID(),
    sessionId,
    turn,
    locationId,
    action,
    result,
    evidenceTag,
    category,
  };
}

function createGameEvent(
  sessionId: string,
  turn: number,
  eventType: EventType,
  data: Record<string, unknown>,
): GameEvent {
  return {
    sessionId,
    eventType,
    data,
    turn,
  };
}

export function applyMoveAction(
  sessionId: string,
  currentState: PlayerState,
  payload: { targetLocationId: string },
  worldBlueprint: WorldBlueprint,
): StateUpdate {
  const targetLocation = worldBlueprint.locations.find(
    (l) => l.id === payload.targetLocationId,
  );

  if (!targetLocation) {
    throw new Error(`Target location "${payload.targetLocationId}" not found in world blueprint.`);
  }

  const discoveredLocations = currentState.discoveredLocations.includes(payload.targetLocationId)
    ? currentState.discoveredLocations
    : [...currentState.discoveredLocations, payload.targetLocationId];

  const journalEntry = createJournalEntry(
    sessionId,
    currentState.age,
    payload.targetLocationId,
    `move to ${targetLocation.name}`,
    `Arrived at ${targetLocation.name}. ${targetLocation.description}`,
    'discovery',
  );

  const event = createGameEvent(
    sessionId,
    currentState.age,
    'discovery',
    {
      locationId: payload.targetLocationId,
      locationName: targetLocation.name,
      description: targetLocation.description,
      atmosphere: targetLocation.atmosphere,
    },
  );

  return {
    newState: {
      currentLocationId: payload.targetLocationId,
      discoveredLocations,
    },
    journalEntries: [journalEntry],
    events: [event],
    relationships: currentState.relationships,
  };
}

export function applyTalkAction(
  sessionId: string,
  currentState: PlayerState,
  payload: { npcId: string },
  worldBlueprint: WorldBlueprint,
): StateUpdate {
  const npc = worldBlueprint.npcs.find((n) => n.id === payload.npcId);

  if (!npc) {
    throw new Error(`NPC "${payload.npcId}" not found in world blueprint.`);
  }

  const discoveredNpcs = currentState.discoveredNpcs.includes(payload.npcId)
    ? currentState.discoveredNpcs
    : [...currentState.discoveredNpcs, payload.npcId];

  const journalEntry = createJournalEntry(
    sessionId,
    currentState.age,
    currentState.currentLocationId,
    `talk with ${npc.name}`,
    `Spoke with ${npc.name} (${npc.role}). ${npc.dialogueStyle}`,
    'relationship',
  );

  const event = createGameEvent(
    sessionId,
    currentState.age,
    'relationship_change',
    {
      npcId: payload.npcId,
      npcName: npc.name,
      npcRole: npc.role,
      trustLevel: npc.trustLevel,
    },
  );

  const existingRelation = currentState.relationships[payload.npcId];
  const newRelationship: RelationshipState = existingRelation ?? {
    npcId: payload.npcId,
    trust: npc.trustLevel,
    friendshipLevel: npc.trustLevel >= 0.5 ? 'acquaintance' : 'stranger' as FriendshipLevel,
    lastInteractionTurn: currentState.age,
  };

  const relationships = {
    ...currentState.relationships,
    [payload.npcId]: {
      ...newRelationship,
      lastInteractionTurn: currentState.age,
    },
  };

  return {
    newState: {
      discoveredNpcs,
    },
    journalEntries: [journalEntry],
    events: [event],
    relationships,
  };
}

export function applyNextYearAction(
  sessionId: string,
  currentState: PlayerState,
  payload: Record<string, unknown>,
  worldBlueprint: WorldBlueprint,
): StateUpdate {
  const newAge = currentState.age + 1;

  const advancementChecker = new RealmAdvancementChecker();
  const advancementResult = advancementChecker.checkRealmAdvancement(
    currentState.realm,
    currentState.attributes,
  );

  const journalEntries: JournalEntry[] = [];
  const events: GameEvent[] = [];
  let newState: Partial<PlayerState> = { age: newAge };

  const annualEvent = createGameEvent(
    sessionId,
    newAge,
    'annual',
    {
      previousAge: currentState.age,
      newAge,
      realm: currentState.realm,
    },
  );
  events.push(annualEvent);

  const annualJournal = createJournalEntry(
    sessionId,
    newAge,
    currentState.currentLocationId,
    `year ${newAge} begins`,
    `A new year begins. Age: ${newAge}. Realm: ${currentState.realm}.`,
    'event',
  );
  journalEntries.push(annualJournal);

  if (advancementResult.allowed) {
    const currentIdx = realmOrder(currentState.realm);
    const nextRealm = REALM_NAMES_ORDERED[currentIdx + 1];

    newState = {
      ...newState,
      realm: nextRealm,
    };

    const breakthroughJournal = createJournalEntry(
      sessionId,
      newAge,
      currentState.currentLocationId,
      `realm breakthrough: ${nextRealm}`,
      `Breakthrough! Advanced from ${currentState.realm} to ${nextRealm}. ${advancementResult.reason}`,
      'realm',
      true,
    );
    journalEntries.push(breakthroughJournal);

    const breakthroughEvent = createGameEvent(
      sessionId,
      newAge,
      'realm_breakthrough',
      {
        previousRealm: currentState.realm,
        newRealm: nextRealm,
        reason: advancementResult.reason,
      },
    );
    events.push(breakthroughEvent);
  }

  if (newAge >= currentState.lifespan) {
    const deathJournal = createJournalEntry(
      sessionId,
      newAge,
      currentState.currentLocationId,
      `natural death at age ${newAge}`,
      `Lifespan reached. Age ${newAge} exceeds lifespan ${currentState.lifespan}.`,
      'event',
    );
    journalEntries.push(deathJournal);

    const deathEvent = createGameEvent(
      sessionId,
      newAge,
      'death',
      {
        cause: 'natural',
        age: newAge,
        lifespan: currentState.lifespan,
        realm: newState.realm ?? currentState.realm,
      },
    );
    events.push(deathEvent);
  }

  return {
    newState,
    journalEntries,
    events,
    relationships: currentState.relationships,
  };
}

export function applyDiscoverAction(
  sessionId: string,
  currentState: PlayerState,
  payload: { clueId?: string; rumorId?: string },
  worldBlueprint: WorldBlueprint,
): StateUpdate {
  const journalEntries: JournalEntry[] = [];
  const events: GameEvent[] = [];
  const newState: Partial<PlayerState> = {};

  if (payload.clueId) {
    if (currentState.discoveredClues.includes(payload.clueId)) {
      throw new Error(`Clue "${payload.clueId}" already discovered.`);
    }

    newState.discoveredClues = [...currentState.discoveredClues, payload.clueId];

    const isEndingEvidence = worldBlueprint.endingCandidates.some(
      (c) => c.requiredEvidence.includes(payload.clueId!),
    );

    const journalEntry = createJournalEntry(
      sessionId,
      currentState.age,
      currentState.currentLocationId,
      `discover clue: ${payload.clueId}`,
      `Discovered a new clue: ${payload.clueId}${isEndingEvidence ? ' — this may be evidence for an ending.' : ''}`,
      'discovery',
      isEndingEvidence,
    );
    journalEntries.push(journalEntry);

    const discoveryEvent = createGameEvent(
      sessionId,
      currentState.age,
      'discovery',
      {
        type: 'clue',
        clueId: payload.clueId,
        isEndingEvidence,
      },
    );
    events.push(discoveryEvent);
  }

  if (payload.rumorId) {
    if (currentState.discoveredRumors.includes(payload.rumorId)) {
      throw new Error(`Rumor "${payload.rumorId}" already discovered.`);
    }

    newState.discoveredRumors = [...currentState.discoveredRumors, payload.rumorId];

    const rumor = worldBlueprint.rumors.find((r) => r.id === payload.rumorId);
    const rumorText = rumor ? rumor.content : payload.rumorId;

    const journalEntry = createJournalEntry(
      sessionId,
      currentState.age,
      currentState.currentLocationId,
      `hear rumor: ${payload.rumorId}`,
      `Heard a rumor: "${rumorText}". Credibility: ${rumor?.credibility ?? 'unknown'}`,
      'discovery',
    );
    journalEntries.push(journalEntry);

    const discoveryEvent = createGameEvent(
      sessionId,
      currentState.age,
      'discovery',
      {
        type: 'rumor',
        rumorId: payload.rumorId,
        credibility: rumor?.credibility,
      },
    );
    events.push(discoveryEvent);
  }

  return {
    newState,
    journalEntries,
    events,
    relationships: currentState.relationships,
  };
}

export function applyInvestigateAction(
  sessionId: string,
  currentState: PlayerState,
  payload: { target: string; depth?: string },
  worldBlueprint: WorldBlueprint,
): StateUpdate {
  const journalEntry = createJournalEntry(
    sessionId,
    currentState.age,
    currentState.currentLocationId,
    `investigate: ${payload.target}`,
    `Investigated ${payload.target} at ${currentState.currentLocationId}. Depth: ${payload.depth ?? 'standard'}`,
    'discovery',
    true,
  );

  const event = createGameEvent(
    sessionId,
    currentState.age,
    'discovery',
    {
      type: 'investigation',
      target: payload.target,
      depth: payload.depth ?? 'standard',
      locationId: currentState.currentLocationId,
    },
  );

  return {
    newState: {},
    journalEntries: [journalEntry],
    events: [event],
    relationships: currentState.relationships,
  };
}

export function applyEventChoiceAction(
  sessionId: string,
  currentState: PlayerState,
  eventChoice: {
    eventId: string;
    optionIndex: number;
    attributeEffects: Record<string, number>;
  },
  worldBlueprint: WorldBlueprint,
): StateUpdate {
  const event = worldBlueprint.events.find((e) => e.id === eventChoice.eventId);

  if (!event) {
    throw new Error(`Event "${eventChoice.eventId}" not found in world blueprint.`);
  }

  const option = event.options[eventChoice.optionIndex];
  if (!option) {
    throw new Error(`Option index ${eventChoice.optionIndex} out of range for event "${eventChoice.eventId}".`);
  }

  const effects = eventChoice.attributeEffects;
  const updatedAttributes: Attribute = { ...currentState.attributes };

  for (const [attrName, delta] of Object.entries(effects)) {
    const key = attrName as keyof Attribute;
    if (key in updatedAttributes) {
      updatedAttributes[key] = Math.max(0, Math.min(100, updatedAttributes[key] + delta));
    }
  }

  const journalEntry = createJournalEntry(
    sessionId,
    currentState.age,
    currentState.currentLocationId,
    `choose: ${option.label}`,
    `Event: ${event.description}. Chose "${option.label}" — ${option.description}. Effects: ${Object.entries(effects).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ')}`,
    'event',
  );

  const gameEvent = createGameEvent(
    sessionId,
    currentState.age,
    'event',
    {
      eventId: eventChoice.eventId,
      optionIndex: eventChoice.optionIndex,
      optionLabel: option.label,
      attributeEffects: effects,
    },
  );

  return {
    newState: {
      attributes: updatedAttributes,
    },
    journalEntries: [journalEntry],
    events: [gameEvent],
    relationships: currentState.relationships,
  };
}

export function applyRealmAdvancement(
  sessionId: string,
  currentState: PlayerState,
  newRealm: RealmName,
): StateUpdate {
  const currentIdx = realmOrder(currentState.realm);
  const newIdx = realmOrder(newRealm);

  if (newIdx !== currentIdx + 1) {
    throw new Error(`Invalid realm advancement: cannot jump from "${currentState.realm}" (order ${currentIdx}) to "${newRealm}" (order ${newIdx}). Must advance one realm at a time.`);
  }

  const journalEntry = createJournalEntry(
    sessionId,
    currentState.age,
    currentState.currentLocationId,
    `realm breakthrough: ${newRealm}`,
    `Achieved a breakthrough! Advanced from ${currentState.realm} to ${newRealm}. The path to mathematical truth deepens.`,
    'realm',
    true,
  );

  const event = createGameEvent(
    sessionId,
    currentState.age,
    'realm_breakthrough',
    {
      previousRealm: currentState.realm,
      newRealm,
    },
  );

  return {
    newState: {
      realm: newRealm,
    },
    journalEntries: [journalEntry],
    events: [event],
    relationships: currentState.relationships,
  };
}