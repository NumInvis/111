import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { GameActionSchema } from '@variational-infinity/shared';

const CreateSessionBodySchema = z.object({
  userId: z.string().optional(),
});

const TriggerEndingBodySchema = z.object({
  endingId: z.string().min(1),
});

const StartDialogueBodySchema = z.object({
  npcId: z.string().min(1),
});

const SendDialogueMessageBodySchema = z.object({
  npcId: z.string().min(1),
  message: z.string().min(1),
});

const StoreAgentMemoryBodySchema = z.object({
  npcId: z.string().min(1),
  memoryType: z.string().min(1),
  content: z.string().min(1),
  importance: z.number().min(0).max(1),
  source: z.string().min(1),
});

export class CreateSessionDto extends createZodDto(CreateSessionBodySchema) {}
export class TriggerEndingDto extends createZodDto(TriggerEndingBodySchema) {}
export class StartDialogueDto extends createZodDto(StartDialogueBodySchema) {}
export class SendDialogueMessageDto extends createZodDto(SendDialogueMessageBodySchema) {}
export class ApplyActionDto extends createZodDto(GameActionSchema) {}
export class StoreAgentMemoryDto extends createZodDto(StoreAgentMemoryBodySchema) {}
