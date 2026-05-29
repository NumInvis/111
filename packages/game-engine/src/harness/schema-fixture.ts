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
      cultivationTiers: [{ id: 'lianTi', name: '炼体', requiredAttributes: { 算力: 5, 悟性: 2, 体魄: 10 } }],
      legendaryFigures: [],
    },
  },
  attributeDefs: [
    { name: '算力', description: '计算与推理能力', growthPerYear: 1 },
    { name: '悟性', description: '直觉与洞察', growthPerYear: 1 },
    { name: '体魄', description: '身体素质与生命力', growthPerYear: 2 },
    { name: '专注', description: '精神耐力与定力', growthPerYear: 2 },
    { name: '家世', description: '家族背景与社会资源', growthPerYear: 1 },
  ],
  advancementRules: [
    { fromRealm: '炼体', toRealm: '练气', requiredAttributes: { 算力: 10, 专注: 10, 体魄: 10 }, primaryAttribute: '体魄', breakthroughCost: 3, lifespanExtension: 5, failureLifespanLoss: 2 },
    { fromRealm: '练气', toRealm: '筑基', requiredAttributes: { 算力: 20, 悟性: 10, 专注: 15 }, primaryAttribute: '算力', breakthroughCost: 3, lifespanExtension: 5, failureLifespanLoss: 2 },
    { fromRealm: '筑基', toRealm: '本元', requiredAttributes: { 算力: 30, 悟性: 15 }, primaryAttribute: '悟性', breakthroughCost: 5, lifespanExtension: 8, failureLifespanLoss: 2 },
    { fromRealm: '本元', toRealm: '通明', requiredAttributes: { 算力: 40, 悟性: 20, 专注: 20 }, primaryAttribute: '专注', breakthroughCost: 5, lifespanExtension: 8, failureLifespanLoss: 2 },
    { fromRealm: '通明', toRealm: '化神', requiredAttributes: { 算力: 50, 悟性: 30 }, primaryAttribute: '悟性', breakthroughCost: 5, lifespanExtension: 10, failureLifespanLoss: 2 },
    { fromRealm: '化神', toRealm: '归一', requiredAttributes: { 算力: 60, 悟性: 40, 专注: 30 }, primaryAttribute: '算力', breakthroughCost: 5, lifespanExtension: 10, failureLifespanLoss: 2 },
    { fromRealm: '归一', toRealm: '渡劫', requiredAttributes: { 算力: 70, 悟性: 50, 体魄: 40 }, primaryAttribute: '体魄', breakthroughCost: 8, lifespanExtension: 12, failureLifespanLoss: 2 },
    { fromRealm: '渡劫', toRealm: '天门', requiredAttributes: { 算力: 80, 悟性: 60 }, primaryAttribute: '算力', breakthroughCost: 8, lifespanExtension: 15, failureLifespanLoss: 3 },
    { fromRealm: '天门', toRealm: '仙境', requiredAttributes: { 算力: 85, 悟性: 70, 专注: 60 }, primaryAttribute: '悟性', breakthroughCost: 8, lifespanExtension: 15, failureLifespanLoss: 3 },
    { fromRealm: '仙境', toRealm: '圣境', requiredAttributes: { 算力: 90, 悟性: 80 }, primaryAttribute: '算力', breakthroughCost: 8, lifespanExtension: 18, failureLifespanLoss: 3 },
    { fromRealm: '圣境', toRealm: '变分境', requiredAttributes: { 算力: 95, 悟性: 90, 专注: 75 }, primaryAttribute: '悟性', breakthroughCost: 8, lifespanExtension: 18, failureLifespanLoss: 3 },
    { fromRealm: '变分境', toRealm: '天道境', requiredAttributes: { 算力: 98, 悟性: 95 }, primaryAttribute: '算力', breakthroughCost: 8, lifespanExtension: 20, failureLifespanLoss: 3 },
    { fromRealm: '天道境', toRealm: '无限', requiredAttributes: { 算力: 100, 悟性: 100, 专注: 100, 体魄: 100 }, primaryAttribute: '悟性', breakthroughCost: 8, lifespanExtension: 20, failureLifespanLoss: 5 },
  ],
  startingState: {
    name: '行者',
    age: 16,
    lifespan: 80,
    realm: '炼体',
    attributes: { 算力: 10, 悟性: 5, 体魄: 20, 专注: 10, 家世: 10 },
  },
  factions: [
    { id: 'faction_math', name: '数理宗', goal: '追求数理真理', conflict: '与混沌宗对抗', philosophy: '极限主义' },
    { id: 'faction_chaos', name: '混沌宗', goal: '打破秩序', conflict: '反对数理宗' },
  ],
  locations: [
    { id: 'loc_start', name: '灵墟入口', description: '一切开始的地方', connections: ['loc_temple', 'loc_market'], riskLevel: 'low', exploreActions: ['观察', '询问'] },
    { id: 'loc_temple', name: '数理寺', description: '数理宗的修行之地', connections: ['loc_start'], riskLevel: 'medium', exploreActions: ['参悟', '论道'] },
    { id: 'loc_market', name: '灵墟集市', description: '交换资源与情报', connections: ['loc_start'], riskLevel: 'low', exploreActions: ['交易', '打听'] },
  ],
  npcs: [
    { id: 'npc_master', name: '方丈', role: 'mentor', faction: 'faction_math', personality: ['严厉', '智慧', '耐心'], goal: '培养弟子', secret: '暗藏变分手稿', forbiddenTopics: ['变分手稿'], dialogueStyle: '教诲式', cultivationLevel: '通明', specialty: '微积分', trustLevel: 0.5 },
    { id: 'npc_rival', name: '邪修', role: 'rival', faction: 'faction_chaos', personality: ['狡诈', '野心', '傲慢'], goal: '击败数理宗', secret: '是混沌宗卧底', forbiddenTopics: ['卧底身份'], dialogueStyle: '挑衅式', cultivationLevel: '筑基', specialty: '概率论', trustLevel: 0.2 },
    { id: 'npc_merchant', name: '商修', role: 'merchant', personality: ['精明', '健谈'], goal: '积累资源', secret: '走私禁忌书籍', forbiddenTopics: ['走私'], dialogueStyle: '交易式', cultivationLevel: '练气', specialty: '算术', trustLevel: 0.3 },
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
      { label: '参拜数理寺', description: '前往数理寺拜师', riskLevel: 'low', consequenceHint: '可能获得指导', attributeEffects: { 悟性: 5, 专注: 5 } },
      { label: '探索集市', description: '前往集市打探消息', riskLevel: 'low', consequenceHint: '可能发现线索', attributeEffects: { 家世: 3, 悟性: 3 } },
    ], relatedNpcIds: ['npc_master', 'npc_merchant'] },
    { id: 'evt_2', triggerCondition: { minAge: 20, locationId: 'loc_temple' }, locationId: 'loc_temple', description: '论道考验', oneTime: true, options: [
      { label: '接受考验', description: '参加数理论道', riskLevel: 'medium', consequenceHint: '成功则境界提升', attributeEffects: { 算力: 10, 悟性: 5, 专注: -5 }, requiresRealm: '筑基' },
      { label: '回避考验', description: '推迟论道', riskLevel: 'low', consequenceHint: '延缓进步', attributeEffects: { 专注: 3 } },
    ], relatedNpcIds: ['npc_master'] },
    { id: 'evt_3', triggerCondition: { discoveredClueId: 'clue_2' }, locationId: 'loc_market', description: '发现卧底', oneTime: true, options: [
      { label: '揭露邪修', description: '当众揭露混沌宗卧底', riskLevel: 'high', consequenceHint: '可能引发冲突', attributeEffects: { 算力: 8, 体魄: -5, 家世: -3 } },
      { label: '暗中观察', description: '继续监视邪修', riskLevel: 'low', consequenceHint: '等待时机', attributeEffects: { 悟性: 5, 专注: 3 } },
    ], relatedNpcIds: ['npc_rival'] },
  ],
  endingCandidates: [
    { id: 'ending_truth', title: '变分真理', description: '发现变分手稿并悟出真理', requiredEvidence: ['clue_1'], requiredRealm: '通明', tone: 'philosophical' },
    { id: 'ending_expose', title: '揭露卧底', description: '揭露混沌宗在灵墟的卧底', requiredEvidence: ['clue_2'], tone: 'triumphant' },
    { id: 'ending_trade', title: '禁忌商道', description: '利用禁忌书籍建立地下知识网络', requiredEvidence: ['clue_3'], tone: 'mysterious' },
  ],
};

const PLAYER_STATE_FIXTURE: Record<string, unknown> = {
  name: '行者',
  age: 16,
  lifespan: 80,
  realm: '炼体',
  currentLocationId: 'loc_start',
  attributes: { 算力: 10, 悟性: 5, 体魄: 20, 专注: 10, 家世: 10 },
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
