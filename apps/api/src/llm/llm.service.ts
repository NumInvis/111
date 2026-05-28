import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z, type ZodType } from 'zod';
import { ProviderRegistryWrapper } from './provider-registry';
import { OpenaiCompatibleProviderWrapper } from './providers/openai-compatible.provider';
import { AuditService } from '../audit/audit.service';
import { PromptRegistry } from '@vi/ai';
import type { LlmCallResult } from '@vi/ai';
import { createTraceId } from '@vi/observability';

interface GenerateOptions {
  model?: string;
  temperature?: number;
  seed?: number;
  sessionId?: string;
  agentType?: string;
  promptName?: string;
}

interface GenerateWithSchemaResult<T> {
  data: T;
  result: LlmCallResult;
}

@Injectable()
export class LlmService implements OnModuleInit {
  private readonly logger = new Logger(LlmService.name);
  private readonly promptRegistry = new PromptRegistry();

  constructor(
    private readonly providerRegistryWrapper: ProviderRegistryWrapper,
    private readonly openaiProviderWrapper: OpenaiCompatibleProviderWrapper,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  onModuleInit() {
    const providerType = this.configService.get<string>('AI_PROVIDER', 'openai-compatible');
    const baseUrl = this.configService.get<string>('AI_BASE_URL');
    const model = this.configService.get<string>('AI_MODEL', 'gpt-4');
    const apiKeyEnv = this.configService.get<string>('AI_API_KEY_ENV', 'AI_API_KEY');

    if (!baseUrl) {
      throw new Error('AI_BASE_URL is required. No mock/fallback provider is registered.');
    }

    const provider = this.openaiProviderWrapper.getProvider();

    if (!provider.isAvailable()) {
      throw new Error(`Provider "${providerType}" is not available. Check AI_BASE_URL and API key configuration.`);
    }

    this.providerRegistryWrapper.registerProvider(
      providerType,
      provider,
      { type: providerType, model, baseUrl, apiKeyEnv },
    );
    this.providerRegistryWrapper.setActiveProvider(providerType);
    this.logger.log(`LLM provider "${providerType}" registered and activated`);
  }

  async generateWithSchema<T>(
    prompt: string,
    schema: ZodType<T>,
    options?: GenerateOptions,
  ): Promise<GenerateWithSchemaResult<T>> {
    const traceId = createTraceId();
    const startTime = performance.now();
    const provider = this.providerRegistryWrapper.getActiveProvider();
    const model = options?.model ?? this.providerRegistryWrapper.getActiveProviderConfig().model;
    const promptVersion = options?.promptName
      ? this.promptRegistry.get(options.promptName).version
      : 'unknown';

    const providerResult = await provider.generate(prompt, model, schema, {
      temperature: options?.temperature,
      seed: options?.seed,
    });

    const parseResult = schema.safeParse(providerResult.data);

    if (!parseResult.success) {
      const repaired = this.attemptAutoRepair(providerResult.data, schema);
      if (repaired === null) {
        const errorDetails = parseResult.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        const latencyMs = performance.now() - startTime;

        await this.auditService.logLlmCall({
          sessionId: options?.sessionId,
          traceId,
          agentType: options?.agentType ?? 'unknown',
          model: providerResult.model,
          provider: providerResult.provider,
          promptVersion,
          latencyMs,
          tokenUsage: providerResult.tokenUsage,
          structuredOutputValid: false,
        });

        throw new Error(`Schema validation failed and auto-repair unsuccessful: ${errorDetails}`);
      }

      const latencyMs = performance.now() - startTime;
      await this.auditService.logLlmCall({
        sessionId: options?.sessionId,
        traceId,
        agentType: options?.agentType ?? 'unknown',
        model: providerResult.model,
        provider: providerResult.provider,
        promptVersion,
        latencyMs,
        tokenUsage: providerResult.tokenUsage,
        structuredOutputValid: true,
      });

      return { data: repaired, result: providerResult };
    }

    const latencyMs = performance.now() - startTime;
    await this.auditService.logLlmCall({
      sessionId: options?.sessionId,
      traceId,
      agentType: options?.agentType ?? 'unknown',
      model: providerResult.model,
      provider: providerResult.provider,
      promptVersion,
      latencyMs,
      tokenUsage: providerResult.tokenUsage,
      structuredOutputValid: true,
    });

    return { data: parseResult.data, result: providerResult };
  }

  private attemptAutoRepair(rawData: unknown, schema: ZodType): unknown | null {
    if (typeof rawData === 'string') {
      try {
        const parsed = JSON.parse(rawData);
        const result = schema.safeParse(parsed);
        if (result.success) return result.data;
        return null;
      } catch {
        return null;
      }
    }

    if (typeof rawData === 'object' && rawData !== null) {
      const result = schema.safeParse(rawData);
      if (result.success) return result.data;
      return null;
    }

    return null;
  }

  async *generateStream(
    prompt: string,
    options?: { model?: string; temperature?: number; seed?: number },
  ): AsyncIterable<string> {
    const provider = this.providerRegistryWrapper.getActiveProvider();
    const model = options?.model ?? this.providerRegistryWrapper.getActiveProviderConfig().model;
    yield* provider.generateStream(prompt, model, {
      temperature: options?.temperature,
      seed: options?.seed,
    });
  }

  getProviderInfo(): { active: string; available: string[] } {
    return {
      active: this.providerRegistryWrapper.getActiveProviderName(),
      available: this.providerRegistryWrapper.getAllProviderNames(),
    };
  }
}