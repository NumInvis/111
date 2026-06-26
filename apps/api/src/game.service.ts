import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { AppLogger } from './logger.module';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const GameStateSchema = z.object({
  player: z.object({
    name: z.string(),
    age: z.number(),
    lifespan: z.number(),
    realm: z.string(),
    location: z.string(),
    attributes: z.record(z.string(), z.number()),
    discovered: z.array(z.string()),
    relationships: z.record(z.string(), z.object({
      trust: z.number(),
      level: z.string(),
    })),
    history: z.string(),
  }),
  world: z.object({
    name: z.string(),
    conflict: z.string(),
    rules: z.array(z.string()),
    attributes: z.array(z.object({
      name: z.string(),
      desc: z.string(),
      growth: z.number(),
    })),
    locations: z.array(z.object({
      id: z.string(),
      name: z.string(),
      desc: z.string(),
    })),
    npcs: z.array(z.object({
      id: z.string(),
      name: z.string(),
      role: z.string(),
      personality: z.array(z.string()),
      goal: z.string(),
      secret: z.string(),
    })),
    clues: z.array(z.object({
      id: z.string(),
      name: z.string(),
      desc: z.string(),
    })),
    endings: z.array(z.object({
      id: z.string(),
      title: z.string(),
      desc: z.string(),
      evidence: z.array(z.string()),
    })),
  }),
});

type GameState = z.infer<typeof GameStateSchema>;

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

const WORLD_BOOK = `| 境界 | 数学水平 | 叙事地位 |
|------|---------|---------|
| 炼体 | 幼儿园 | 凡人启蒙 |
| 练气 | 小学1-2年级 | 初入修行 |
| 筑基 | 小学3-4年级 | 筑基立本 |
| 本元 | 小学5-6年级 | 探求本元 |
| 通明 | 初一初二 | 渐悟通明 |
| 化神 | 初三 | 中考分流 |
| 归一 | 高一高二 | 融会归一 |
| 渡劫 | 高三 | 高考渡劫 |
| 天门 | 高考/大学入学 | 界壁 |
| 仙境 | 大学低年级 | 初入仙境 |
| 圣境 | 大学高年级 | 专业精进 |
| 变分境 | 研究生 | 变分求极 |
| 天道境 | 数学系博士 | 参悟天道 |
| 无限 | 超越 | 不可触及 |`;

const SYSTEM_PROMPT = `你是「变分无限」的游戏主持人——一个数学修仙人生模拟器。玩家逐年成长，在14个境界中修炼，每个境界对应一个数学水平。

## 世界观
${WORLD_BOOK}

## 你的职责
1. 每回合生成当年情境（narrative）——玩家遇到了什么人、事、抉择
2. 提供2-4个选择（options）——每个有真实取舍，没有"显然最优"
3. 返回更新后的完整状态（state）——你是唯一的状态管理者
4. 判断状态（status）——playing/died/ended

## 规则（由你在叙事中执行）
- 属性范围0-100，每年自然增长growth点
- 年龄每年+1，年龄≥寿元则died
- 境界突破：属性达标时可突破，消耗主属性，延长寿元
- 结局：玩家积累足够证据时可触发结局
- 境界越高，情境涉及的数学概念越深奥
- 选项可以是任何事：修炼、探索、社交、冒险、求学——不要局限于固定类型

## 输出格式（只返回JSON）
{
  "narrative": "当年情境叙述",
  "options": [{"id":"1","label":"选项标题","desc":"选项描述"}],
  "state": {完整游戏状态},
  "status": "playing"
}`;

const WORLD_GEN_PROMPT = `你是「变分无限」的世界生成器。生成一个数学修仙世界的初始状态。

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
    "endings": [{"id":"end1","title":"标题","desc":"描述","evidence":["clue1"]}]
  }
}`;

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

  async createSession(): Promise<{ id: string; state: GameState }> {
    this.logger.logGameEvent('new', '世界生成开始');

    const raw = await this.callLLM(SYSTEM_PROMPT, WORLD_GEN_PROMPT, 'new', '世界生成', 0.8);
    const state = this.parseJSON(raw, GameStateSchema, 'World generation', 'new');

    this.logger.logGameEvent('new', '世界生成完成', {
      worldName: state.world.name,
      playerRealm: state.player.realm,
      attributeCount: Object.keys(state.player.attributes).length,
      locationCount: state.world.locations.length,
      npcCount: state.world.npcs.length,
    });

    const session = await this.prisma.session.create({
      data: { status: 'active', state: state as object },
    });

    await this.prisma.message.create({
      data: {
        sessionId: session.id,
        role: 'system',
        content: '世界已生成。' + state.world.name,
        state: state as object,
      },
    });

    this.logger.logGameEvent(session.id, '会话已创建', {
      worldName: state.world.name,
      playerName: state.player.name,
    });

    return { id: session.id, state };
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

  async sendAction(id: string, action: string): Promise<{ narrative: string; options: Array<{ id: string; label: string; desc: string }>; state: GameState; status: string }> {
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

    const state = session.state as GameState;
    const history = session.messages
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      .join('\n');

    this.logger.logGameEvent(id, '玩家行动', {
      action,
      currentAge: state.player.age,
      currentRealm: state.player.realm,
    });

    const userPrompt = `当前状态：\n${JSON.stringify(state, null, 2)}\n\n近期历史：\n${history}\n\n玩家行动：${action}`;

    const raw = await this.callLLM(SYSTEM_PROMPT, userPrompt, id, '回合推进', 0.9);
    const response = this.parseJSON(raw, LLMResponseSchema, 'Turn response', id);

    await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id },
        data: { state: response.state as object, status: response.status === 'playing' ? 'active' : response.status },
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
          content: response.narrative,
          state: response.state as object,
        },
      }),
    ]);

    this.logger.logGameEvent(id, '回合完成', {
      action,
      newAge: response.state.player.age,
      newRealm: response.state.player.realm,
      status: response.status,
      optionCount: response.options.length,
      narrativeLen: response.narrative.length,
    });

    if (response.status === 'died') {
      this.logger.logGameEvent(id, '玩家死亡', {
        age: response.state.player.age,
        realm: response.state.player.realm,
      });
    } else if (response.status === 'ended') {
      this.logger.logGameEvent(id, '推演终结', {
        age: response.state.player.age,
        realm: response.state.player.realm,
      });
    }

    return response;
  }
}
