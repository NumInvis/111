import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z, type ZodType } from 'zod';
import { ProviderRegistryWrapper } from './provider-registry';
import { OpenaiCompatibleProviderWrapper } from './providers/openai-compatible.provider';
import { AuditService } from '../audit/audit.service';
import { PromptRegistryService } from './prompt-registry.service';
import type { LlmCallResult } from '@variational-infinity/ai';
import { createTraceId } from '@variational-infinity/observability';

interface GenerateOptions {
  model?: string;
  temperature?: number;
  seed?: number;
  sessionId?: string;
  agentType?: string;
  promptName?: string;
  maxRetries?: number;
}

interface GenerateWithSchemaResult<T> {
  data: T;
  result: LlmCallResult;
}

@Injectable()
export class LlmService implements OnModuleInit {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly providerRegistryWrapper: ProviderRegistryWrapper,
    private readonly openaiProviderWrapper: OpenaiCompatibleProviderWrapper,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly promptRegistryService: PromptRegistryService,
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

  private isRetryableError(error: Error): boolean {
    const msg = error.message;
    if (msg.includes('status 429') || msg.includes('status 502') || msg.includes('status 503')) return true;
    if (msg.includes('AbortError') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('fetch failed')) return true;
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
      ? this.promptRegistryService.get(options.promptName).version
      : 'unknown';

    const maxRetries = options?.maxRetries ?? 3;
    let lastError: Error | null = null;

    let providerResult: LlmCallResult | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        providerResult = await provider.generate(prompt, model, undefined, {
          temperature: options?.temperature,
          seed: options?.seed,
        });
        break;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;
        if (attempt < maxRetries && this.isRetryableError(error)) {
          const delayMs = 2000 * Math.pow(2, attempt);
          this.logger.warn(`LLM call attempt ${attempt + 1} failed (retryable): ${error.message}. Retrying in ${delayMs}ms...`);
          await this.sleep(delayMs);
          continue;
        }
        this.logger.error(`LLM call attempt ${attempt + 1} failed: ${error.message}`);
        throw error;
      }
    }

    if (!providerResult) {
      throw new Error('No LLM result obtained after retries');
    }

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

      return { data: repaired as T, result: providerResult };
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
        return this.repairObject(parsed, schema);
      } catch {
        return null;
      }
    }

    if (typeof rawData === 'object' && rawData !== null) {
      return this.repairObject(rawData as Record<string, unknown>, schema);
    }

    return null;
  }

  private repairObject(obj: Record<string, unknown>, schema: ZodType): unknown | null {
    const shape = this.extractSchemaShape(schema);
    if (!shape) {
      const result = schema.safeParse(obj);
      return result.success ? result.data : null;
    }

    const repaired: Record<string, unknown> = {};
    for (const [key, fieldSchema] of Object.entries(shape)) {
      if (key in obj) {
        const value = obj[key];
        if (fieldSchema instanceof z.ZodString && typeof value === 'number') {
          repaired[key] = String(value);
        } else if (fieldSchema instanceof z.ZodNumber && typeof value === 'string') {
          const num = Number(value);
          repaired[key] = isNaN(num) ? undefined : num;
        } else if (fieldSchema instanceof z.ZodBoolean && typeof value === 'string') {
          repaired[key] = value === 'true' || value === '1';
        } else if (fieldSchema instanceof z.ZodArray && !Array.isArray(value)) {
          repaired[key] = value == null ? [] : [value];
        } else if (fieldSchema instanceof z.ZodNumber && typeof value === 'number') {
          const min = this.getSchemaMin(fieldSchema);
          const max = this.getSchemaMax(fieldSchema);
          repaired[key] = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, value));
        } else {
          repaired[key] = value;
        }
      } else if (fieldSchema instanceof z.ZodDefault) {
        repaired[key] = (fieldSchema._def as any).defaultValue();
      } else if (fieldSchema instanceof z.ZodOptional) {
        repaired[key] = undefined;
      } else if (fieldSchema instanceof z.ZodArray) {
        repaired[key] = [];
      }
    }

    for (const key of Object.keys(obj)) {
      if (!(key in repaired)) {
        repaired[key] = obj[key];
      }
    }

    const result = schema.safeParse(repaired);
    if (result.success) return result.data;

    const stripped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(repaired)) {
      if (key in shape) {
        stripped[key] = value;
      }
    }

    const stripResult = schema.safeParse(stripped);
    return stripResult.success ? stripResult.data : null;
  }

  private extractSchemaShape(schema: ZodType): Record<string, ZodType> | null {
    if (schema instanceof z.ZodObject) {
      return schema.shape as Record<string, ZodType>;
    }
    const def = schema._def as any;
    if (def.typeName === 'ZodOptional' || def.typeName === 'ZodDefault') {
      return this.extractSchemaShape(def.innerType as ZodType);
    }
    return null;
  }

  private getSchemaMin(schema: z.ZodNumber): number | null {
    const checks = schema._def.checks;
    for (const check of checks) {
      if (check.kind === 'min') return check.value as number;
    }
    return null;
  }

  private getSchemaMax(schema: z.ZodNumber): number | null {
    const checks = schema._def.checks;
    for (const check of checks) {
      if (check.kind === 'max') return check.value as number;
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