import { z } from 'zod';
import { RealmNameEnum } from './world-blueprint.schema';

export const AttributeSchema = z.object({
  calculation: z.number().min(0).max(100).describe('计算 — computational and arithmetic reasoning ability'),
  geometry: z.number().min(0).max(100).describe('几何 — spatial and geometric reasoning ability'),
  abstraction: z.number().min(0).max(100).describe('抽象 — abstract and conceptual reasoning ability'),
  proof: z.number().min(0).max(100).describe('证明 — logical proof and deductive reasoning ability'),
  intuition: z.number().min(0).max(100).describe('直觉 — mathematical intuition and insight ability'),
  focus: z.number().min(0).max(100).describe('专注 — concentration and mental endurance ability'),
  body: z.number().min(0).max(100).describe('体魄 — physical health and vitality'),
  family: z.number().min(0).max(100).describe('家世 — family background and social resources'),
});

export type Attribute = z.infer<typeof AttributeSchema>;

export const FriendshipLevelEnum = z.enum([
  'stranger',
  'acquaintance',
  'friend',
  'confidant',
  'rival',
  'enemy',
]);

export type FriendshipLevel = z.infer<typeof FriendshipLevelEnum>;

export const RelationshipStateSchema = z.object({
  npcId: z.string().describe('The NPC ID this relationship pertains to'),
  trust: z.number().min(0).max(1).describe('Trust level with this NPC (0-1)'),
  friendshipLevel: FriendshipLevelEnum.describe('Categorical friendship/relationship level'),
  lastInteractionTurn: z.number().min(0).describe('The turn number of the last interaction with this NPC'),
});

export type RelationshipState = z.infer<typeof RelationshipStateSchema>;

export const PlayerStateSchema = z.object({
  name: z.string().describe('Player character name'),
  age: z.number().min(0).describe('Current age of the player character in years'),
  lifespan: z.number().min(0).default(80).describe('Maximum lifespan before natural death (default 80)'),
  realm: RealmNameEnum.default('炼体').describe('Current cultivation realm the player has achieved'),
  currentLocationId: z.string().describe('ID of the location where the player currently resides'),
  attributes: AttributeSchema.describe('The 8 core numeric attributes of the player'),
  discoveredLocations: z.array(z.string()).describe('IDs of locations the player has discovered'),
  discoveredNpcs: z.array(z.string()).describe('IDs of NPCs the player has encountered'),
  discoveredClues: z.array(z.string()).describe('IDs of clues/evidence the player has found'),
  discoveredRumors: z.array(z.string()).describe('IDs of rumors the player has heard'),
  relationships: z.record(z.string(), RelationshipStateSchema).describe('Map of NPC IDs to their relationship states'),
  historySummary: z.string().describe('Summarized narrative of the player\'s life journey so far'),
});

export type PlayerState = z.infer<typeof PlayerStateSchema>;

export const ActionTypeEnum = z.enum([
  'move',
  'talk',
  'discover',
  'investigate',
  'next_year',
  'rest',
  'trade',
]);

export type ActionType = z.infer<typeof ActionTypeEnum>;

export const GameActionSchema = z.object({
  sessionId: z.string().describe('The game session ID this action belongs to'),
  actionType: ActionTypeEnum.describe('The type of action the player is performing'),
  payload: z.record(z.string(), z.unknown()).describe('Additional data specific to the action type'),
  turn: z.number().min(0).describe('The turn/year number when this action was taken'),
});

export type GameAction = z.infer<typeof GameActionSchema>;

export const EventTypeEnum = z.enum([
  'annual',
  'event',
  'discovery',
  'relationship_change',
  'ending_candidate',
  'realm_breakthrough',
  'death',
]);

export type EventType = z.infer<typeof EventTypeEnum>;

export const GameEventSchema = z.object({
  sessionId: z.string().describe('The game session ID this event belongs to'),
  eventType: EventTypeEnum.describe('The category of game event'),
  data: z.record(z.string(), z.unknown()).describe('Structured data payload specific to the event type'),
  turn: z.number().min(0).describe('The turn/year number when this event occurred'),
});

export type GameEvent = z.infer<typeof GameEventSchema>;

export const DialogueRoleEnum = z.enum(['player', 'npc', 'system']);

export type DialogueRole = z.infer<typeof DialogueRoleEnum>;

export const DialogueMessageSchema = z.object({
  sessionId: z.string().describe('The game session ID this message belongs to'),
  npcId: z.string().describe('The NPC ID involved in this dialogue'),
  role: DialogueRoleEnum.describe('Who is speaking in this dialogue message'),
  content: z.string().describe('The dialogue text content'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Optional metadata attached to the dialogue message'),
  turn: z.number().min(0).describe('The turn/year number when this dialogue occurred'),
});

export type DialogueMessage = z.infer<typeof DialogueMessageSchema>;

export const JournalCategoryEnum = z.enum([
  'event',
  'discovery',
  'relationship',
  'realm',
  'ending',
]);

export type JournalCategory = z.infer<typeof JournalCategoryEnum>;

export const JournalEntrySchema = z.object({
  id: z.string().describe('Unique identifier for the journal entry'),
  sessionId: z.string().describe('The game session ID this entry belongs to'),
  turn: z.number().min(0).describe('The turn/year number this entry records'),
  locationId: z.string().describe('The location ID where the recorded event took place'),
  action: z.string().describe('The action the player took'),
  result: z.string().describe('The outcome or result of the action'),
  evidenceTag: z.boolean().optional().describe('Whether this entry contains evidence relevant to an ending'),
  category: JournalCategoryEnum.describe('The categorical classification of this journal entry'),
});

export type JournalEntry = z.infer<typeof JournalEntrySchema>;