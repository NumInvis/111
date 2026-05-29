import { WorldBlueprintSchema, PlayerStateSchema, GameActionSchema, DialogueMessageSchema, JournalEntrySchema } from '@variational-infinity/shared';
import { z } from 'zod';

const WORLD_BLUEPRINT_FIXTURE: Record<string, unknown> = {
  worldProfile: {
    name: '灵墟',
    coreConflict: '数理真理与混沌之争',
    worldRules: ['修仙即求真', '境界越高越接近变分原理'],
    taboos: ['不可伪造证明', '不可跳境'],
    narrativeTone: 'philosophical',
    powerSystem: {
      cultivationPaths: [{ id: 'path_math', name: '数理大道', description: '以数学求真为修炼之路', tierIds: ['lianTi'] }],
      cultivationTiers: [{ id: 'lianTi', name: '炼体', requiredAttributes: { calculation: 5, geometry: 3, abstraction: 2, proof: 1, intuition: 2, focus: 5, physique: 10, family: 5 } }],
      legendaryFigures: [],
    },
  },
  factions: [
    { id: 'faction_math', name: '数理宗', goal: '追求数理真理', conflict: '与混沌宗对抗', mathematicalDoctrine: '极限主义' },
    { id: 'faction_chaos', name: '混沌宗', goal: '打破秩序', conflict: '反对数理宗', mathematicalDoctrine: null },
  ],
  locations: [
    { id: 'loc_start', name: '灵墟入口', description: '一切开始的地方', connections: ['loc_temple', 'loc_market'], riskLevel: 'low', exploreActions: ['观察', '询问'] },
    { id: 'loc_temple', name: '数理寺', description: '数理宗的修行之地', connections: ['loc_start'], riskLevel: 'medium', exploreActions: ['参悟', '论道'] },
    { id: 'loc_market', name: '灵墟集市', description: '交换资源与情报', connections: ['loc_start'], riskLevel: 'low', exploreActions: ['交易', '打听'] },
  ],
  npcs: [
    { id: 'npc_master', name: '方丈', role: 'mentor', faction: 'faction_math', personality: ['严厉', '智慧', '耐心'], goal: '培养弟子', secret: '暗藏变分手稿', forbiddenTopics: ['变分手稿'], dialogueStyle: '教诲式', cultivationLevel: '通明', mathematicalStrength: '微积分', trustLevel: 0.5 },
    { id: 'npc_rival', name: '邪修', role: 'rival', faction: 'faction_chaos', personality: ['狡诈', '野心', '傲慢'], goal: '击败数理宗', secret: '是混沌宗卧底', forbiddenTopics: ['卧底身份'], dialogueStyle: '挑衅式', cultivationLevel: '筑基', mathematicalStrength: '概率论', trustLevel: 0.2 },
    { id: 'npc_merchant', name: '商修', role: 'merchant', personality: ['精明', '健谈'], goal: '积累资源', secret: '走私禁忌书籍', forbiddenTopics: ['走私'], dialogueStyle: '交易式', cultivationLevel: '练气', mathematicalStrength: '算术', trustLevel: 0.3 },
  ],
  clues: [
    { id: 'clue_1', name: '变分残卷', description: '方丈暗藏的变分手稿残页', locationId: 'loc_temple', npcId: 'npc_master', category: 'evidence', relatedEndingIds: ['ending_truth'] },
    { id: 'clue_2', name: '混沌标记', description: '邪修身上的混沌宗暗印', npcId: 'npc_rival', category: 'evidence', relatedEndingIds: ['ending_expose'] },
    { id: 'clue_3', name: '禁忌书单', description: '商修走私的禁忌书籍目录', locationId: 'loc_market', npcId: 'npc_merchant', category: 'rumor_clue', relatedEndingIds: ['ending_trade'] },
  ],
  rumors: [
    { id: 'rumor_1', content: '方丈暗藏一本古卷', credibility: 0.7, relatedLocation: 'loc_temple', relatedNpc: 'npc_master' },
    { id: 'rumor_2', content: '集市上有禁忌书籍流通', credibility: 0.5, relatedLocation: 'loc_market', relatedNpc: 'npc_merchant' },
  ],
  events: [
    { id: 'evt_1', triggerCondition: { minRealm: '炼体', locationId: 'loc_start' }, locationId: 'loc_start', description: '初入灵墟', oneTime: true, options: [
      { label: '参拜数理寺', description: '前往数理寺拜师', riskLevel: 'low', consequenceHint: '可能获得指导', attributeEffects: { intuition: 5, focus: 5 }, requiresRealm: null },
      { label: '探索集市', description: '前往集市打探消息', riskLevel: 'low', consequenceHint: '可能发现线索', attributeEffects: { family: 3, intuition: 3 }, requiresRealm: null },
    ], relatedNpcIds: ['npc_master', 'npc_merchant'] },
    { id: 'evt_2', triggerCondition: { minAge: 20, locationId: 'loc_temple' }, locationId: 'loc_temple', description: '论道考验', oneTime: true, options: [
      { label: '接受考验', description: '参加数理论道', riskLevel: 'medium', consequenceHint: '成功则境界提升', attributeEffects: { proof: 10, abstraction: 5, focus: -5 }, requiresRealm: '筑基' },
      { label: '回避考验', description: '推迟论道', riskLevel: 'low', consequenceHint: '延缓进步', attributeEffects: { focus: 3 }, requiresRealm: null },
    ], relatedNpcIds: ['npc_master'] },
    { id: 'evt_3', triggerCondition: { discoveredClueId: 'clue_2' }, locationId: 'loc_market', description: '发现卧底', oneTime: true, options: [
      { label: '揭露邪修', description: '当众揭露混沌宗卧底', riskLevel: 'high', consequenceHint: '可能引发冲突', attributeEffects: { proof: 8, physique: -5, family: -3 }, requiresRealm: null },
      { label: '暗中观察', description: '继续监视邪修', riskLevel: 'low', consequenceHint: '等待时机', attributeEffects: { intuition: 5, focus: 3 }, requiresRealm: null },
    ], relatedNpcIds: ['npc_rival'] },
  ],
  endingCandidates: [
    { id: 'ending_truth', title: '变分真理', description: '发现变分手稿并悟出真理', requiredEvidence: ['clue_1'], requiredRealm: '通明', tone: 'philosophical' },
    { id: 'ending_expose', title: '揭露卧底', description: '揭露混沌宗在灵墟的卧底', requiredEvidence: ['clue_2'], requiredRealm: null, tone: 'triumphant' },
    { id: 'ending_trade', title: '禁忌商道', description: '利用禁忌书籍建立地下知识网络', requiredEvidence: ['clue_3'], tone: 'mysterious' },
  ],
  stateModel: { calculation: [0, 100], geometry: [0, 100], abstraction: [0, 100], proof: [0, 100], intuition: [0, 100], focus: [0, 100], physique: [0, 100], family: [0, 100] },
};

