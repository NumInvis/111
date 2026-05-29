import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderRegistry } from '@variational-infinity/ai';
import type { LlmProviderAdapter } from '@variational-infinity/ai';

@Injectable()
export class ProviderRegistryWrapper implements OnModuleInit {
  private readonly registry = new ProviderRegistry();
  private readonly logger = new Logger(ProviderRegistryWrapper.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const providerType = this.configService.get<string>('AI_PROVIDER', 'openai-compatible');
    const baseUrl = this.configService.get<string>('AI_BASE_URL');
    const model = this.configService.get<string>('AI_MODEL', 'gpt-4');
    const apiKeyEnv = this.configService.get<string>('AI_API_KEY_ENV', 'AI_API_KEY');

    if (!baseUrl) {
      throw new Error('AI_BASE_URL environment variable is required. No mock/fallback provider is available.');
    }

    this.logger.log(`Registering provider "${providerType}" with baseUrl "${baseUrl}" and model "${model}"`);
  }

  getRegistry(): ProviderRegistry {
    return this.registry;
  }

  registerProvider(name: string, provider: LlmProviderAdapter, config: { type: string; model: string; baseUrl?: string; apiKeyEnv?: string }): void {
    this.registry.register(name, provider, config);
  }

  setActiveProvider(name: string): void {
    this.registry.setActiveProvider(name);
  }

  getActiveProvider(): LlmProviderAdapter {
    return this.registry.getActiveProvider();
  }

  getAllProviderNames(): string[] {
    return this.registry.getAllProviderNames();
  }

  getActiveProviderName(): string {
    return this.registry.getActiveProviderName();
  }

  getActiveProviderConfig() {
    return this.registry.getActiveProviderConfig();
  }
}