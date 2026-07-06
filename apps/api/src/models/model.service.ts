import { Injectable, BadRequestException } from '@nestjs/common';
import { AppLogger } from '../logger.module';
import { AIConfigService } from '../config';

export interface ModelInfo {
  id: string;
  owned_by?: string;
}

@Injectable()
export class ModelService {
  constructor(
    private readonly aiConfig: AIConfigService,
    private readonly logger: AppLogger,
  ) {}

  async listModels(): Promise<ModelInfo[]> {
    const cfg = this.aiConfig.getAI();
    if (!cfg.apiBase || !cfg.apiKey) {
      throw new BadRequestException('请先配置 API 地址和 Key');
    }

    const url = `${cfg.apiBase.replace(/\/$/, '')}/models`;
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          'User-Agent': 'variational-infinity/1.0',
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => 'unknown');
        throw new Error(`API ${res.status}: ${text}`);
      }

      const data = (await res.json()) as { data?: ModelInfo[] };
      const raw = data.data || [];
      const skipKw = ['embed', 'moderation', 'dall-e', 'tts', 'whisper', 'audio', 'image', 'video', 'realtime'];

      const models = raw
        .filter((m) => {
          const low = m.id.toLowerCase();
          return !skipKw.some((kw) => low.includes(kw));
        })
        .sort((a, b) => a.id.localeCompare(b.id));

      this.logger.log(`拉取模型列表: ${models.length} 个`, { component: 'Models' });
      return models;
    } catch (err) {
      this.logger.error('拉取模型列表失败', {
        component: 'Models',
        extra: { error: err instanceof Error ? err.message : String(err) },
      });
      throw err;
    }
  }
}