const PLAYER_STATE_FIXTURE: Record<string, unknown> = {
  name: '行者',
  age: 16,
  lifespan: 80,
  realm: '炼体',
  currentLocationId: 'loc_start',
  attributes: { calculation: 10, geometry: 5, abstraction: 5, proof: 3, intuition: 5, focus: 10, physique: 20, family: 10 },
  discoveredLocations: ['loc_start'],
  discoveredNpcs: ['npc_master'],
  discoveredClues: [],
  discoveredRumors: [],
  relationships: {},
  historySummary: '初入灵墟，一切从零开始。',
};

const GAME_ACTION_FIXTURE: Record<string, unknown> = {
  sessionId: 'test-session-001',
  actionType: 'move',
  payload: { targetLocationId: 'loc_temple' },
  turn: 16,
};

const DIALOGUE_MESSAGE_FIXTURE: Record<string, unknown> = {
  sessionId: 'test-session-001',
  npcId: 'npc_master',
  role: 'npc',
  content: '欢迎来到数理寺，行者。修行之路漫漫，需以数理为基。',
  metadata: {},
  turn: 16,
};

const JOURNAL_ENTRY_FIXTURE: Record<string, unknown> = {
  id: 'je-001',
  sessionId: 'test-session-001',
  turn: 16,
  locationId: 'loc_start',
  action: 'move',
  result: '行者从灵墟入口前往数理寺。',
  evidenceTag: false,
  category: 'event',
};

interface FixtureResult {
  name: string;
  passed: boolean;
  errors: string[];
}

export function validateSchemaFixture(fixtureName: string, schema: z.ZodType, fixture: Record<string, unknown>): FixtureResult {
  const result = schema.safeParse(fixture);
  if (result.success) {
    return { name: fixtureName, passed: true, errors: [] };
  }
  return {
    name: fixtureName,
    passed: false,
    errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
  };
}

export function runAllSchemaFixtures(): FixtureResult[] {
  return [
    validateSchemaFixture('WorldBlueprint', WorldBlueprintSchema as z.ZodType, WORLD_BLUEPRINT_FIXTURE),
    validateSchemaFixture('PlayerState', PlayerStateSchema as z.ZodType, PLAYER_STATE_FIXTURE),
    validateSchemaFixture('GameAction', GameActionSchema as z.ZodType, GAME_ACTION_FIXTURE),
    validateSchemaFixture('DialogueMessage', DialogueMessageSchema as z.ZodType, DIALOGUE_MESSAGE_FIXTURE),
    validateSchemaFixture('JournalEntry', JournalEntrySchema as z.ZodType, JOURNAL_ENTRY_FIXTURE),
  ];
}