export const REALMS = [
  '炼体','练气','筑基','本元','通明','化神',
  '归一','渡劫','天门','仙境','圣境','变分境','天道境','无限',
] as const
export type Realm = (typeof REALMS)[number]

export const REALM_MATH_LEVELS: Record<string, string> = {
  '炼体': '幼儿园',
  '练气': '小学1-2年级',
  '筑基': '小学3-4年级',
  '本元': '小学5-6年级',
  '通明': '初一初二',
  '化神': '初三',
  '归一': '高一高二',
  '渡劫': '高三',
  '天门': '高考/大学入学',
  '仙境': '大学低年级',
  '圣境': '大学高年级',
  '变分境': '研究生',
  '天道境': '数学系博士',
  '无限': '超越',
}

export const RISK_LEVELS = ['low','medium','high','extreme'] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]

export const EVENT_TYPES = ['annual','event','discovery','relationship_change','ending_candidate','realm_breakthrough','breakthrough_failure','death'] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const JOURNAL_CATEGORIES = ['event','discovery','relationship','realm','ending'] as const
export type JournalCategory = (typeof JOURNAL_CATEGORIES)[number]

export interface AttributeDef {
  name: string
  description: string
  growthPerYear: number
}

export interface RealmAdvancementRule {
  fromRealm: string
  toRealm: string
  requiredAttributes: Record<string, number>
  primaryAttribute: string
  breakthroughCost: number
  lifespanExtension: number
  failureLifespanLoss: number
}

export interface StartingState {
  name: string
  age: number
  lifespan: number
  realm: string
  attributes: Record<string, number>
}

export interface PowerSystem {
  cultivationPaths: Array<{
    id: string
    name: string
    description: string
    tierIds: string[]
  }>
  cultivationTiers: Array<{
    id: string
    name: string
    requiredAttributes: Record<string, number>
  }>
  legendaryFigures?: Array<{
    id: string
    name: string
    realm: string
    legend: string
    legacy?: string
  }>
}

export interface WorldProfile {
  name: string
  coreConflict: string
  worldRules: string[]
  taboos: string[]
  narrativeTone: string
  powerSystem: PowerSystem
}

export interface Faction {
  id: string
  name: string
  goal: string
  conflict: string
  philosophy?: string
}

export interface Location {
  id: string
  name: string
  description: string
  connections: string[]
  riskLevel: RiskLevel
  exploreActions: string[]
  atmosphere?: string
}

export interface NpcSeed {
  id: string
  name: string
  role: string
  faction?: string
  personality: string[]
  goal: string
  secret: string
  forbiddenTopics: string[]
  dialogueStyle: string
  cultivationLevel?: string
  specialty?: string
  trustLevel: number
}

export interface Clue {
  id: string
  name: string
  description: string
  locationId?: string
  npcId?: string
  category: 'evidence' | 'rumor_clue' | 'investigation' | 'dialogue_hint' | 'breakthrough_insight'
  relatedEndingIds?: string[]
}

export interface Rumor {
  id: string
  content: string
  credibility: number
  relatedLocation?: string
  relatedNpc?: string
}

export interface TriggerCondition {
  minRealm?: string
  minAge?: number
  locationId?: string
  discoveredNpcId?: string
  discoveredClueId?: string
}

export interface EventOption {
  label: string
  description: string
  riskLevel?: RiskLevel
  consequenceHint: string
  attributeEffects?: Record<string, number>
  requiresRealm?: string
}

export interface EventSeed {
  id: string
  triggerCondition: TriggerCondition
  locationId: string
  description: string
  options: EventOption[]
  relatedNpcIds?: string[]
  oneTime: boolean
}

export interface EndingCandidate {
  id: string
  title: string
  description: string
  requiredEvidence: string[]
  requiredRealm?: string
  tone: string
}

export interface WorldBlueprint {
  worldProfile: WorldProfile
  attributeDefs: AttributeDef[]
  advancementRules: RealmAdvancementRule[]
  startingState: StartingState
  factions: Faction[]
  locations: Location[]
  npcs: NpcSeed[]
  clues: Clue[]
  rumors: Rumor[]
  events: EventSeed[]
  endingCandidates: EndingCandidate[]
}

export type Attribute = Record<string, number>

export type FriendshipLevel = 'stranger' | 'acquaintance' | 'friend' | 'confidant' | 'rival' | 'enemy'

export interface RelationshipState {
  npcId: string
  trust: number
  friendshipLevel: FriendshipLevel
  lastInteractionTurn: number
}

export interface PlayerState {
  name: string
  age: number
  lifespan: number
  realm: Realm
  currentLocationId: string
  attributes: Attribute
  discoveredLocations: string[]
  discoveredNpcs: string[]
  discoveredClues: string[]
  discoveredRumors: string[]
  relationships: Record<string, RelationshipState>
  historySummary: string
}

export interface JournalEntry {
  id: string
  sessionId: string
  turn: number
  locationId: string
  action: string
  result: string
  evidenceTag?: boolean
  category: JournalCategory
}

export interface DialogueMessage {
  id: string
  npcId: string
  role: 'player' | 'npc' | 'system'
  content: string
  metadata?: Record<string, unknown>
  turn: number
  memoryRefs?: Array<{ id: string; content: string }>
}

export interface EndingResult {
  id: string
  title: string
  description: string
  requiredEvidence: string[]
  requiredRealm?: string
  tone: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  traceId?: string
  warnings?: string[]
}

export interface StateUpdate {
  newState: Partial<PlayerState>
  journalEntries: JournalEntry[]
  events: Array<{
    sessionId: string
    eventType: EventType
    data: Record<string, unknown>
    turn: number
  }>
  relationships: Record<string, RelationshipState>
  hints?: string[]
}
