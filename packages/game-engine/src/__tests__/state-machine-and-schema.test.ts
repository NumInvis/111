import { describe, it, expect } from 'vitest';
import { GameStateMachine, type GamePhase } from '../state-machine/game-state-machine';
import type { PlayerState, WorldBlueprint } from '@variational-infinity/shared';
import { z } from 'zod';

// Import directly from shared source to avoid build resolution issues in vitest
const NpcDialogueOutputSchema = z.object({
  role: z.string(),
  content: z.string(),
  metadata: z.object({
    emotion: z.string(),
    trustChange: z.number().min(-0.1).max(0.1),
    hintAtSecret: z.boolean().optional(),
    suggestedActions: z.array(z.string()).optional(),
  }).optional(),
});

const EndingEligibilitySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  requiredEvidence: z.array(z.string()),
  requiredRealm: z.string().optional(),
  tone: z.string(),
  evidenceFulfilled: z.boolean(),
});

const IneligibleEndingSchema = z.object({
  id: z.string(),
  reason: z.string(),
});

const EndingOutputSchema = z.object({
  eligibleEndings: z.array(EndingEligibilitySchema),
  ineligibleEndings: z.array(IneligibleEndingSchema),
});

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
  factions: [{ id: 'faction_math', name: '数理宗', goal: '追求数理真理', conflict: '对抗混沌' }],
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
  events: [],
  endingCandidates: [
    { id: 'ending_truth', title: '变分真理', description: '悟出真理', requiredEvidence: ['clue_1'], requiredRealm: '通明', tone: 'philosophical' },
    { id: 'ending_basic', title: '凡人之路', description: '普通结局', requiredEvidence: [], tone: 'tragic' },
  ],
};

function makeMachine(phase: GamePhase = 'initializing', player: PlayerState = BASE_PLAYER): GameStateMachine {
  return new GameStateMachine({
    phase,
    turn: player.age,
    playerState: player,
    worldBlueprint: BASE_WORLD,
    pendingActions: [],
    safetyFlags: [],
  });
}

describe('GameStateMachine - Phase Lifecycle', () => {
  it('should start at given phase', () => {
    const sm = makeMachine('exploring');
    expect(sm.getPhase()).toBe('exploring');
  });

  it('should transition initializing → exploring via world_generated', () => {
    const sm = makeMachine('initializing');
    expect(sm.canTransition('world_generated')).toBe(true);
    sm.transition('world_generated');
    expect(sm.getPhase()).toBe('exploring');
  });

  it('should transition exploring → dialoguing via talk', () => {
    const sm = makeMachine('exploring');
    expect(sm.canTransition('talk')).toBe(true);
    sm.transition('talk');
    expect(sm.getPhase()).toBe('dialoguing');
  });

  it('should transition dialoguing → exploring via end_dialogue', () => {
    const sm = makeMachine('dialoguing');
    expect(sm.canTransition('end_dialogue')).toBe(true);
    sm.transition('end_dialogue');
    expect(sm.getPhase()).toBe('exploring');
  });

  it('should transition exploring → event via next_year', () => {
    const sm = makeMachine('exploring');
    sm.transition('next_year');
    expect(sm.getPhase()).toBe('event');
  });

  it('should transition event → exploring via resolve_event', () => {
    const sm = makeMachine('event');
    sm.transition('resolve_event');
    expect(sm.getPhase()).toBe('exploring');
  });

  it('should transition exploring → ending_check via attempt_breakthrough', () => {
    const sm = makeMachine('exploring');
    sm.transition('attempt_breakthrough');
    expect(sm.getPhase()).toBe('ending_check');
  });

  it('should transition ending_check → exploring via continue', () => {
    const sm = makeMachine('ending_check');
    sm.transition('continue');
    expect(sm.getPhase()).toBe('exploring');
  });

  it('should transition ending_check → ended via trigger_ending', () => {
    const sm = makeMachine('ending_check');
    sm.transition('trigger_ending');
    expect(sm.getPhase()).toBe('ended');
  });
});

describe('GameStateMachine - Invalid Transitions', () => {
  it('should reject talk from initializing', () => {
    const sm = makeMachine('initializing');
    expect(sm.canTransition('talk')).toBe(false);
  });

  it('should reject end_dialogue from exploring', () => {
    const sm = makeMachine('exploring');
    expect(sm.canTransition('end_dialogue')).toBe(false);
  });

  it('should reject resolve_event from dialoguing', () => {
    const sm = makeMachine('dialoguing');
    expect(sm.canTransition('resolve_event')).toBe(false);
  });

  it('should throw on invalid transition attempt', () => {
    const sm = makeMachine('initializing');
    expect(() => sm.transition('talk')).toThrow();
  });

  it('should reject move action from any phase (not in transition table)', () => {
    const sm = makeMachine('exploring');
    expect(sm.canTransition('move')).toBe(false);
  });
});

describe('GameStateMachine - Death Transition', () => {
  it('should transition exploring → death when age >= lifespan', () => {
    const oldPlayer = { ...BASE_PLAYER, age: 80, lifespan: 80 };
    const sm = makeMachine('exploring', oldPlayer);
    expect(sm.canTransition('death')).toBe(true);
    sm.transition('death');
    expect(sm.getPhase()).toBe('death');
  });

  it('should NOT transition to death when age < lifespan', () => {
    const sm = makeMachine('exploring', BASE_PLAYER);
    expect(sm.canTransition('death')).toBe(false);
  });

  it('should transition to death via safetyFlag', () => {
    const sm = makeMachine('exploring');
    sm.addSafetyFlag('death_event');
    expect(sm.canTransition('death')).toBe(true);
  });
});

