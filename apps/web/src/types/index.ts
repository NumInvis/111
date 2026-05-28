export const REALMS = [
  '炼体','练气','筑基','本元','通明','化神',
  '归一','渡劫','天门','仙境','圣境','变分境','天道境','无限',
] as const
export type Realm = (typeof REALMS)[number]

export const RISK_LEVELS = ['low','medium','high','extreme'] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]

export const EVENT_TYPES = ['annual','event','discovery','relationship_change','ending_candidate','realm_breakthrough','death'] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const JOURNAL_CATEGORIES = ['event','discovery','relationship','realm','ending'] as const
export type JournalCategory = (typeof JOURNAL_CATEGORIES)[number]

export interface WorldPreference {
  direction: string
  mode: string
  seed?: number
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
    backstory: string
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
  mathematicalDoctrine?: string
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
  mathematicalStrength?: string
  trustLevel: number
}

export interface Rumor {
  id: string
  content: string
  credibility: number
  relatedLocation?: string
  relatedNpc?: string
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
  triggerCondition: string
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
  factions: Faction[]
  locations: Location[]
  npcs: NpcSeed[]
  rumors: Rumor[]
  events: EventSeed[]
  endingCandidates: EndingCandidate[]
  stateModel?: Record<string, [number, number]>
}

export interface Attribute {
  calculation: number
  geometry: number
  abstraction: number
  proof: number
  intuition: number
  focus: number
  body: number
  family: number
}

export const ATTRIBUTE_LABELS: Record<keyof Attribute, string> = {
  calculation: '演算',
  geometry: '几何',
  abstraction: '抽象',
  proof: '证明',
  intuition: '直觉',
  focus: '专注',
  body: '体魄',
  family: '家世',
}

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
}

export const GenerationScaleEnum = ['small', 'medium', 'large'] as const
export type GenerationScale = typeof GenerationScaleEnum[number]

export const GenerationModeEnum = ['quick', 'complete', 'infinite'] as const
export type GenerationMode = typeof GenerationModeEnum[number]

export interface GenerationPreferences {
  theme: string
  scale: GenerationScale
  tone: string
  seed?: number
  mode: GenerationMode
}