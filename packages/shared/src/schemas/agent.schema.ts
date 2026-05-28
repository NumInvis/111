import { z } from 'zod';

export const MemoryTypeEnum = z.enum(['observation', 'reflection', 'plan']);

export type MemoryType = z.infer<typeof MemoryTypeEnum>;

export const MemorySourceEnum = z.enum(['dialogue', 'event', 'reflection']);

export type MemorySource = z.infer<typeof MemorySourceEnum>;

export const MemoryEntrySchema = z.object({
  id: z.string().describe('Unique identifier for the memory entry'),
  npcId: z.string().describe('The NPC ID this memory belongs to'),
  sessionId: z.string().optional().describe('Optional game session ID context for this memory'),
  memoryType: MemoryTypeEnum.describe('The classification of this memory entry'),
  content: z.string().describe('The text content of the memory'),
  importance: z.number().min(0).max(1).describe('How important this memory is to the NPC (0-1)'),
  source: MemorySourceEnum.describe('Where this memory originated from'),
  createdAt: z.string().datetime().describe('Timestamp when this memory was created (ISO 8601)'),
});

export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

export const AgentTypeEnum = z.enum(['world_gen', 'npc', 'event', 'ending', 'memory']);

export type AgentType = z.infer<typeof AgentTypeEnum>;

export const TokenUsageSchema = z.object({
  prompt: z.number().min(0).describe('Number of tokens in the prompt/input'),
  completion: z.number().min(0).describe('Number of tokens in the completion/output'),
  total: z.number().min(0).describe('Total token count for this call'),
});

export type TokenUsage = z.infer<typeof TokenUsageSchema>;

export const SafetyResultSchema = z.object({
  safe: z.boolean().describe('Whether the output passed all safety checks'),
  injectionScore: z.number().min(0).max(1).optional().describe('Optional prompt injection risk score (0-1)'),
  toxicityScore: z.number().min(0).max(1).optional().describe('Optional content toxicity score (0-1)'),
  errors: z.array(z.string()).optional().describe('Optional list of safety check failure descriptions'),
});

export type SafetyResult = z.infer<typeof SafetyResultSchema>;

export const AgentCallLogSchema = z.object({
  traceId: z.string().describe('Unique trace identifier for correlating this call across services'),
  agentId: z.string().describe('Identifier for the specific agent instance that made this call'),
  agentType: AgentTypeEnum.describe('The category of agent that made this LLM call'),
  model: z.string().describe('The LLM model identifier used for this call'),
  provider: z.string().describe('The LLM provider name used for this call'),
  promptVersion: z.string().describe('The version of the prompt template used for this call'),
  inputHash: z.string().optional().describe('Optional hash of the input prompt for deduplication'),
  outputHash: z.string().optional().describe('Optional hash of the output for deduplication'),
  latencyMs: z.number().min(0).describe('Latency of the LLM call in milliseconds'),
  tokenUsage: TokenUsageSchema.optional().describe('Optional token usage statistics for this call'),
  safetyResult: SafetyResultSchema.optional().describe('Optional safety check results for the output'),
  structuredOutputValid: z.boolean().describe('Whether the structured output passed schema validation'),
  toolsCalled: z.array(z.string()).optional().describe('Optional list of tool/function names invoked during this call'),
  checkpointId: z.string().optional().describe('Optional checkpoint ID for durable execution tracking'),
});

export type AgentCallLog = z.infer<typeof AgentCallLogSchema>;

export const SeverityEnum = z.enum(['low', 'medium', 'high', 'critical']);

export type Severity = z.infer<typeof SeverityEnum>;

export const SafetyEventSchema = z.object({
  sessionId: z.string().describe('The game session ID where this safety event occurred'),
  eventType: z.string().describe('The type of safety event (e.g., injection_detected, toxicity_detected)'),
  severity: SeverityEnum.describe('The severity classification of this safety event'),
  details: z.record(z.string(), z.unknown()).describe('Structured details about the safety event'),
});

export type SafetyEvent = z.infer<typeof SafetyEventSchema>;