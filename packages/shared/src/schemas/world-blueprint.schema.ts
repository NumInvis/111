import { z } from 'zod';

export const CultivationPathSchema = z.object({
  id: z.string().describe('Unique identifier for the cultivation path'),
  name: z.string().describe('Display name of the cultivation path'),
  description: z.string().describe('Description of the cultivation path philosophy and methods'),
  tierIds: z.array(z.string()).describe('Ordered list of cultivation tier IDs along this path'),
});

export type CultivationPath = z.infer<typeof CultivationPathSchema>;

export const CultivationTierSchema = z.object({
  id: z.string().describe('Unique identifier for the cultivation tier/realm'),
  name: z.string().describe('Display name of the cultivation realm in Chinese'),
  requiredAttributes: z.record(z.string(), z.number().min(0).max(100)).describe('Minimum attribute values required to reach this realm'),
});

export type CultivationTier = z.infer<typeof CultivationTierSchema>;

export const LegendaryFigureSchema = z.object({
  id: z.string().describe('Unique identifier for the legendary figure'),
  name: z.string().describe('Display name of the legendary figure'),
  realm: z.string().describe('The cultivation realm this figure has achieved'),
  backstory: z.string().describe('Brief backstory or legend associated with this figure'),
});

export type LegendaryFigure = z.infer<typeof LegendaryFigureSchema>;

export const PowerSystemSchema = z.object({
  cultivationPaths: z.array(CultivationPathSchema).min(1).describe('Available cultivation paths a player may follow'),
  cultivationTiers: z.array(CultivationTierSchema).describe('Ordered list of all cultivation tiers/realm stages'),
  legendaryFigures: z.array(LegendaryFigureSchema).optional().describe('Optional notable figures in this world\'s power system'),
});

export type PowerSystem = z.infer<typeof PowerSystemSchema>;

export const WorldProfileSchema = z.object({
  name: z.string().describe('Name of the generated world'),
  coreConflict: z.string().describe('The central conflict driving the world\'s narrative'),
  worldRules: z.array(z.string()).describe('Fundamental rules governing this world'),
  taboos: z.array(z.string()).describe('Taboos and forbidden actions in this world'),
  narrativeTone: z.string().describe('Overall narrative tone (e.g., dark, humorous, philosophical)'),
  powerSystem: PowerSystemSchema.describe('The cultivation/power system defining realm progression'),
});

export type WorldProfile = z.infer<typeof WorldProfileSchema>;

export const FactionSchema = z.object({
  id: z.string().describe('Unique identifier for the faction'),
  name: z.string().describe('Display name of the faction'),
  goal: z.string().describe('The faction\'s primary objective or motivation'),
  conflict: z.string().describe('What this faction is in conflict over or against'),
  mathematicalDoctrine: z.string().optional().describe('Optional mathematical philosophy or doctrine the faction follows'),
});

export type Faction = z.infer<typeof FactionSchema>;

export const RiskLevelEnum = z.enum(['low', 'medium', 'high', 'extreme']);

export type RiskLevel = z.infer<typeof RiskLevelEnum>;

export const LocationSchema = z.object({
  id: z.string().describe('Unique identifier for the location'),
  name: z.string().describe('Display name of the location'),
  description: z.string().describe('Detailed description of the location\'s appearance and atmosphere'),
  connections: z.array(z.string()).describe('IDs of locations connected to this one for navigation'),
  riskLevel: RiskLevelEnum.describe('Danger level of this location'),
  exploreActions: z.array(z.string()).min(1).max(4).describe('Available exploration actions at this location (1-4)'),
  atmosphere: z.string().optional().describe('Optional atmospheric description or mood tags'),
});

export type Location = z.infer<typeof LocationSchema>;

export const NpcSeedSchema = z.object({
  id: z.string().describe('Unique identifier for the NPC'),
  name: z.string().describe('Display name of the NPC'),
  role: z.string().describe('Role archetype of the NPC in the world (e.g., mentor, rival, merchant)'),
  faction: z.string().optional().describe('Optional faction ID the NPC belongs to'),
  personality: z.array(z.string()).min(2).max(5).describe('Personality trait tags for this NPC (2-5 traits)'),
  goal: z.string().describe('The NPC\'s primary personal goal or motivation'),
  secret: z.string().describe('A hidden secret the NPC conceals from the player'),
  forbiddenTopics: z.array(z.string()).describe('Topics the NPC refuses to discuss or reacts negatively to'),
  dialogueStyle: z.string().describe('Description of the NPC\'s speech pattern and conversational style'),
  cultivationLevel: z.string().optional().describe('Optional cultivation realm name the NPC has achieved'),
  mathematicalStrength: z.string().optional().describe('Optional mathematical domain the NPC excels in'),
  trustLevel: z.number().min(0).max(1).default(0.3).describe('Initial trust level toward the player (0-1, default 0.3)'),
});

