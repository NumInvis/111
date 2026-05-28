import type { TokenUsage } from '@variational-infinity/shared';

export interface LlmProviderConfig {
  type: string;
  model: string;
  baseUrl?: string;
  apiKeyEnv?: string;
}

export interface LlmCallResult {
  data: unknown;
  valid: boolean;
  errors?: string[];
  model: string;
  provider: string;
  latencyMs: number;
  tokenUsage?: TokenUsage;
}

export interface LlmProviderAdapter {
  name: string;
  generate(
    prompt: string,
    model: string,
    schema?: Record<string, unknown>,
    options?: { temperature?: number; seed?: number },
  ): Promise<LlmCallResult>;
  generateStream(
    prompt: string,
    model: string,
    options?: { temperature?: number; seed?: number },
  ): AsyncIterable<string>;
  isAvailable(): boolean;
}

export class ProviderRegistry {
  private providers = new Map<string, LlmProviderAdapter>();
  private configs = new Map<string, LlmProviderConfig>();
  private activeProviderName: string | null = null;

  register(name: string, provider: LlmProviderAdapter, config: LlmProviderConfig): void {
    this.providers.set(name, provider);
    this.configs.set(name, config);
  }

  getActiveProvider(): LlmProviderAdapter {
    if (!this.activeProviderName) {
      throw new Error('No active provider set. Call setActiveProvider() first.');
    }
    const provider = this.providers.get(this.activeProviderName);
    if (!provider) {
      throw new Error(`Active provider "${this.activeProviderName}" not found in registry.`);
    }
    return provider;
  }

  setActiveProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider "${name}" not registered. Available: ${this.getAllProviderNames().join(', ')}`);
    }
    this.activeProviderName = name;
  }

  getAllProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  getProvider(name: string): LlmProviderAdapter {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider "${name}" not found in registry.`);
    }
    return provider;
  }

  getConfig(name: string): LlmProviderConfig {
    const config = this.configs.get(name);
    if (!config) {
      throw new Error(`Config for provider "${name}" not found.`);
    }
    return config;
  }

  getActiveProviderConfig(): LlmProviderConfig {
    if (!this.activeProviderName) {
      throw new Error('No active provider set.');
    }
    return this.getConfig(this.activeProviderName);
  }

  getActiveProviderName(): string {
    if (!this.activeProviderName) {
      throw new Error('No active provider set.');
    }
    return this.activeProviderName;
  }
}