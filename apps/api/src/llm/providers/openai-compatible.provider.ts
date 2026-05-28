import { Injectable } from '@nestjs/common';
import { OpenaiCompatibleProvider } from '@vi/ai';
import type { LlmProviderAdapter, LlmProviderConfig } from '@vi/ai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OpenaiCompatibleProviderWrapper {
  private provider: OpenaiCompatibleProvider;

  constructor(private readonly configService: ConfigService) {
    const baseUrl = this.configService.get<string>('AI_BASE_URL');
    const model = this.configService.get<string>('AI_MODEL', 'gpt-4');
    const apiKeyEnv = this.configService.get<string>('AI_API_KEY_ENV', 'AI_API_KEY');

    if (!baseUrl) {
      throw new Error('OpenAI-compatible provider requires AI_BASE_URL to be configured. No fallback available.');
    }

    const config: LlmProviderConfig = {
      type: 'openai-compatible',
      model,
      baseUrl,
      apiKeyEnv,
    };

    this.provider = new OpenaiCompatibleProvider(config);
  }

  getProvider(): LlmProviderAdapter {
    return this.provider;
  }
}