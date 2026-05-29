import type { LlmProviderAdapter, LlmCallResult, LlmProviderConfig } from './provider-registry';

interface OpenaiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenaiResponse {
  id: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function redactApiKey(text: string, apiKey: string): string {
  if (!apiKey) return text;
  const prefix = apiKey.slice(0, 4);
  const suffix = apiKey.slice(-2);
  const redacted = `${prefix}...${suffix}`;
  return text.replaceAll(apiKey, redacted);
}

export class OpenaiCompatibleProvider implements LlmProviderAdapter {
  name = 'openai-compatible';
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: LlmProviderConfig) {
    const apiKeyEnv = config.apiKeyEnv ?? 'AI_API_KEY';
    this.apiKey = process.env[apiKeyEnv] ?? '';
    this.baseUrl = config.baseUrl ?? process.env.AI_BASE_URL ?? '';
    this.defaultModel = config.model;

    if (!this.baseUrl) {
      throw new Error('OpenAI-compatible provider requires AI_BASE_URL to be configured.');
    }
  }

  isAvailable(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  async generate(
    prompt: string,
    model: string,
    _schema?: Record<string, unknown>,
    options?: { temperature?: number; seed?: number },
  ): Promise<LlmCallResult> {
    const usedModel = model || this.defaultModel;
    const startTime = performance.now();

    const messages: OpenaiMessage[] = [
      { role: 'user', content: prompt },
    ];

    const body: Record<string, unknown> = {
      model: usedModel,
      messages,
      temperature: options?.temperature ?? 0.7,
      seed: options?.seed,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    };

    const url = `${this.baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `LLM API request failed with status ${response.status}: ${redactApiKey(errorText, this.apiKey)}`,
        );
      }

      const json = (await response.json()) as OpenaiResponse;
      const latencyMs = performance.now() - startTime;

      const content = json.choices[0]?.message?.content ?? '';
      let data: unknown;

      try {
        data = JSON.parse(content);
      } catch (parseErr) {
        const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        throw new Error(`Failed to parse LLM JSON output: ${redactApiKey(msg, this.apiKey)}`);
      }

      return {
        data,
        valid: true,
        model: json.model || usedModel,
        provider: this.name,
        latencyMs,
        tokenUsage: json.usage
          ? {
              prompt: json.usage.prompt_tokens,
              completion: json.usage.completion_tokens,
              total: json.usage.total_tokens,
            }
          : undefined,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`OpenAI-compatible provider error: ${redactApiKey(message, this.apiKey)}`);
    }
  }

  /** @internal Not used by any caller. SSE streaming infrastructure for future use. */
  async *generateStream(
    prompt: string,
    model: string,
    options?: { temperature?: number; seed?: number },
  ): AsyncIterable<string> {
    const usedModel = model || this.defaultModel;

    const messages: OpenaiMessage[] = [
      { role: 'user', content: prompt },
    ];

    const body: Record<string, unknown> = {
      model: usedModel,
      messages,
      stream: true,
      temperature: options?.temperature ?? 0.7,
      seed: options?.seed,
      max_tokens: 4096,
    };

    const url = `${this.baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `LLM streaming request failed with status ${response.status}: ${redactApiKey(errorText, this.apiKey)}`,
        );
      }

      if (!response.body) {
        throw new Error('LLM streaming response has no body.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;

            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') return;

            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) yield delta;
            } catch {
              continue;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`OpenAI-compatible streaming error: ${redactApiKey(message, this.apiKey)}`);
    }
  }
}