import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { TokenUsage, SafetyResult } from '@variational-infinity/shared';

interface LogLlmCallInput {
  sessionId?: string;
  traceId?: string;
  agentType: string;
  model: string;
  provider: string;
  promptVersion: string;
  promptText?: string;
  outputText?: string;
  latencyMs: number;
  tokenUsage?: TokenUsage;
  safetyResult?: SafetyResult;
  structuredOutputValid: boolean;
  toolsCalled?: string[];
  checkpointId?: string;
}

function computeHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logLlmCall(input: LogLlmCallInput): Promise<void> {
    try {
      const inputHash = input.promptText ? computeHash(input.promptText) : null;
      const outputHash = input.outputText ? computeHash(input.outputText) : null;

      await this.prisma.llmCall.create({
        data: {
          sessionId: input.sessionId,
          traceId: input.traceId ?? crypto.randomUUID(),
          agentType: input.agentType,
          model: input.model,
          provider: input.provider,
          promptVersion: input.promptVersion,
          inputHash,
          outputHash,
          latencyMs: input.latencyMs,
          tokenUsage: input.tokenUsage ?? undefined,
          safetyResult: input.safetyResult ?? undefined,
          structuredOutputValid: input.structuredOutputValid,
          toolsCalled: input.toolsCalled ?? undefined,
          checkpointId: input.checkpointId,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to log LLM call: ${message}`);
      throw new Error(`Failed to persist LLM call audit log: ${message}`);
    }
  }

  async logSafetyEvent(
    sessionId: string,
    eventType: string,
    severity: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.safetyEvent.create({
        data: {
          sessionId,
          eventType,
          severity,
          details: details as object,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to log safety event: ${message}`);
      throw new Error(`Failed to persist safety event: ${message}`);
    }
  }

  async logStateChange(
    sessionId: string,
    changeType: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.journalEntry.create({
        data: {
          sessionId,
          turn: (details.turn as number) ?? (details.newAge as number) ?? 0,
          locationId: (details.locationId as string) ?? null,
          action: changeType,
          result: JSON.stringify(details),
          evidenceTag: false,
          category: 'event',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to persist state change: ${message}`);
      throw error;
    }
    this.logger.log(`State change in session ${sessionId}: ${changeType} - ${JSON.stringify(details)}`);
  }

  async getLlmCalls(sessionId: string) {
    return this.prisma.llmCall.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSafetyEvents(sessionId: string) {
    return this.prisma.safetyEvent.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
  }
}