import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { AppLogger } from './logger.module';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import {
  GameStateSchema,
  GameState,
  WORLD_BOOK,
  WorldPreference,
  WorldPreferenceSchema,
  TurnResponse,
} from '@variational-infinity/shared';
import { applyHardRules } from './rules';

const LLMResponseSchema = z.object({
  narrative: z.string(),
  options: z.array(z.object({
    id: z.string(),
    label: z.string(),
    desc: z.string(),
  })).min(1).max(4),
  state: GameStateSchema,
  status: z.enum(['playing', 'died', 'ended']),
});

const SYSTEM_PROMPT = `你是「变分无限」的游戏主持人——一个数学修仙人生模拟器。玩家逐年成长，在14个境界中修炼，每个境界对应一个数学水平。

## 世界观
${WORLD_BOOK}

## 你的职责
1. 每回合生成当年情境（narrative）——玩家遇到了什么人、事、抉择
2. 提供2-4个选择（options）——每个有真实取舍，没有"显然最优"
3. 返回更新后的完整状态（state）——你是主要的状态管理者
4. 判断状态（status）——playing/died/ended

## 规则（由你在叙事中执行，代码会兜底）
- 属性范围0-100，每年自然增长growth点
- 年龄每年+1，年龄≥寿元则died
- 境界突破：属性达标时可突破，消耗主属性，延长寿元；境界只能前进，不能倒退
- 结局：不要预设触发条件，结局应在叙事自然发展到高潮时由你决定，status设为ended
- 境界越高，情境涉及的数学概念越深奥
- 选项可以是任何事：修炼、探索、社交、冒险、求学——不要局限于固定类型

## 输出格式（只返回JSON）
{
  "narrative": "当年情境叙述",
  "options": [{"id":"1","label":"选项标题","desc":"选项描述"}],
  "state": {完整游戏状态},
  "status": "playing"
}`;

function worldGenPrompt(preference?: WorldPreference): string {
  const parts: string[] = [];
  if (preference?.theme) parts.push(`主题：${preference.theme}`);
  if (preference?.tone) parts.push(`基调：${preference.tone}`);
  if (preference?.scale) parts.push(`规模：${preference.scale}`);
  if (preference?.seed) parts.push(`种子/关键词：${preference.seed}`);
  const preferenceBlock = parts.length > 0 ? `\n\n## 世界偏好\n${parts.join('\n')}` : '';

  return `你是「变分无限」的世界生成器。生成一个数学修仙世界的初始状态。${preferenceBlock}

## 世界观
${WORLD_BOOK}

## 要求
- 世界名、核心冲突、世界规则
- 3-5个属性（含名称、描述、每年自然增长0-3）
- 3-5个地点、3-5个NPC（含性格、目标、秘密）、2-4条线索、2-3个结局候选
- 玩家初始状态：姓名、年龄16、寿元80、炼体境、初始属性10

## 输出格式（只返回JSON）
{
  "player": {
    "name": "行者",
    "age": 16,
    "lifespan": 80,
    "realm": "炼体",
    "location": "起始之地ID",
    "attributes": {"属性名": 10},
    "discovered": [],
    "relationships": {},
    "history": "初入此地"
  },
  "world": {
    "name": "世界名",
    "conflict": "核心冲突",
    "rules": ["规则1","规则2"],
    "attributes": [{"name":"体魄","desc":"肉体强度","growth":2}],
    "locations": [{"id":"loc1","name":"地名","desc":"描述"}],
    "npcs": [{"id":"npc1","name":"名","role":"身份","personality":["严厉"],"goal":"目标","secret":"秘密"}],
    "clues": [{"id":"clue1","name":"名","desc":"描述"}],
    "endings": [{"id":"end1","title":"标题","desc":"描述","evidence":[]}]
  }
}`;
}

