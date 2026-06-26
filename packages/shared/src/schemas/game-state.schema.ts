import { z } from 'zod';
import { REALM_ORDER } from '../constants/world-book';

export const RealmNameEnum = z.enum(REALM_ORDER);

export const RelationshipSchema = z.object({
  trust: z.number().min(0).max(1),
  level: z.string(),
});

export const PlayerStateSchema = z.object({
  name: z.string(),
  age: z.number().int().min(0),
  lifespan: z.number().int().min(1),
  realm: RealmNameEnum,
  location: z.string(),
  attributes: z.record(z.string(), z.number()),
  discovered: z.array(z.string()),
  relationships: z.record(z.string(), RelationshipSchema),
  history: z.string(),
});

export const AttributeSchema = z.object({
  name: z.string(),
  desc: z.string(),
  growth: z.number().min(0).max(5),
});

export const LocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  desc: z.string(),
});

export const NPCSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  personality: z.array(z.string()),
  goal: z.string(),
  secret: z.string(),
});

export const ClueSchema = z.object({
  id: z.string(),
  name: z.string(),
  desc: z.string(),
});

export const EndingSchema = z.object({
  id: z.string(),
  title: z.string(),
  desc: z.string(),
  evidence: z.array(z.string()),
});

export const WorldSchema = z.object({
  name: z.string(),
  conflict: z.string(),
  rules: z.array(z.string()),
  attributes: z.array(AttributeSchema),
  locations: z.array(LocationSchema),
  npcs: z.array(NPCSchema),
  clues: z.array(ClueSchema),
  endings: z.array(EndingSchema),
});

export const GameStateSchema = z.object({
  player: PlayerStateSchema,
  world: WorldSchema,
});

export type Relationship = z.infer<typeof RelationshipSchema>;
export type PlayerState = z.infer<typeof PlayerStateSchema>;
export type Attribute = z.infer<typeof AttributeSchema>;
export type Location = z.infer<typeof LocationSchema>;
export type NPC = z.infer<typeof NPCSchema>;
export type Clue = z.infer<typeof ClueSchema>;
export type Ending = z.infer<typeof EndingSchema>;
export type World = z.infer<typeof WorldSchema>;
export type GameState = z.infer<typeof GameStateSchema>;
export type RealmName = z.infer<typeof RealmNameEnum>;
