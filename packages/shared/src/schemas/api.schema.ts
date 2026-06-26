import { z } from 'zod';
import { GameStateSchema } from './game-state.schema';

export const GameOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  desc: z.string(),
});

export const TurnResponseSchema = z.object({
  narrative: z.string(),
  options: z.array(GameOptionSchema).min(1).max(4),
  state: GameStateSchema,
  status: z.enum(['playing', 'died', 'ended']),
});

export const WorldPreferenceSchema = z.object({
  theme: z.string().optional(),
  tone: z.string().optional(),
  scale: z.enum(['small', 'medium', 'large']).optional(),
  seed: z.string().optional(),
});

export type GameOption = z.infer<typeof GameOptionSchema>;
export type TurnResponse = z.infer<typeof TurnResponseSchema>;
export type WorldPreference = z.infer<typeof WorldPreferenceSchema>;