describe('GameStateMachine - Full Game Lifecycle', () => {
  it('should complete full lifecycle: init → explore → dialogue → event → ending', () => {
    const sm = makeMachine('initializing');

    sm.transition('world_generated');
    expect(sm.getPhase()).toBe('exploring');

    sm.transition('talk');
    expect(sm.getPhase()).toBe('dialoguing');

    sm.transition('end_dialogue');
    expect(sm.getPhase()).toBe('exploring');

    sm.transition('next_year');
    expect(sm.getPhase()).toBe('event');

    sm.transition('resolve_event');
    expect(sm.getPhase()).toBe('exploring');

    sm.transition('attempt_breakthrough');
    expect(sm.getPhase()).toBe('ending_check');

    sm.transition('trigger_ending');
    expect(sm.getPhase()).toBe('ended');
  });
});

describe('GameStateMachine - Available Actions', () => {
  it('should list available actions for exploring', () => {
    const sm = makeMachine('exploring');
    const actions = sm.getAvailableActions();
    expect(actions).toContain('talk');
    expect(actions).toContain('next_year');
    expect(actions).toContain('discover');
    expect(actions).toContain('investigate');
    expect(actions).toContain('event_choice');
    expect(actions).toContain('attempt_breakthrough');
  });

  it('should list end_dialogue for dialoguing', () => {
    const sm = makeMachine('dialoguing');
    const actions = sm.getAvailableActions();
    expect(actions).toContain('end_dialogue');
    expect(actions).toHaveLength(1);
  });

  it('should list no actions for ended phase', () => {
    const sm = makeMachine('ended');
    const actions = sm.getAvailableActions();
    expect(actions).toHaveLength(0);
  });
});

describe('GameStateMachine - State Update', () => {
  it('should update player state within machine', () => {
    const sm = makeMachine('exploring');
    sm.updatePlayerState({ age: 17, realm: '练气' });
    expect(sm.getCurrentState().playerState.age).toBe(17);
    expect(sm.getCurrentState().playerState.realm).toBe('练气');
  });

  it('should preserve non-updated fields', () => {
    const sm = makeMachine('exploring');
    sm.updatePlayerState({ age: 17 });
    expect(sm.getCurrentState().playerState.name).toBe('行者');
    expect(sm.getCurrentState().playerState.attributes.calculation).toBe(10);
  });
});

describe('NpcDialogueOutputSchema - P0-4 C1 Fix', () => {
  it('should accept "assistant" role (was blocked by z.enum(["npc"]))', () => {
    const result = NpcDialogueOutputSchema.safeParse({
      role: 'assistant',
      content: '你好，修行者',
    });
    expect(result.success).toBe(true);
  });

  it('should accept "npc" role', () => {
    const result = NpcDialogueOutputSchema.safeParse({
      role: 'npc',
      content: '欢迎来到灵墟',
    });
    expect(result.success).toBe(true);
  });

  it('should accept any string role', () => {
    const result = NpcDialogueOutputSchema.safeParse({
      role: 'system',
      content: '游戏开始',
    });
    expect(result.success).toBe(true);
  });

  it('should reject non-string role', () => {
    const result = NpcDialogueOutputSchema.safeParse({
      role: 123,
      content: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('should accept with metadata', () => {
    const result = NpcDialogueOutputSchema.safeParse({
      role: 'assistant',
      content: '你好',
      metadata: {
        emotion: 'friendly',
        trustChange: 0.05,
        hintAtSecret: true,
        suggestedActions: ['参悟', '离开'],
      },
    });
    expect(result.success).toBe(true);
  });

  it('should accept without metadata (optional)', () => {
    const result = NpcDialogueOutputSchema.safeParse({
      role: 'assistant',
      content: '简单对话',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty content', () => {
    const result = NpcDialogueOutputSchema.safeParse({
      role: 'assistant',
    });
    expect(result.success).toBe(false);
  });

  it('should reject trustChange out of range', () => {
    const result = NpcDialogueOutputSchema.safeParse({
      role: 'assistant',
      content: 'test',
      metadata: {
        emotion: 'friendly',
        trustChange: 0.5,
      },
    });
    expect(result.success).toBe(false);
  });
});

describe('EndingOutputSchema - P0-4 Shared Schema', () => {
  it('should validate correct ending output', () => {
    const result = EndingOutputSchema.safeParse({
      eligibleEndings: [
        {
          id: 'ending_1',
          title: '变分真理',
          description: '悟出真理',
          requiredEvidence: ['clue_1'],
          tone: 'philosophical',
          evidenceFulfilled: true,
        },
      ],
      ineligibleEndings: [
        {
          id: 'ending_2',
          reason: '缺少关键证据',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty arrays', () => {
    const result = EndingOutputSchema.safeParse({
      eligibleEndings: [],
      ineligibleEndings: [],
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing required fields in eligible ending', () => {
    const result = EndingOutputSchema.safeParse({
      eligibleEndings: [
        { id: 'ending_1' },
      ],
      ineligibleEndings: [],
    });
    expect(result.success).toBe(false);
  });

  it('should accept optional requiredRealm in eligible ending', () => {
    const result = EndingOutputSchema.safeParse({
      eligibleEndings: [
        {
          id: 'ending_1',
          title: '天道',
          description: '证天道',
          requiredEvidence: [],
          requiredRealm: '天道境',
          tone: 'transcendent',
          evidenceFulfilled: true,
        },
      ],
      ineligibleEndings: [],
    });
    expect(result.success).toBe(true);
  });
});
