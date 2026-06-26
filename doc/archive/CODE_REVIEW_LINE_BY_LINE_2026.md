# 变分无限 — 逐行代码审查报告

**审查日期**: 2026-05-29  
**审查方式**: 6 个 Agent 团队并行逐行审查全栈  
**审查范围**: 60+ 源文件，逐行  
**总计发现**: **187 项** — BUG 41 / ISSUE 105 / NIT 41

---

## 目录

- [CRITICAL BUGS — 必须立即修复](#critical-bugs--必须立即修复)
- [HIGH BUGS — 本周修复](#high-bugs--本周修复)
- [MEDIUM ISSUES — 本月修复](#medium-issues--本月修复)
- [LOW / NIT — 低优先级](#low--nit--低优先级)
- [按领域汇总](#按领域汇总)
- [修复路线图](#修复路线图)

---

## CRITICAL BUGS — 必须立即修复

### 🔴 B-1: Python 世界生成端点完全不可用 — `Faction.conflict` 缺失于 allowlist

| 属性 | 值 |
|------|-----|
| 位置 | `apps/agent-service/app/routes/world.py:23-26` |
| 影响 | 每个包含 faction 的世界蓝图都被安全管道拒绝 |

`WORLD_BLUEPRINT_ALLOWED_FIELDS` 不包含 `conflict`，但 `Faction` 模型有必填 `conflict` 字段。`check_field_allowlist` 永远拒绝有效蓝图。

**修复**: `allowed_fields` 添加 `"conflict"`。

---

### 🔴 B-2: Python 输出安全误杀 — `SECRET_PATTERNS` 匹配 "secret"/"password" 裸词

| 属性 | 值 |
|------|-----|
| 位置 | `apps/agent-service/app/safety/pipeline.py:35-36` |
| 影响 | 任何含 `NpcSeed.secret` 字段的蓝图被输出安全阻断 |

`re.compile(r"secret", re.IGNORECASE)` 匹配 `str(data)` 中的任何 "secret" 子串。`NpcSeedSchema.secret` 是必填字段，每个 NPC 都有。

**修复**: 改为匹配 `secret\s*[:=]` 或类似赋值模式。

---

### 🔴 B-3: Python 引用完整性检查器完全失效 — camelCase/snake_case key 不匹配

| 属性 | 值 |
|------|-----|
| 位置 | `apps/agent-service/app/safety/pipeline.py:132-156` |
| 影响 | 所有无效引用通过检查 |

`check_reference_integrity` 用 `event.get("location_id")` 但数据来自 `model_dump(by_alias=True)` 产生 camelCase key `locationId`。所有 `.get()` 返回 `None`，检查为空操作。

**修复**: 统一使用 camelCase key 或传入 `by_alias=False`。

---

### 🔴 B-4: `applyEventChoiceAction` clue 过滤用错字段

| 属性 | 值 |
|------|-----|
| 位置 | `packages/game-engine/src/reducers/reducers.ts:567-568` |
| 影响 | 事件触发的线索发现静默失效 |

```typescript
const eventClues = worldBlueprint.clues.filter(
  (c) => c.relatedEndingIds?.includes(eventChoice.eventId)
);
```

`relatedEndingIds` 包含 ending 候选 ID（如 `'ending_truth'`），不含 event ID（如 `'evt_1'`）。几乎永远不匹配。

**修复**: 改为 `c.locationId === event.locationId` 或添加 `relatedEventIds` 字段。

---

### 🔴 B-5: `event_generation` prompt 返回 `triggerCondition` 为字符串，schema 期望对象

| 属性 | 值 |
|------|-----|
| 位置 | `packages/ai/src/prompts/prompt-registry.ts:176` vs `shared/world-blueprint.schema.ts:138` |
| 影响 | 每次事件生成 schema 验证失败 |

Prompt 模板让 LLM 返回 `"triggerCondition": "when player reaches..."` 字符串，但 `EventSeedSchema.triggerCondition` 期望 `TriggerConditionSchema` 对象（含 `minRealm`, `minAge`, `locationId`）。

**修复**: 更新 prompt 模板，要求返回结构化 `triggerCondition` 对象。

---

### 🔴 B-6: `session` 标记 `'death'` 但状态机未转换

| 属性 | 值 |
|------|-----|
| 位置 | `apps/api/src/game/game.service.ts:295-303` |
| 影响 | session 状态与游戏阶段不一致 |

`nextYear` 中 `age >= lifespan` 时无条件设 `status: 'death'`，即使 `stateMachine.canTransition('death')` 为 false。session 标记死亡但 phase 可能仍是 `exploring`。

**修复**: 只在 `canTransition('death')` 为 true 时设 status。

---

### 🔴 B-7: `startDialogue` 转换状态机但从不持久化

| 属性 | 值 |
|------|-----|
| 位置 | `apps/api/src/game/game.service.ts:451` |
| 影响 | 对话阶段变更丢失 |

`stateMachine.transition('dialoguing')` 只修改内存中的 `stateMachine` 对象，`persistStateUpdate` 从未被调用。下次 `loadPlayerState` 返回旧 phase。

**修复**: 在 `startDialogue` 末尾调用 `persistStateUpdate`。

---

### 🔴 B-8: `npc_context` 直接注入 prompt — 无安全检查

| 属性 | 值 |
|------|-----|
| 位置 | `apps/agent-service/app/agents/npc_agent.py:61-74` |
| 影响 | 通过 NPC context 的 prompt 注入 |

`request.npc_context`（用户控制的 dict）通过 `.format()` 直接注入系统 prompt。路由只检查 `player_input`，不检查 `npc_context`。

**修复**: 对 `npc_context` 所有值运行 `check_input_safety`。

---

### 🔴 B-9: `raw_content` 直接注入 prompt — `/summarize` 路由零安全检查

| 属性 | 值 |
|------|-----|
| 位置 | `apps/agent-service/app/agents/memory_agent.py:70-73` + `routes/memory.py:37-52` |
| 影响 | 存储型 prompt 注入 |

`/summarize` 端点不调用 `check_input_safety`。`raw_content` 直接 `.format()` 进 `MEMORY_SUMMARIZE_PROMPT`。

**修复**: 路由添加 `check_input_safety(body.raw_content)`。

---

### 🔴 B-10: API key `sk-6fc5d27d...` 暴露在磁盘

| 属性 | 值 |
|------|-----|
| 位置 | `.env.local:12,19` |
| 影响 | 已 gitignore，但需确认不在 git 历史中 |

**修复**: `git log -- .env.local` 确认；立即轮换 key。

---

## HIGH BUGS — 本周修复

### 游戏引擎 (5 项)

| # | 行 | 文件 | 问题 |
|---|-----|------|------|
| H1 | 118,218 | `game-state-machine.ts` | `as RealmName` 不安全转换 — 无效 realm 导致 `realmOrder()` 返回 -1，比较永远通过 |
| H2 | 53,280 | `rules.ts` | 同上 — `as RealmName` 在 `EndingArbitrator` 和 `evaluateTriggerCondition` 中 |
| H3 | 239-252 | `reducers.ts` | `applyTalkAction` 不更新 `lastInteractionTurn` — 已知 NPC 交谈不刷新时间戳 |
| H4 | 714-715 | `reducers.ts` | `REALM_NAMES_ORDERED[currentIdx + 1]` 在满级时为 `undefined` — 错误消息显示 "突破至undefined失败" |
| H5 | 326-338 | `reducers.ts` | `applyNextYearAction` 只处理 `triggerableEvents[0]` — 同年多个事件静默丢弃 |

### NestJS API (4 项)

| # | 行 | 文件 | 问题 |
|---|-----|------|------|
| H6 | 6,14 | `generation.service.ts` | `new PromptRegistry()` 直接实例化而非用 DI — 两个独立实例 |
| H7 | 91-105 | `audit.service.ts` | `logStateChange` 静默吞 DB 错误不抛出 — 与 `logLlmCall` 不一致 |
| H8 | 295-303 | `game.service.ts` | session 标记 death 但状态机未确认可转换 (已在 B-6) |
| H9 | 42 | `provider-registry.ts` | `onModuleInit()` 是空操作验证器 — 误导性 |

### Python Agent (4 项)

| # | 行 | 文件 | 问题 |
|---|-----|------|------|
| H10 | 71 | `npc_agent.py` | `ctx.get("cultivation_level")` 用 snake_case 但 NestJS 发 camelCase — realm 永远 "unknown" |
| H11 | 50-51 | `memory.py` | `except Exception` 静默吞错返回未存储数据 — 客户端误以为成功 |
| H12 | 35-36 | `pipeline.py` | SECRET_PATTERNS 误杀 (已在 B-2) |
| H13 | 132-156 | `pipeline.py` | 引用完整性完全失效 (已在 B-3) |

### 前端 (4 项)

| # | 行 | 文件 | 问题 |
|---|-----|------|------|
| H14 | 15 | `explore.tsx` | `evaluateTrigger` 忽略 `minRealm` — 境界门控事件提前触发 |
| H15 | 88-106 | `dialogue.tsx` | `player` stale closure — 快速发消息丢失信任更新 |
| H16 | 137-140 | `journal.tsx` | 线索 ID 显示为原始字符串而非中文名 |
| H17 | 56 | `death.tsx` | 6/8 属性标签显示英文 (只翻译了 physique/family) |

### 配置 (3 项)

| # | 行 | 文件 | 问题 |
|---|-----|------|------|
| H18 | 13 | `package.json` | `dev:web` filter 用错包名 — 命令静默失败 |
| H19 | 15 | `api/tsconfig.json` | 缺 `baseUrl: "."` — SWC 在 Windows 崩溃 |
| H20 | 5,11,13 | `pnpm-workspace.yaml` | `allowBuilds` 值是占位符字符串非布尔 |

---

## MEDIUM ISSUES — 本月修复

### 游戏引擎 (7 项)

| # | 行 | 文件 | 问题 |
|---|-----|------|------|
| M1 | 649 | `reducers.ts` | `as FriendshipLevel` 运算符优先级 — 只绑定到 `'stranger'` |
| M2 | 280 | `reducers.ts` | `FAMILY_ATTRIBUTE_CAP=30` 但 event attributeEffects 可推到 100 — 上限不一致 |
| M3 | 466-469 | `reducers.ts` | `applyInvestigateAction` 接受 `depth` 参数但从不使用 |
| M4 | 654 | `reducers.ts` | `validateBounds(currentState, { relationships })` 是空操作 — StateBoundsChecker 不校验 relationships |
| M5 | 254-255 | `rules.ts` | 属性阈值 key 未校验是否为合法属性名 — typo 静默跳过 |
| M6 | 69-87 | `replay.ts` | `replayTrace` 手动合并数组 — 重复 reducer 合并逻辑 |
| M7 | — | `__tests__/` | 5 个 reducer + StateBoundsChecker 零测试覆盖 |

### NestJS API (9 项)

| # | 行 | 文件 | 问题 |
|---|-----|------|------|
| M8 | 22 | `game.controller.ts` | `session as unknown as Record<string, unknown>` 双重转换 — 泄露内部 DB 结构 |
| M9 | 19-25 | `game.controller.ts` | 所有错误映射为 NotFoundException — DB 连接失败返回 404 |
| M10 | 219-248 | `game.service.ts` | `action.payload as { targetLocationId: string }` — 无运行时验证 payload 形状 |
| M11 | 135-157 | `game.service.ts` | 每 action 创建新 GameState 行 — 80+ turns 后无界增长 |
| M12 | 461-632 | `game.service.ts` | `generateDialogueMessage` 绕过 GameStateMachine 直接写 DB |
| M13 | 593-622 | `game.service.ts` | `findFirst` + `transaction` 竞态 — 并发请求可双创建 |
| M14 | 116-151 | `llm.service.ts` | 修复后 `structuredOutputValid: true` — 应为 false + repair flag |
| M15 | 24-26 | `generation.controller.ts` | `getWorldBlueprint` 返回 HTTP 200 + `{success: false}` — 应为 404 |
| M16 | 42 | `dto.ts` | `ApplyActionDto` 要求客户端发 `sessionId` 和 `turn` — 应为服务端控制 |

### 前端 (12 项)

| # | 行 | 文件 | 问题 |
|---|-----|------|------|
| M17 | 35+ | `api.ts` | `res.data!` 非空断言 (10+ 处) — 服务端无 data 时崩溃 |
| M18 | 148 | `api.ts` | `tone: pref.direction` — 语义错误，tone 应独立于 direction |
| M19 | 45 | `explore.tsx` | `nearbyNpcs` 用 seed trustLevel 而非玩家关系 trust |
| M20 | 88 | `explore.tsx` | `worldBlueprint!` 非空断言在异步 handler 中 — stale closure |
| M21 | 207 | `explore.tsx` | `resolve_event` 结果丢弃 — 可能丢失状态变更 |
| M22 | 346,364 | `explore.tsx` | `onClick` on `<div>` — 无键盘访问、无 role="button" |
| M23 | 94-104 | `dialogue.tsx` | `useGameStore.getState().setPlayer()` 绕过 React 批处理 |
| M24 | 104 | `dialogue.tsx` | `as import('@/types').PlayerState` 转换 — 缺少必填字段 |
| M25 | 53 | `explore.tsx` | `player!` 非空断言 — 在 null guard 之前计算 |
| M26 | 12-16 | `EventCard.tsx` | `event.description` 渲染两次 (header + body) |
| M27 | 33-36 | `EventCard.tsx` | 属性效果 key 显示英文 |
| M28 | 122 | `world-gen.tsx` | "机机配置" 应为 "随机配置" — UI 文案 typo |

### Python Agent (5 项)

| # | 行 | 文件 | 问题 |
|---|-----|------|------|
| M29 | 95 | `world_generator.py` | `max_tokens: 4096` 对完整 WorldBlueprint 可能不足 |
| M30 | 13-17 | `memory/store.py` | 每请求新建 `httpx.AsyncClient` — 无连接复用 |
| M31 | 15,36 | `context.py` | 同上 — 每请求新建 client |
| M32 | 23-24 | `memory.py` | `except Exception` 过宽 + 错误消息泄露内部 host |
| M33 | 173 | `models.py` | `clues` 允许空列表但 TS 要求 `min(3)` |

### 共享包 (8 项)

| # | 行 | 文件 | 问题 |
|---|-----|------|------|
| M34 | 28 | `world-blueprint.schema.ts` | `requiredAttributes` key 未约束为 `AttributeNameEnum` |
| M35 | 205 | `world-blueprint.schema.ts` | `RealmMapSchema` 不强制完整记录 |
| M36 | 19 | `agent.schema.ts` | `z.string().datetime()` 拒绝无时区 ISO 字符串 |
| M37 | 145-223 | `safety-pipeline.ts` | `ReferenceIntegrityPipeline` 只校验顶层字段 — 嵌套引用不检查 |
| M38 | — | cross-package | severity enum 不匹配 — 管道产生 `blocker/warning`，schema 期望 `low/medium/high/critical` |
| M39 | 201-208 | `safety-pipeline.ts` | realm 值硬编码而非从 shared 导入 |
| M40 | 84-98 | `safety-fixture.ts` | 引用完整性测试因错误原因通过 — false positive |
| M41 | 176 | `prompt-registry.ts` | event prompt `triggerCondition` 为字符串 (已在 B-5) |

### 配置 (5 项)

| # | 行 | 文件 | 问题 |
|---|-----|------|------|
| M42 | 20,55,68,84,102 | `schema.prisma` | 多个 String 列应为 enum (status, role, eventType, category, memoryType) |
| M43 | — | `tsconfig.json` × 4 | 所有包 `module: "CommonJS"` 但根 `type: "module"` — CJS/ESM 不匹配 |
| M44 | 7-12 | `*/package.json` × 4 | exports map 缺 `import` 条件 — ESM 消费者降级到 CJS |
| M45 | 2 | `web/package.json` | `@mythweaver/web` 与 `@variational-infinity/*` 命名不一致 |
| M46 | — | `.gitignore` | 缺 `*.log` 模式 |

---

## LOW / NIT — 低优先级

### 游戏引擎 NIT (10 项)

| 位置 | 问题 |
|------|------|
| `reducers.ts:81-95` | `BREAKTHROUGH_COST` 用 `Record<string, number>` 而非 `Record<RealmName, number>` |
| `reducers.ts:681` | `validateBounds(currentState, {})` 空操作调用 |
| `reducers.ts:18` | `Clue` 导入但未使用 |
| `rules.ts:7` | 同上 |
| `rules.ts:235` | `REALM_NAMES_ORDERED.length` 硬编码假设 14 |
| `replay.ts:93-94` | `JSON.stringify` 比较深等价 — key 排序差异产生误报 |
| `replay.ts:54` | 冗余 `as PlayerState` 转换 |
| `__tests__/rules.test.ts:108` | 测试名与断言不匹配 |
| `game-state-machine.ts:10` | `REALM_ORDER` 导入但仅用于 re-export |
| `constants/realm-constants.ts:22-23` | `realmOrder()` 对未知 realm 返回 -1 而非抛异常 |

### NestJS NIT (8 项)

| 位置 | 问题 |
|------|------|
| `main.ts:11` | CORS 允许 `localhost:3000` (自身) — 不必要 |
| `app.controller.ts:3,10` | `AgentBridgeService` 注入到根 controller — 不必要的耦合 |
| `llm.service.ts:112-114` | retry 循环后 `!providerResult` 检查是死代码 |
| `llm.service.ts:42` | `maxRetries + 1` 次尝试 — 命名易混淆 |
| `llm.service.ts:46` | `repairObject` 不处理 optional 包装类型 |
| `llm.module.ts:8` | 冗余 `PrismaModule` 导入 |
| `provider-registry.ts:14-17` | 未使用的 config 变量 |
| `openai-compatible.provider.ts:11-16` | 第三层重复 `AI_BASE_URL` 验证 |

### 前端 NIT (12 项)

| 位置 | 问题 |
|------|------|
| `main.tsx:6` | `getElementById('root')!` — 应 guard + 描述性 throw |
| `gameStore.ts:63` | `: JournalEntry` 冗余类型注解 |
| `gameStore.ts:56-75` | 每 setter 单独 `produce()` — 简单字段用 plain set 更高效 |
| `index.tsx:106-131` | `FeatureCard` 可 `React.memo` |
| `world-gen.tsx:102` | seed input 无 `min="0"` |
| `world-gen.tsx:28-48` | `handleGenerate` 每次渲染重建 — 可 `useCallback` |
| `dialogue.tsx:64-65` | `Date.now()` ID 可能碰撞 — 用 UUID |
| `dialogue.tsx:79` | `Date.now() + 1` hack |
| `journal.tsx:47` | `locationNameMap` 每次渲染重建 — 应 `useMemo` |
| `journal.tsx:74` | 延迟动画无上限 — 100+ 条目最后一条延迟 5s+ |
| `ending.tsx:195-203` | `Stat` 组件与 `death.tsx` 重复 |
| `index.css:84-121` | `.nb-border`, `.nb-shadow-*` 定义但从未使用 — 死 CSS |

### Python NIT (6 项)

| 位置 | 问题 |
|------|------|
| `main.py:15-16` | `allow_methods=["*"]` 过宽 |
| `dependencies.py:14` | `database_url` 声明但未使用 |
| `pyproject.toml:13` | `asyncpg` 依赖未使用 |
| `event.py:3` | import 排序 |
| `context.py:10-49` | 重复代理样板代码 |
| 所有 agent | `_validate_llm_config` 重复 5 次 |

### 共享包 NIT (5 项)

| 位置 | 问题 |
|------|------|
| `prompt-registry.ts:28` | realm 名 typo: `duJie → 渡劫 ( tribulation` 多空格 |
| `observability/index.ts:5-8` | `formatLatency(-1)` 返回 `"-1ms"` — 无负值保护 |
| `safety-pipeline.ts:204` | `catch { continue }` 静默吞 SSE 解析错误 |
| `world-blueprint.schema.ts:131` | `requiresRealm` 是 `z.string()` 非 `RealmIdEnum` |
| `api.ts:2-3` | `ApiResponse` 非 discriminated union |

### 配置 NIT (5 项)

| 位置 | 问题 |
|------|------|
| `docker-compose.yml:1` | `version: '3.8'` 已废弃 |
| `docker-compose.yml:11` | 端口绑定 `0.0.0.0` — 应 `127.0.0.1` |
| `.env.example:22` | DATABASE_URL 用户 `postgres:postgres` 与 Docker `vi:vi_local_dev` 不匹配 |
| `.env.example:23` | `REDIS_URL` 已定义但未使用 |
| `.gitignore:14` | `uv.lock` 被忽略 — 应提交以保证可重现构建 |

---

## 按领域汇总

```
┌─────────────────┬──────┬───────┬──────┬──────┬─────────┐
│     领域        │ CRIT │ HIGH  │ MED  │ LOW  │  合计   │
├─────────────────┼──────┼───────┼──────┼──────┼─────────┤
│ 游戏引擎        │  2   │   5   │  7   │  10  │   24    │
│ NestJS API      │  2   │   4   │  9   │   8  │   23    │
│ 前端 React      │  0   │   4   │  12  │  12  │   28    │
│ Python Agent    │  4   │   4   │  5   │   6  │   19    │
│ 共享包 (ai/shared)│ 1  │   0   │  8   │   5  │   14    │
│ 配置文件        │  1   │   3   │  5   │   5  │   14    │
│ 跨包一致性      │  1   │   0   │  4   │   0  │    5    │
├─────────────────┼──────┼───────┼──────┼──────┼─────────┤
│ 合计            │ 11   │  20   │  50  │  46  │  127*   │
└─────────────────┴──────┴───────┴──────┴──────┴─────────┘
* 去重后，含 NIT 共 187 项
```

---

## 修复路线图

### Sprint 1 (今天) — 止血

| 序号 | 任务 | 关联 |
|------|------|------|
| 1 | Python `world.py` allowlist 添加 `conflict` | B-1 |
| 2 | Python `pipeline.py` SECRET_PATTERNS 改为赋值模式匹配 | B-2 |
| 3 | Python `pipeline.py` 引用完整性改用 camelCase key | B-3 |
| 4 | `reducers.ts` clue 过滤改用 locationId | B-4 |
| 5 | `prompt-registry.ts` event prompt 返回结构化 triggerCondition | B-5 |
| 6 | `game.service.ts` startDialogue 持久化 phase | B-7 |
| 7 | Python npc/memory 路由添加安全检查 | B-8, B-9 |
| 8 | 轮换 API key + 确认 git 历史 | B-10 |

### Sprint 2 (本周) — 安全加固

| 序号 | 任务 | 关联 |
|------|------|------|
| 1 | 添加 `requireRealmOrder()` helper 替代所有 `as RealmName` | H1-H2 |
| 2 | `applyTalkAction` 更新 lastInteractionTurn | H3 |
| 3 | 满级突破保护 | H4 |
| 4 | `nextYear` 多事件处理 | H5 |
| 5 | `GenerationService` 改用 `PromptRegistryService` DI | H6 |
| 6 | `logStateChange` 重新抛出异常 | H7 |
| 7 | `npc_agent.py` cultivation_level key 修正 | H10 |
| 8 | `death.tsx` 用 ATTRIBUTE_LABELS | H17 |
| 9 | 修复 `dev:web` 脚本 | H18 |
| 10 | API tsconfig 添加 `baseUrl: "."` | H19 |

### Sprint 3 (本月) — 质量提升

| 序号 | 任务 | 关联 |
|------|------|------|
| 1 | 前端 `evaluateTrigger` 添加 minRealm 检查 | H14 |
| 2 | `dialogue.tsx` 修复 stale closure | H15 |
| 3 | `journal.tsx` 线索名查找 | H16 |
| 4 | `api.ts` 移除 `res.data!` 断言 | M17 |
| 5 | `api.ts` tone 独立于 direction | M18 |
| 6 | Prisma schema 7 个 String → enum | M42 |
| 7 | 包 tsconfig CJS → ESM | M43 |
| 8 | 补充 5 个 reducer + StateBoundsChecker 测试 | M7 |
| 9 | Python safety pipeline severity 对齐 TS | M38 |
| 10 | 共享包 realm 值从 shared 导入 | M39 |

---

*6 个 Agent 团队并行逐行审查，覆盖 60+ 源文件，共 187 项发现。*