export type NpcSeed = z.infer<typeof NpcSeedSchema>;

export const RumorSchema = z.object({
  id: z.string().describe('Unique identifier for the rumor'),
  content: z.string().describe('The rumor text content'),
  credibility: z.number().min(0).max(1).describe('How credible this rumor is perceived to be (0-1)'),
  relatedLocation: z.string().optional().describe('Optional location ID where this rumor originates or relates to'),
  relatedNpc: z.string().optional().describe('Optional NPC ID who is the source or subject of this rumor'),
});

export type Rumor = z.infer<typeof RumorSchema>;

export const EventOptionSchema = z.object({
  label: z.string().describe('Short label for the choice option'),
  description: z.string().describe('Detailed description of what this choice entails'),
  riskLevel: RiskLevelEnum.optional().describe('Optional risk level associated with choosing this option'),
  consequenceHint: z.string().describe('Brief hint about potential consequences of this choice'),
  attributeEffects: z.record(z.string(), z.number()).optional().describe('Optional attribute name to numeric effect mapping'),
  requiresRealm: z.string().optional().describe('Optional realm ID required to be eligible for this option'),
});

export type EventOption = z.infer<typeof EventOptionSchema>;

export const EventSeedSchema = z.object({
  id: z.string().describe('Unique identifier for the event seed'),
  triggerCondition: z.string().describe('Condition description for when this event triggers'),
  locationId: z.string().describe('Location ID where this event takes place'),
  description: z.string().describe('Narrative description of the event scenario'),
  options: z.array(EventOptionSchema).min(2).max(4).describe('Available choices for the player (2-4 options)'),
  relatedNpcIds: z.array(z.string()).optional().describe('Optional NPC IDs involved in this event'),
  oneTime: z.boolean().describe('Whether this event can only trigger once per game session'),
});

export type EventSeed = z.infer<typeof EventSeedSchema>;

export const EndingCandidateSchema = z.object({
  id: z.string().describe('Unique identifier for the ending candidate'),
  title: z.string().describe('Display title of the ending'),
  description: z.string().describe('Narrative description of the ending scenario'),
  requiredEvidence: z.array(z.string()).describe('List of evidence/clue IDs required to unlock this ending'),
  requiredRealm: z.string().optional().describe('Optional realm ID required to be eligible for this ending'),
  tone: z.string().describe('Narrative tone of the ending (e.g., triumphant, tragic, mysterious)'),
});

export type EndingCandidate = z.infer<typeof EndingCandidateSchema>;

export const RealmIdEnum = z.enum([
  'lianTi',
  'lianQi',
  'zhuJi',
  'benYuan',
  'tongMing',
  'huaShen',
  'guiYi',
  'duJie',
  'tianMen',
  'xianJing',
  'shengJing',
  'bianFenJing',
  'tianDaoJing',
  'wuXian',
]);

export const RealmNameEnum = z.enum([
  '炼体',
  '练气',
  '筑基',
  '本元',
  '通明',
  '化神',
  '归一',
  '渡劫',
  '天门',
  '仙境',
  '圣境',
  '变分境',
  '天道境',
  '无限',
]);

export const RealmMapSchema = z.record(RealmIdEnum, RealmNameEnum).describe('Mapping from realm IDs to Chinese realm names');

export type RealmId = z.infer<typeof RealmIdEnum>;
export type RealmName = z.infer<typeof RealmNameEnum>;
export type RealmMap = z.infer<typeof RealmMapSchema>;

export const WorldBlueprintSchema = z.object({
  worldProfile: WorldProfileSchema.describe('Core world profile defining the narrative setting'),
  factions: z.array(FactionSchema).min(2).max(5).describe('Factions in this world (2-5)'),
  locations: z.array(LocationSchema).min(3).max(7).describe('Explorable locations in this world (3-7)'),
  npcs: z.array(NpcSeedSchema).min(3).max(7).describe('NPCs populating this world (3-7)'),
  rumors: z.array(RumorSchema).min(2).max(10).describe('Rumors circulating in this world (2-10)'),
  events: z.array(EventSeedSchema).min(3).max(8).describe('Event seeds that may trigger during play (3-8)'),
  endingCandidates: z.array(EndingCandidateSchema).min(2).max(5).describe('Possible endings the player may reach (2-5)'),
  stateModel: z.record(z.string(), z.tuple([z.number(), z.number()])).optional().describe('Optional model of state field names to allowed value ranges [min, max]'),
});

export type WorldBlueprint = z.infer<typeof WorldBlueprintSchema>;