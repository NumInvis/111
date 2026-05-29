import { describe, it, expect } from 'vitest';
import { applyMoveAction, applyNextYearAction, applyTalkAction, applyDiscoverAction, applyAttemptBreakthroughAction } from '../reducers/reducers';
import type { PlayerState, StateUpdate } from '../reducers/reducers';
import type { WorldBlueprint } from '@vi/shared';

const BASE_PLAYER: PlayerState = {
  name: '行者',
  age: 16,
  lifespan: 80,
  realm: '炼体',
  currentLocationId: 'loc_start',
  attributes: { calculation: 10, geometry: 5, abstraction: 5, proof: 3, intuition: 5, focus: 10, physique: 20, family: 10 },
  discoveredLocations: ['loc_start'],
  discoveredNpcs: [],
  discoveredClues: [],
  discoveredRumors: [],
  relationships: {},
  historySummary: '初入灵墟。',
};

const BASE_WORLD: WorldBlueprint = {
  worldProfile: {
    name: '灵墟',
    coreConflict: '数理真理与混沌之争',
    worldRules: ['修仙即求真'],
    taboos: ['不可伪造证明'],
    narrativeTone: 'philosophical',
    powerSystem: {
      cultivationPaths: [{ id: 'path_math', name: '数理大道', description: '求真之路', tierIds: ['lianTi', 'lianQi'] }],
      cultivationTiers: [
        { id: 'lianTi', name: '炼体', requiredAttributes: { calculation: 5, geometry: 3, abstraction: 2, proof: 1, intuition: 2, focus: 5, physique: 10, family: 5 } },
        { id: 'lianQi', name: '练气', requiredAttributes: { calculation: 15, geometry: 10, abstraction: 10, proof: 5, intuition: 8, focus: 15, physique: 15, family: 8 } },
      ],
      legendaryFigures: [],
    },
  },
  factions: [
    { id: 'faction_math', name: '数理宗', goal: '追求数理真理', conflict: '对抗混沌' },
    { id: 'faction_chaos', name: '混沌宗', goal: '打破秩序', conflict: '反对数理宗' },
  ],
  locations: [
    { id: 'loc_start', name: '灵墟入口', description: '起点', connections: ['loc_temple'], riskLevel: 'low', exploreActions: ['观察'] },
    { id: 'loc_temple', name: '数理寺', description: '修行地', connections: ['loc_start'], riskLevel: 'medium', exploreActions: ['参悟'] },
  ],
  npcs: [
    { id: 'npc_master', name: '方丈', role: 'mentor', personality: ['严厉', '智慧'], goal: '培养弟子', secret: '暗藏手稿', forbiddenTopics: ['手稿'], dialogueStyle: '教诲式', trustLevel: 0.5 },
    { id: 'npc_rival', name: '邪修', role: 'rival', personality: ['狡诈'], goal: '击败数理宗', secret: '卧底', forbiddenTopics: ['卧底'], dialogueStyle: '挑衅式', trustLevel: 0.2 },
  ],
  clues: [
    { id: 'clue_1', name: '变分残卷', description: '方丈的手稿', locationId: 'loc_temple', npcId: 'npc_master', category: 'evidence', relatedEndingIds: ['ending_truth'] },
  ],
  rumors: [
    { id: 'rumor_1', content: '方丈暗藏古卷', credibility: 0.7, relatedLocation: 'loc_temple' },
  ],
  events: [
    { id: 'evt_1', triggerCondition: { minRealm: '炼体', locationId: 'loc_start' }, locationId: 'loc_start', description: '初入灵墟', oneTime: true, options: [
      { label: '参拜', description: '前往数理寺', riskLevel: 'low', consequenceHint: '获得指导', attributeEffects: { intuition: 5 }, requiresRealm: null },
      { label: '探索', description: '探索集市', riskLevel: 'low', consequenceHint: '发现线索', attributeEffects: { family: 3 }, requiresRealm: null },
    ], relatedNpcIds: ['npc_master'] },
  ],
  endingCandidates: [
    { id: 'ending_truth', title: '变分真理', description: '悟出真理', requiredEvidence: ['clue_1'], requiredRealm: '通明', tone: 'philosophical' },
  ],
};

