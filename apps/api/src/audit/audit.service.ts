import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { TokenUsage, SafetyResult } from '@vi/shared';

interface LogLlmCallInput {
  sessionId?: string;
  traceId?: string;
  agentType: string;
  model: string;
  provider: string;
  promptVersion: string;
  inputHash?: string;
  outputHash?: string;
  latencyMs: number;
  tokenUsage?: TokenUsage;
  safetyResult?: SafetyResult;
  structuredOutputValid: boolean;
  toolsCalled?: string[];
  checkpointId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logLlmCall(input: LogLlmCallInput): Promise<void> {
    try {
      await this.prisma.llmCall.create({
        data: {
          sessionId: input.sessionId,
          traceId: input.traceId ?? crypto.randomUUID(),
          agentType: input.agentType,
          model: input.model,
          provider: input.provider,
          promptVersion: input.promptVersion,
          inputHash: input.inputHash,
          outputHash: input.outputHash,
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
          details,
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
    this.logger.log(`State change in session ${sessionId}: ${changeType} — ${JSON.stringify(details)}`);
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