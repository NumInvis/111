import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '../logger.module';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

export interface AIConfig {
  apiBase: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  temperature: number;
}

export interface AppConfig {
  ai: AIConfig;
  port: number;
}

const DEFAULT_CONFIG: AppConfig = {
  ai: {
    apiBase: '',
    apiKey: '',
    model: 'deepseek-v4-flash',
    timeoutMs: 60000,
    temperature: 0.9,
  },
  port: 3000,
};

function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 12) return '***';
  return `${key.slice(0, 8)}***${key.slice(-4)}`;
}

@Injectable()
export class AIConfigService {
  private readonly configPath: string;
  private config: AppConfig;

  constructor(
    private readonly env: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.configPath = join(process.cwd(), 'data', 'config.yaml');
    this.config = this.load();
    this.logger.log('配置服务初始化', {
      component: 'Config',
      extra: {
        path: this.configPath,
        model: this.config.ai.model,
        apiBaseConfigured: !!this.config.ai.apiBase,
        apiKeyConfigured: !!this.config.ai.apiKey,
      },
    });
  }

  private load(): AppConfig {
    const fromEnv: Partial<AIConfig> = {
      apiBase: this.env.get<string>('AI_BASE_URL') || DEFAULT_CONFIG.ai.apiBase,
      apiKey: this.env.get<string>('AI_API_KEY') || DEFAULT_CONFIG.ai.apiKey,
      model: this.env.get<string>('AI_MODEL') || DEFAULT_CONFIG.ai.model,
      timeoutMs: this.env.get<number>('AI_TIMEOUT_MS') || DEFAULT_CONFIG.ai.timeoutMs,
      temperature: this.env.get<number>('AI_TEMPERATURE') || DEFAULT_CONFIG.ai.temperature,
    };

    if (!existsSync(this.configPath)) {
      return {
        ai: { ...DEFAULT_CONFIG.ai, ...fromEnv },
        port: this.env.get<number>('PORT') || DEFAULT_CONFIG.port,
      };
    }

    try {
      const raw = readFileSync(this.configPath, 'utf-8');
      const parsed = yaml.load(raw) as Record<string, unknown> | null || {};
      const ai = (parsed.ai || {}) as Record<string, unknown>;

      return {
        ai: {
          apiBase: (ai.api_base as string) || fromEnv.apiBase || DEFAULT_CONFIG.ai.apiBase,
          apiKey: (ai.api_key as string) || fromEnv.apiKey || DEFAULT_CONFIG.ai.apiKey,
          model: (ai.model as string) || fromEnv.model || DEFAULT_CONFIG.ai.model,
          timeoutMs: Number(ai.timeout_ms) || fromEnv.timeoutMs || DEFAULT_CONFIG.ai.timeoutMs,
          temperature: Number(ai.temperature) || fromEnv.temperature || DEFAULT_CONFIG.ai.temperature,
        },
        port: Number(parsed.port) || this.env.get<number>('PORT') || DEFAULT_CONFIG.port,
      };
    } catch (err) {
      this.logger.error('读取 config.yaml 失败，使用环境变量默认配置', {
        component: 'Config',
        extra: { path: this.configPath, error: err instanceof Error ? err.message : String(err) },
      });
      return {
        ai: { ...DEFAULT_CONFIG.ai, ...fromEnv },
        port: this.env.get<number>('PORT') || DEFAULT_CONFIG.port,
      };
    }
  }

  save(updates: { ai?: Partial<AIConfig>; port?: number }): AppConfig {
    if (updates.ai) {
      const ai = updates.ai;
      this.config = {
        ai: {
          apiBase: ai.apiBase ?? this.config.ai.apiBase,
          apiKey: ai.apiKey ?? this.config.ai.apiKey,
          model: ai.model ?? this.config.ai.model,
          timeoutMs: ai.timeoutMs ?? this.config.ai.timeoutMs,
          temperature: ai.temperature ?? this.config.ai.temperature,
        },
        port: updates.port ?? this.config.port,
      };
    } else if (updates.port !== undefined) {
      this.config.port = updates.port;
    }

    const dir = join(this.configPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const payload = {
      ai: {
        api_base: this.config.ai.apiBase,
        api_key: this.config.ai.apiKey,
        model: this.config.ai.model,
        timeout_ms: this.config.ai.timeoutMs,
        temperature: this.config.ai.temperature,
      },
      port: this.config.port,
    };

    try {
      writeFileSync(this.configPath, yaml.dump(payload, { lineWidth: -1 }), 'utf-8');
      this.logger.log('配置已保存到 YAML', { component: 'Config', extra: { path: this.configPath } });
    } catch (err) {
      this.logger.error('保存 config.yaml 失败', {
        component: 'Config',
        extra: { error: err instanceof Error ? err.message : String(err) },
      });
      throw err;
    }

    return this.config;
  }

  get(): AppConfig {
    return this.config;
  }

  getAI(): AIConfig {
    return this.config.ai;
  }

  toSafeJSON(): Record<string, unknown> {
    return {
      ai: {
        api_base: this.config.ai.apiBase,
        api_key: maskKey(this.config.ai.apiKey),
        model: this.config.ai.model,
        timeout_ms: this.config.ai.timeoutMs,
        temperature: this.config.ai.temperature,
      },
      port: this.config.port,
    };
  }
}