describe('applyMoveAction', () => {
  it('should move player to a connected location and record journal entry', () => {
    const result = applyMoveAction('test-session', BASE_PLAYER, { targetLocationId: 'loc_temple' }, BASE_WORLD);
    expect(result.newState.currentLocationId).toBe('loc_temple');
    expect(result.newState.discoveredLocations).toContain('loc_temple');
    expect(result.journalEntries.length).toBeGreaterThan(0);
    expect(result.journalEntries[0].action).toBeDefined();
    expect(result.journalEntries[0].category).toBeDefined();
  });

  it('should add location to discoveredLocations on first visit', () => {
    const result = applyMoveAction('test-session', BASE_PLAYER, { targetLocationId: 'loc_temple' }, BASE_WORLD);
    expect(result.newState.discoveredLocations).toContain('loc_temple');
  });

  it('should not duplicate discoveredLocations on revisit', () => {
    const playerAtTemple = { ...BASE_PLAYER, currentLocationId: 'loc_temple', discoveredLocations: ['loc_start', 'loc_temple'] };
    const result = applyMoveAction('test-session', playerAtTemple, { targetLocationId: 'loc_start' }, BASE_WORLD);
    const locCount = result.newState.discoveredLocations.filter((id) => id === 'loc_start').length;
    expect(locCount).toBe(1);
  });
});

describe('applyNextYearAction', () => {
  it('should increment age by 1 and produce journal entries', () => {
    const result = applyNextYearAction('test-session', BASE_PLAYER, {}, BASE_WORLD);
    expect(result.newState.age).toBe(17);
    expect(result.journalEntries.length).toBeGreaterThan(0);
    expect(result.events.length).toBeGreaterThan(0);
  });

  it('should apply annual attribute growth', () => {
    const result = applyNextYearAction('test-session', BASE_PLAYER, {}, BASE_WORLD);
    expect(result.newState.attributes.calculation).toBeGreaterThanOrEqual(BASE_PLAYER.attributes.calculation);
  });

  it('should produce events with eventType', () => {
    const result = applyNextYearAction('test-session', BASE_PLAYER, {}, BASE_WORLD);
    expect(result.events[0].eventType).toBeDefined();
  });
});

describe('applyTalkAction', () => {
  it('should record journal entry for talking to NPC', () => {
    const result = applyTalkAction('test-session', BASE_PLAYER, { npcId: 'npc_master' }, BASE_WORLD);
    expect(result.journalEntries.length).toBeGreaterThan(0);
    expect(result.journalEntries[0].action).toBeDefined();
    expect(result.newState.discoveredNpcs).toContain('npc_master');
  });

  it('should include NPC relationship in update', () => {
    const result = applyTalkAction('test-session', BASE_PLAYER, { npcId: 'npc_master' }, BASE_WORLD);
    expect(result.relationships).toBeDefined();
    expect(result.relationships['npc_master']).toBeDefined();
    expect(result.relationships['npc_master'].trust).toBeDefined();
  });
});

describe('applyDiscoverAction', () => {
  it('should add clue to discoveredClues', () => {
    const result = applyDiscoverAction('test-session', BASE_PLAYER, { clueId: 'clue_1' }, BASE_WORLD);
    expect(result.newState.discoveredClues).toContain('clue_1');
    expect(result.journalEntries[0].category).toBe('discovery');
  });

  it('should add rumor to discoveredRumors', () => {
    const result = applyDiscoverAction('test-session', BASE_PLAYER, { rumorId: 'rumor_1' }, BASE_WORLD);
    expect(result.newState.discoveredRumors).toContain('rumor_1');
  });
});

describe('applyAttemptBreakthroughAction', () => {
  it('should fail breakthrough when attributes below threshold', () => {
    const lowPlayer = { ...BASE_PLAYER, attributes: { ...BASE_PLAYER.attributes, calculation: 5, geometry: 1, abstraction: 1, proof: 1, intuition: 1, focus: 5, physique: 8, family: 3 } };
    const result = applyAttemptBreakthroughAction('test-session', lowPlayer, {}, BASE_WORLD);
    const breakthroughEvent = result.events.find((e) => e.eventType === 'breakthrough_failure');
    expect(breakthroughEvent).toBeDefined();
  });
});