@Injectable()
export class GameService {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.baseUrl = this.config.get<string>('AI_BASE_URL', '');
    this.model = this.config.get<string>('AI_MODEL', 'deepseek-v4-flash');
    this.apiKey = this.config.get<string>('AI_API_KEY', '');
    this.timeoutMs = this.config.get<number>('AI_TIMEOUT_MS', 60000);
    if (!this.baseUrl) {
      this.logger.fatal('AI_BASE_URL 未配置，无法启动', { component: 'GameService' });
      throw new Error('AI_BASE_URL is required');
    }
    this.logger.log(`GameService 初始化 model=${this.model} baseUrl=${this.baseUrl}`, { component: 'GameService' });
  }

  private async callLLM(systemPrompt: string, userPrompt: string, sessionId: string, label: string, temperature = 0.9): Promise<string> {
    const traceId = randomUUID();
    const promptLen = systemPrompt.length + userPrompt.length;
    const start = performance.now();

    this.logger.debug(`LLM 请求开始: ${label}`, {
      component: 'LLM',
      sessionId,
      traceId,
      extra: { model: this.model, promptChars: promptLen, temperature },
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latencyMs = performance.now() - start;

      if (!res.ok) {
        const text = await res.text().catch(() => 'unknown');
        this.logger.error(`LLM 请求失败: ${label} status=${res.status}`, {
          component: 'LLM',
          sessionId,
          traceId,
          durationMs: Math.round(latencyMs),
          extra: { status: res.status, error: text.substring(0, 500) },
        });
        throw new Error(`LLM ${res.status}: ${text}`);
      }

      const json = await res.json() as { choices: Array<{ message: { content: string } }> };
      const content = json.choices[0]?.message?.content ?? '';

      this.logger.logLlmCall({
        sessionId,
        traceId,
        model: this.model,
        promptLen,
        responseLen: content.length,
        latencyMs,
        status: 'success',
      });

      return content;
    } catch (err) {
      clearTimeout(timeoutId);
      const latencyMs = performance.now() - start;
      const message = err instanceof Error ? err.message : String(err);

      if (err instanceof Error && err.name === 'AbortError') {
        this.logger.error(`LLM 请求超时: ${label} (${this.timeoutMs}ms)`, {
          component: 'LLM',
          sessionId,
          traceId,
          durationMs: Math.round(latencyMs),
        });
      } else {
        this.logger.error(`LLM 请求异常: ${label} ${message}`, {
          component: 'LLM',
          sessionId,
          traceId,
          durationMs: Math.round(latencyMs),
        });
      }
      throw err;
    }
  }

  private friendshipFromTrust(trust: number): string {
    if (trust >= 0.7) return 'confidant';
    if (trust >= 0.5) return 'friend';
    if (trust >= 0.3) return 'acquaintance';
    return 'stranger';
  }

  private normalizeState(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;
    const obj = data as Record<string, unknown>;
    if (obj.player && typeof obj.player === 'object') {
      const p = obj.player as Record<string, unknown>;
      if (p.relationships && typeof p.relationships === 'object') {
        for (const [k, v] of Object.entries(p.relationships as Record<string, unknown>)) {
          if (typeof v === 'number') {
            (p.relationships as Record<string, unknown>)[k] = { trust: v, level: this.friendshipFromTrust(v) };
          } else if (typeof v === 'string') {
            (p.relationships as Record<string, unknown>)[k] = { trust: 0.3, level: v };
          }
        }
      }
      if (p.discovered && !Array.isArray(p.discovered)) p.discovered = [];
      if (p.attributes && typeof p.attributes === 'object') {
        for (const [k, v] of Object.entries(p.attributes as Record<string, unknown>)) {
          if (typeof v === 'string') (p.attributes as Record<string, unknown>)[k] = parseFloat(v) || 0;
        }
      }
      if (typeof p.age === 'string') p.age = parseInt(p.age, 10) || 16;
      if (typeof p.lifespan === 'string') p.lifespan = parseInt(p.lifespan, 10) || 80;
    }
    return obj;
  }

  private parseJSON<T>(raw: string, schema: z.ZodType<T>, label: string, sessionId: string): T {
    let text = raw.trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.logger.error(`JSON 解析失败: ${label}`, {
        component: 'Parser',
        sessionId,
        extra: { rawPreview: text.substring(0, 300) },
      });
      throw new BadRequestException(`${label}: LLM 返回了无效 JSON`);
    }

    parsed = this.normalizeState(parsed);

    const result = schema.safeParse(parsed);
    if (!result.success) {
      const details = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      this.logger.warn(`Schema 校验失败: ${label}`, {
        component: 'Parser',
        sessionId,
        extra: { issues: result.error.issues.length, details: details.substring(0, 500) },
      });
      throw new BadRequestException(`${label} validation failed: ${details}`);
    }

    this.logger.debug(`Schema 校验通过: ${label}`, { component: 'Parser', sessionId });
    return result.data;
  }

  async createSession(preference?: WorldPreference): Promise<{ id: string; state: GameState }> {
    if (preference) {
      const prefResult = WorldPreferenceSchema.safeParse(preference);
      if (!prefResult.success) {
        throw new BadRequestException('Invalid world preference');
      }
      preference = prefResult.data;
    }

    this.logger.logGameEvent('new', '世界生成开始', { preference });

    const raw = await this.callLLM(SYSTEM_PROMPT, worldGenPrompt(preference), 'new', '世界生成', 0.8);
    const state = this.parseJSON(raw, GameStateSchema, 'World generation', 'new');
    const normalized = applyHardRules(state, state.player.realm);

    this.logger.logGameEvent('new', '世界生成完成', {
      worldName: normalized.world.name,
      playerRealm: normalized.player.realm,
      attributeCount: Object.keys(normalized.player.attributes).length,
      locationCount: normalized.world.locations.length,
      npcCount: normalized.world.npcs.length,
    });

    const session = await this.prisma.session.create({
      data: { status: 'active', state: normalized as object },
    });

    await this.prisma.message.create({
      data: {
        sessionId: session.id,
        role: 'system',
        content: '世界已生成。' + normalized.world.name,
        state: normalized as object,
      },
    });

    this.logger.logGameEvent(session.id, '会话已创建', {
      worldName: normalized.world.name,
      playerName: normalized.player.name,
    });

    return { id: session.id, state: normalized };
  }

  async getSession(id: string): Promise<{ id: string; status: string; state: GameState; messages: Array<{ role: string; content: string }> }> {
    this.logger.debug('获取会话', { component: 'Game', sessionId: id });

    const session = await this.prisma.session.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session) {
      this.logger.warn(`会话不存在: ${id}`, { component: 'Game', sessionId: id });
      throw new NotFoundException(`Session "${id}" not found`);
    }

    this.logger.debug(`会话加载完成: ${session.messages.length} 条消息`, {
      component: 'Game',
      sessionId: id,
      extra: { status: session.status, messageCount: session.messages.length },
    });

    return {
      id: session.id,
      status: session.status,
      state: session.state as GameState,
      messages: session.messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
    };
  }

  async sendAction(id: string, action: string): Promise<TurnResponse> {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 10 } },
    });
    if (!session) {
      this.logger.warn(`会话不存在: ${id}`, { component: 'Game', sessionId: id });
      throw new NotFoundException(`Session "${id}" not found`);
    }
    if (session.status !== 'active') {
      this.logger.warn(`会话已结束: ${id} status=${session.status}`, { component: 'Game', sessionId: id });
      throw new BadRequestException(`Session is ${session.status}`);
    }

    const previousState = session.state as GameState;
    const previousRealm = previousState.player.realm;
    const history = session.messages
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      .join('\n');

    this.logger.logGameEvent(id, '玩家行动', {
      action,
      currentAge: previousState.player.age,
      currentRealm: previousState.player.realm,
    });

    const userPrompt = `当前状态：\n${JSON.stringify(previousState, null, 2)}\n\n近期历史：\n${history}\n\n玩家行动：${action}`;

    const raw = await this.callLLM(SYSTEM_PROMPT, userPrompt, id, '回合推进', 0.9);
    const response = this.parseJSON(raw, LLMResponseSchema, 'Turn response', id);

    const normalizedState = applyHardRules(response.state, previousRealm);
    let status = response.status;
    if (normalizedState.player.age >= normalizedState.player.lifespan) {
      status = 'died';
    }

    const normalizedResponse: TurnResponse = {
      ...response,
      state: normalizedState,
      status,
    };

    await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id },
        data: { state: normalizedResponse.state as object, status: normalizedResponse.status === 'playing' ? 'active' : normalizedResponse.status },
      }),
      this.prisma.message.create({
        data: {
          sessionId: id,
          role: 'player',
          content: action,
        },
      }),
      this.prisma.message.create({
        data: {
          sessionId: id,
          role: 'assistant',
          content: normalizedResponse.narrative,
          state: normalizedResponse.state as object,
        },
      }),
    ]);

    this.logger.logGameEvent(id, '回合完成', {
      action,
      newAge: normalizedResponse.state.player.age,
      newRealm: normalizedResponse.state.player.realm,
      status: normalizedResponse.status,
      optionCount: normalizedResponse.options.length,
      narrativeLen: normalizedResponse.narrative.length,
    });

    if (normalizedResponse.status === 'died') {
      this.logger.logGameEvent(id, '玩家死亡', {
        age: normalizedResponse.state.player.age,
        realm: normalizedResponse.state.player.realm,
      });
    } else if (normalizedResponse.status === 'ended') {
      this.logger.logGameEvent(id, '推演终结', {
        age: normalizedResponse.state.player.age,
        realm: normalizedResponse.state.player.realm,
      });
    }

    return normalizedResponse;
  }
}
