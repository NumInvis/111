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
  Clue,
  RealmName,
  AttributeDef,
} from '@variational-infinity/shared';
import { realmOrder } from '../state-machine/game-state-machine';
import { RealmAdvancementChecker, StateBoundsChecker, REALM_NAMES_ORDERED, evaluateTriggerCondition } from '../rules/rules';
import type { TriggerCondition } from '@variational-infinity/shared';

export interface StateUpdate {
  newState: Partial<PlayerState>;
  journalEntries: JournalEntry[];
  events: GameEvent[];
  relationships: Record<string, RelationshipState>;
  hints?: string[];
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

function getGrowthMap(attributeDefs: AttributeDef[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const def of attributeDefs) {
    map[def.name] = def.growthPerYear;
  }
  return map;
}

function validateBounds(currentState: PlayerState, proposedUpdate: Partial<PlayerState>): void {
  const result = new StateBoundsChecker().checkStateBounds(currentState, proposedUpdate);
  if (!result.allowed) {
    throw new Error(`State bounds violation: ${result.reason ?? 'unknown'}`);
  }
}

function createAdvancementChecker(worldBlueprint: WorldBlueprint): RealmAdvancementChecker {
  return new RealmAdvancementChecker(worldBlueprint.advancementRules);
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
    `抵达${targetLocation.name}`,
    `抵达${targetLocation.name}。${targetLocation.description}`,
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

  validateBounds(currentState, { currentLocationId: payload.targetLocationId, discoveredLocations });

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

  const npcClues = worldBlueprint.clues.filter(
    (c) => c.npcId === payload.npcId && !currentState.discoveredClues.includes(c.id),
  );

  const discoveredClues = npcClues.length > 0
    ? [...currentState.discoveredClues, ...npcClues.map((c) => c.id)]
    : currentState.discoveredClues;

  const journalEntries: JournalEntry[] = [
    createJournalEntry(
      sessionId,
      currentState.age,
      currentState.currentLocationId,
      `与${npc.name}交谈`,
      `与${npc.name}（${npc.role}）交谈。${npc.dialogueStyle}`,
      'relationship',
    ),
  ];

  const events: GameEvent[] = [
    createGameEvent(
      sessionId,
      currentState.age,
      'relationship_change',
      {
        npcId: payload.npcId,
        npcName: npc.name,
        npcRole: npc.role,
        trustLevel: npc.trustLevel,
      },
    ),
  ];

  if (npc.trustLevel >= 0.7 && npcClues.length > 0) {
    for (const clue of npcClues) {
      journalEntries.push(
        createJournalEntry(
          sessionId,
          currentState.age,
          currentState.currentLocationId,
          `从${npc.name}得知线索：${clue.name}`,
          `${npc.name}透露：「${clue.description}」`,
          'discovery',
          true,
        ),
      );
      events.push(
        createGameEvent(
          sessionId,
          currentState.age,
          'discovery',
          { type: 'clue', clueId: clue.id, sourceNpc: payload.npcId },
        ),
      );
    }
  }

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

  validateBounds(currentState, { discoveredNpcs, discoveredClues });

  return {
    newState: {
      discoveredNpcs,
      discoveredClues,
    },
    journalEntries,
    events,
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
  const growthMap = getGrowthMap(worldBlueprint.attributeDefs);

  const updatedAttributes: Attribute = { ...currentState.attributes };
  for (const [attrName, growth] of Object.entries(growthMap)) {
    if (attrName in updatedAttributes && growth > 0) {
      updatedAttributes[attrName] = Math.min(100, updatedAttributes[attrName] + growth);
    }
  }

  const advancementChecker = createAdvancementChecker(worldBlueprint);
  const advancementResult = advancementChecker.checkRealmAdvancement(
    currentState.realm,
    updatedAttributes,
  );

  const journalEntries: JournalEntry[] = [];
  const events: GameEvent[] = [];
  const hints: string[] = [];
  let newState: Partial<PlayerState> = {
    age: newAge,
    attributes: updatedAttributes,
  };

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
    `第${newAge}年开始`,
    `新一年开始。年龄：${newAge}。境界：${currentState.realm}。属性自然增长。`,
    'event',
  );
  journalEntries.push(annualJournal);

  if (advancementResult.allowed) {
    const nextRealm = REALM_NAMES_ORDERED[realmOrder(currentState.realm) + 1];
    hints.push(`你的修为已达突破 ${nextRealm} 的门槛。可尝试破境。`);
  }

  const triggerableEvents = worldBlueprint.events.filter((e) =>
    evaluateTriggerCondition(e.triggerCondition as TriggerCondition, { ...currentState, age: newAge, attributes: updatedAttributes }),
  );

  if (triggerableEvents.length > 0) {
    const selectedEvent = triggerableEvents[0];
    events.push(
      createGameEvent(sessionId, newAge, 'event', {
        eventId: selectedEvent.id,
        description: selectedEvent.description,
        optionsCount: selectedEvent.options.length,
      }),
    );
  }

  if (newAge >= currentState.lifespan) {
    const deathJournal = createJournalEntry(
      sessionId,
      newAge,
      currentState.currentLocationId,
      `寿元耗尽，享年${newAge}`,
      `寿元已尽。年龄${newAge}超过寿元${currentState.lifespan}。`,
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

  validateBounds(currentState, newState);

  return {
    newState,
    journalEntries,
    events,
    relationships: currentState.relationships,
    hints,
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

    const clue = worldBlueprint.clues.find((c) => c.id === payload.clueId);
    if (!clue) {
      throw new Error(`Clue "${payload.clueId}" not found in world blueprint.`);
    }

    newState.discoveredClues = [...currentState.discoveredClues, payload.clueId];

    const isEndingEvidence = worldBlueprint.endingCandidates.some(
      (c) => c.requiredEvidence.includes(payload.clueId!),
    );

    journalEntries.push(
      createJournalEntry(
        sessionId,
        currentState.age,
        currentState.currentLocationId,
        `发现线索：${clue.name}`,
        `发现「${clue.name}」：${clue.description}${isEndingEvidence ? ' ——此线索可能是结局证据。' : ''}`,
        'discovery',
        isEndingEvidence || clue.category === 'evidence',
      ),
    );

    events.push(
      createGameEvent(
        sessionId,
        currentState.age,
        'discovery',
        { type: 'clue', clueId: payload.clueId, clueName: clue.name, isEndingEvidence },
      ),
    );
  }

  if (payload.rumorId) {
    if (currentState.discoveredRumors.includes(payload.rumorId)) {
      throw new Error(`Rumor "${payload.rumorId}" already discovered.`);
    }

    newState.discoveredRumors = [...currentState.discoveredRumors, payload.rumorId];

    const rumor = worldBlueprint.rumors.find((r) => r.id === payload.rumorId);
    const rumorText = rumor ? rumor.content : payload.rumorId;

    journalEntries.push(
      createJournalEntry(
        sessionId,
        currentState.age,
        currentState.currentLocationId,
        `听闻传闻：${payload.rumorId}`,
        `听闻传闻：「${rumorText}」。可信度：${rumor?.credibility ?? '未知'}`,
        'discovery',
      ),
    );

    events.push(
      createGameEvent(
        sessionId,
        currentState.age,
        'discovery',
        { type: 'rumor', rumorId: payload.rumorId, credibility: rumor?.credibility },
      ),
    );
  }

  validateBounds(currentState, newState);

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
  const locationClues = worldBlueprint.clues.filter(
    (c) => c.locationId === currentState.currentLocationId && !currentState.discoveredClues.includes(c.id),
  );

  const discoveredClues = locationClues.length > 0
    ? [...currentState.discoveredClues, ...locationClues.map((c) => c.id)]
    : currentState.discoveredClues;

  const journalEntries: JournalEntry[] = [];
  const events: GameEvent[] = [];

  journalEntries.push(
    createJournalEntry(
      sessionId,
      currentState.age,
      currentState.currentLocationId,
      `调查：${payload.target}`,
      `调查${payload.target}。${locationClues.length > 0 ? `发现${locationClues.length}条线索。` : '未发现新线索。'}`,
      'discovery',
      locationClues.length > 0,
    ),
  );

  events.push(
    createGameEvent(
      sessionId,
      currentState.age,
      'discovery',
      {
        type: 'investigation',
        target: payload.target,
        depth: payload.depth ?? 'standard',
        locationId: currentState.currentLocationId,
        cluesFound: locationClues.map((c) => c.id),
      },
    ),
  );

  if (locationClues.length > 0) {
    for (const clue of locationClues) {
      journalEntries.push(
        createJournalEntry(
          sessionId,
          currentState.age,
          currentState.currentLocationId,
          `发现线索：${clue.name}`,
          `调查揭示：「${clue.description}」`,
          'discovery',
          clue.category === 'evidence' || worldBlueprint.endingCandidates.some((ec) => ec.requiredEvidence.includes(clue.id)),
        ),
      );
    }
  }

  validateBounds(currentState, { discoveredClues });

  return {
    newState: { discoveredClues },
    journalEntries,
    events,
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

  const effects = option.attributeEffects ?? {};
  const updatedAttributes: Attribute = { ...currentState.attributes };

  for (const [attrName, delta] of Object.entries(effects)) {
    if (attrName in updatedAttributes) {
      updatedAttributes[attrName] = Math.max(0, Math.min(100, updatedAttributes[attrName] + delta));
    }
  }

  const eventClues = worldBlueprint.clues.filter(
    (c) => c.locationId === event.locationId && !currentState.discoveredClues.includes(c.id),
  );

  const discoveredClues = eventClues.length > 0
    ? [...currentState.discoveredClues, ...eventClues.map((c) => c.id)]
    : currentState.discoveredClues;

  const journalEntries: JournalEntry[] = [
    createJournalEntry(
      sessionId,
      currentState.age,
      currentState.currentLocationId,
      `选择：${option.label}`,
      `事件：${event.description}。选择「${option.label}」—— ${option.description}。效果：${Object.entries(effects).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ')}`,
      'event',
    ),
  ];

  if (eventClues.length > 0) {
    for (const clue of eventClues) {
      journalEntries.push(
        createJournalEntry(
          sessionId,
          currentState.age,
          currentState.currentLocationId,
          `事件线索：${clue.name}`,
          `事件揭示：「${clue.description}」`,
          'discovery',
          true,
        ),
      );
    }
  }

  const gameEvent = createGameEvent(
    sessionId,
    currentState.age,
    'event',
    {
      eventId: eventChoice.eventId,
      optionIndex: eventChoice.optionIndex,
      optionLabel: option.label,
      attributeEffects: effects,
      cluesDiscovered: eventClues.map((c) => c.id),
    },
  );

  validateBounds(currentState, { attributes: updatedAttributes, discoveredClues });

  return {
    newState: {
      attributes: updatedAttributes,
      discoveredClues,
    },
    journalEntries,
    events: [gameEvent],
    relationships: currentState.relationships,
  };
}

const NPC_INITIAL_TRUST = 0.3;

export function applyEndDialogueAction(
  sessionId: string,
  currentState: PlayerState,
  payload: { npcId?: string; trustChange?: number },
  worldBlueprint: WorldBlueprint,
): StateUpdate {
  const npcId = payload.npcId;
  const trustChange = payload.trustChange ?? 0;
  const relationships = { ...currentState.relationships };

  if (npcId) {
    const npc = worldBlueprint.npcs.find((n) => n.id === npcId);
    const existing = relationships[npcId];
    const baseTrust = existing ? existing.trust : (npc?.trustLevel ?? NPC_INITIAL_TRUST);
    const newTrust = Math.max(0, Math.min(1, baseTrust + trustChange));

    relationships[npcId] = {
      npcId,
      trust: newTrust,
      friendshipLevel: newTrust >= 0.7 ? 'confidant' : newTrust >= 0.5 ? 'friend' : newTrust >= 0.3 ? 'acquaintance' : 'stranger' as FriendshipLevel,
      lastInteractionTurn: currentState.age,
    };
  }

  validateBounds(currentState, { relationships });

  return {
    newState: { relationships },
    journalEntries: [
      createJournalEntry(
        sessionId,
        currentState.age,
        currentState.currentLocationId,
        '结束对话',
        `结束对话${npcId ? `（信任变化：${trustChange >= 0 ? '+' : ''}${trustChange.toFixed(2)}）` : ''}。`,
        'relationship',
      ),
    ],
    events: [
      createGameEvent(sessionId, currentState.age, 'relationship_change', { type: 'end_dialogue', npcId, trustChange }),
    ],
    relationships,
  };
}

export function applyResolveEventAction(
  sessionId: string,
  currentState: PlayerState,
  payload: Record<string, unknown>,
  worldBlueprint: WorldBlueprint,
): StateUpdate {
  validateBounds(currentState, {});

  return {
    newState: {},
    journalEntries: [
      createJournalEntry(
        sessionId,
        currentState.age,
        currentState.currentLocationId,
        '事件结束',
        '事件已结束，恢复探索。',
        'event',
      ),
    ],
    events: [
      createGameEvent(sessionId, currentState.age, 'event', { type: 'resolve_event' }),
    ],
    relationships: currentState.relationships,
  };
}

export function applyAttemptBreakthroughAction(
  sessionId: string,
  currentState: PlayerState,
  payload: Record<string, unknown>,
  worldBlueprint: WorldBlueprint,
): StateUpdate {
  const advancementChecker = createAdvancementChecker(worldBlueprint);
  const result = advancementChecker.checkRealmAdvancement(
    currentState.realm,
    currentState.attributes,
  );

  const currentIdx = realmOrder(currentState.realm);
  const nextRealm = REALM_NAMES_ORDERED[currentIdx + 1];

  if (!nextRealm) {
    throw new Error(`Cannot advance beyond the highest realm "${currentState.realm}".`);
  }

  if (result.allowed) {
    const rule = advancementChecker.getAdvancementRule(currentState.realm);
    if (!rule) {
      throw new Error(`No advancement rule found from "${currentState.realm}" to "${nextRealm}".`);
    }

    const primaryAttribute = rule.primaryAttribute;
    const consumptionAmount = rule.breakthroughCost;

    const updatedAttributes: Attribute = { ...currentState.attributes };
    if (primaryAttribute in updatedAttributes) {
      updatedAttributes[primaryAttribute] = Math.max(0, updatedAttributes[primaryAttribute] - consumptionAmount);
    }

    const lifespanExtension = rule.lifespanExtension;
    const newLifespan = currentState.lifespan + lifespanExtension;

    validateBounds(currentState, { realm: nextRealm, attributes: updatedAttributes, lifespan: newLifespan });

    return {
      newState: {
        realm: nextRealm,
        attributes: updatedAttributes,
        lifespan: newLifespan,
      },
      journalEntries: [
        createJournalEntry(
          sessionId,
          currentState.age,
          currentState.currentLocationId,
          `突破至${nextRealm}`,
          `突破成功！从${currentState.realm}进阶至${nextRealm}。消耗${consumptionAmount}点${primaryAttribute}。寿元增加${lifespanExtension}年（现寿元${newLifespan}）。`,
          'realm',
          true,
        ),
      ],
      events: [
        createGameEvent(
          sessionId,
          currentState.age,
          'realm_breakthrough',
          { previousRealm: currentState.realm, newRealm: nextRealm, consumedAttribute: primaryAttribute, lifespanExtension },
        ),
      ],
      relationships: currentState.relationships,
    };
  }

  const rule = advancementChecker.getAdvancementRule(currentState.realm);
  const lifespanPenalty = rule?.failureLifespanLoss ?? 2;
  const newLifespan = Math.max(1, currentState.lifespan - lifespanPenalty);

  validateBounds(currentState, { lifespan: newLifespan });

  return {
    newState: {
      lifespan: newLifespan,
    },
    journalEntries: [
      createJournalEntry(
        sessionId,
        currentState.age,
        currentState.currentLocationId,
        `突破失败：${nextRealm}`,
        `尝试从${currentState.realm}突破至${nextRealm}失败。寿元减少${lifespanPenalty}年（现寿元${newLifespan}）。`,
        'realm',
      ),
    ],
    events: [
      createGameEvent(
        sessionId,
        currentState.age,
        'breakthrough_failure',
        { targetRealm: nextRealm, reason: result.reason, lifespanPenalty },
      ),
    ],
    relationships: currentState.relationships,
    hints: [`破境失败，寿元减少${lifespanPenalty}年。需要提升属性再尝试。`],
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
    `突破至${newRealm}`,
    `突破成功！从${currentState.realm}进阶至${newRealm}。数理真道愈发深邃。`,
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

  validateBounds(currentState, { realm: newRealm });

  return {
    newState: {
      realm: newRealm,
    },
    journalEntries: [journalEntry],
    events: [event],
    relationships: currentState.relationships,
  };
}
