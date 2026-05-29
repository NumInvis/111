import { describe, it, expect } from 'vitest';
import { ActionValidator, EndingArbitrator, RealmAdvancementChecker, REALM_NAMES_ORDERED, evaluateTriggerCondition } from '../rules/rules';
import type { PlayerState } from '../reducers/reducers';
import type { WorldBlueprint, EndingCandidate, TriggerCondition } from '@vi/shared';

const BASE_PLAYER: PlayerState = {
  name: '行者',
  age: 16,
  lifespan: 80,
  realm: '炼体',
  currentLocationId: 'loc_start',
  attributes: { calculation: 10, geometry: 5, abstraction: 5, proof: 3, intuition: 5, focus: 10, physique: 20, family: 10 },
  discoveredLocations: ['loc_start'],
  discoveredNpcs: ['npc_master'],
  discoveredClues: ['clue_1'],
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
  factions: [{ id: 'faction_math', name: '数理宗', goal: '追求数理真理', conflict: '对抗混沌' }],
  locations: [
    { id: 'loc_start', name: '灵墟入口', description: '起点', connections: ['loc_temple'], riskLevel: 'low', exploreActions: ['观察'] },
    { id: 'loc_temple', name: '数理寺', description: '修行地', connections: ['loc_start'], riskLevel: 'medium', exploreActions: ['参悟'] },
  ],
  npcs: [{ id: 'npc_master', name: '方丈', role: 'mentor', personality: ['严厉'], goal: '培养弟子', secret: '暗藏手稿', forbiddenTopics: ['手稿'], dialogueStyle: '教诲式', trustLevel: 0.5 }],
  clues: [{ id: 'clue_1', name: '变分残卷', description: '方丈手稿', locationId: 'loc_temple', npcId: 'npc_master', category: 'evidence', relatedEndingIds: ['ending_truth'] }],
  rumors: [],
  events: [],
  endingCandidates: [
    { id: 'ending_truth', title: '变分真理', description: '悟出真理', requiredEvidence: ['clue_1'], requiredRealm: '通明', tone: 'philosophical' },
    { id: 'ending_basic', title: '凡人之路', description: '普通结局', requiredEvidence: [], tone: 'tragic' },
  ],
};

describe('REALM_NAMES_ORDERED', () => {
  it('should have exactly 14 realms', () => {
    expect(REALM_NAMES_ORDERED.length).toBe(14);
  });

  it('should start with 炼体 and end with 无限', () => {
    expect(REALM_NAMES_ORDERED[0]).toBe('炼体');
    expect(REALM_NAMES_ORDERED[13]).toBe('无限');
  });
});

describe('ActionValidator', () => {
  const validator = new ActionValidator();

  it('should allow move action to a connected location', () => {
    const result = validator.validateAction(BASE_WORLD, BASE_PLAYER, 'move', { targetLocationId: 'loc_temple' });
    expect(result.allowed).toBe(true);
  });

  it('should deny move action to a nonexistent location', () => {
    const result = validator.validateAction(BASE_WORLD, BASE_PLAYER, 'move', { targetLocationId: 'loc_nonexistent' });
    expect(result.allowed).toBe(false);
  });

  it('should allow talk action with existing NPC', () => {
    const result = validator.validateAction(BASE_WORLD, BASE_PLAYER, 'talk', { npcId: 'npc_master' });
    expect(result.allowed).toBe(true);
  });

  it('should deny talk action with unknown NPC', () => {
    const result = validator.validateAction(BASE_WORLD, BASE_PLAYER, 'talk', { npcId: 'npc_unknown' });
    expect(result.allowed).toBe(false);
  });

  it('should allow next_year action', () => {
    const result = validator.validateAction(BASE_WORLD, BASE_PLAYER, 'next_year', {});
    expect(result.allowed).toBe(true);
  });
});

describe('EndingArbitrator', () => {
  const arbitrator = new EndingArbitrator();

  it('should filter out ending with missing evidence via checkAllEndingCandidates', () => {
    const playerNoClue = { ...BASE_PLAYER, discoveredClues: [] };
    const eligible = arbitrator.checkAllEndingCandidates(BASE_WORLD.endingCandidates, playerNoClue, BASE_WORLD);
    expect(eligible.find((c) => c.id === 'ending_truth')).toBeUndefined();
    expect(eligible.find((c) => c.id === 'ending_basic')).toBeDefined();
  });

  it('should return false for individual candidate with missing evidence', () => {
    const playerNoClue = { ...BASE_PLAYER, discoveredClues: [] };
    const result = arbitrator.checkEndingCandidate(BASE_WORLD.endingCandidates[0], playerNoClue, BASE_WORLD);
    expect(result.allowed).toBe(false);
  });

  it('should return true for individual candidate with evidence fulfilled but realm not met', () => {
    const result = arbitrator.checkEndingCandidate(BASE_WORLD.endingCandidates[0], BASE_PLAYER, BASE_WORLD);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('realm');
  });

  it('should return true for ending with no requirements', () => {
    const result = arbitrator.checkEndingCandidate(BASE_WORLD.endingCandidates[1], BASE_PLAYER, BASE_WORLD);
    expect(result.allowed).toBe(true);
  });
});

describe('RealmAdvancementChecker', () => {
  const checker = new RealmAdvancementChecker();

  it('should allow advancement from 炼体 to 练气 when attributes meet threshold', () => {
    const result = checker.checkRealmAdvancement('炼体', BASE_PLAYER.attributes);
    expect(result.allowed).toBe(true);
  });

  it('should deny advancement from 炼体 to 练气 when attributes below threshold', () => {
    const lowPlayer = { ...BASE_PLAYER, attributes: { calculation: 5, geometry: 1, abstraction: 1, proof: 1, intuition: 1, focus: 5, physique: 5, family: 3 } };
    const result = checker.checkRealmAdvancement('炼体', lowPlayer.attributes);
    expect(result.allowed).toBe(false);
  });
});

describe('evaluateTriggerCondition', () => {
  it('should match condition when player meets all requirements', () => {
    const condition: TriggerCondition = { minRealm: '炼体', locationId: 'loc_start' };
    expect(evaluateTriggerCondition(condition, BASE_PLAYER)).toBe(true);
  });

  it('should not match condition when realm is too low', () => {
    const condition: TriggerCondition = { minRealm: '筑基', locationId: 'loc_start' };
    expect(evaluateTriggerCondition(condition, BASE_PLAYER)).toBe(false);
  });

  it('should not match condition when location is different', () => {
    const condition: TriggerCondition = { minRealm: '炼体', locationId: 'loc_temple' };
    expect(evaluateTriggerCondition(condition, BASE_PLAYER)).toBe(false);
  });

  it('should match condition with discovered NPC requirement', () => {
    const condition: TriggerCondition = { discoveredNpcId: 'npc_master' };
    expect(evaluateTriggerCondition(condition, BASE_PLAYER)).toBe(true);
  });

  it('should not match condition with undiscovered NPC requirement', () => {
    const condition: TriggerCondition = { discoveredNpcId: 'npc_unknown' };
    expect(evaluateTriggerCondition(condition, BASE_PLAYER)).toBe(false);
  });
});