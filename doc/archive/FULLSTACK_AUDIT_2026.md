# 变分无限 — 全栈究极审查报告

**审查日期**: 2026-05-29  
**审查范围**: 全仓库 7 个 TS/Python 包 + 13 个 Prisma 模型 + 5 个 AI Agent  
**审查维度**: 架构 / 安全 / 数据库 / API / 游戏引擎 / 前端 / Agent 服务 / LLM 集成 / DevOps / 测试 / 性能  
**总计发现**: **112 项** — CRITICAL 8 / HIGH 27 / MEDIUM 48 / LOW 29

---

## 目录

- [TIER 0 — 立即修复 (CRITICAL)](#tier-0--立即修复-critical)
- [TIER 1 — 本周必须修 (HIGH)](#tier-1--本周必须修-high)
- [TIER 2 — 本月修复 (MEDIUM)](#tier-2--本月修复-medium)
- [TIER 3 — 低优先级 (LOW)](#tier-3--低优先级-low)
- [统计仪表盘](#统计仪表盘)
- [修复优先级路线图](#修复优先级路线图)
- [附录: 各领域详细报告](#附录-各领域详细报告)

---

## TIER 0 — 立即修复 (CRITICAL)

> 任何一项都可导致安全事故或数据损坏，必须今天处理。

### C-1: 真实 API Key 暴露在磁盘

| 属性 | 值 |
|------|-----|
| 位置 | `.env.local:12`, `apps/api/.env:6` |
| 影响 | Dashscope key `sk-6fc5d27d...` 明文存储 |

`.env.local` 已 gitignore，但 `apps/api/.env` **未被 gitignore**。一次 `git add .` 即永久泄露。即使后续删除，key 仍留在 git 历史中。

**修复**: 立即轮换 key；`.gitignore` 添加 `apps/**/.env`；生产环境使用 secrets manager。

---

### C-2: 无 `max_tokens` 限制 — 所有 LLM 调用

| 属性 | 值 |
|------|-----|
| 位置 | `packages/ai/src/providers/openai-compatible.ts:65-71`，所有 Python agent |
| 影响 | LLM 可生成无限长响应 |

`generate()` 和 `generateStream()` 的请求 body 中无 `max_tokens` / `max_completion_tokens`。Python `Agent.run()` 同样缺失。后果：
- Token 费用不可预测
- 超长响应在 50KB 安全检查之前已进入内存
- 某些 provider 对无 max_tokens 请求有不同行为

**修复**: 所有 LLM 调用添加合理的 `max_tokens` (如 4096)。

---

### C-3: `applyEventChoiceAction` 信任客户端 `attributeEffects`

| 属性 | 值 |
|------|-----|
| 位置 | `packages/game-engine/src/reducers/reducers.ts:540-548` |
| 影响 | 恶意客户端可任意修改玩家属性 |

```typescript
// 当前代码 — 直接使用客户端传入的 effects
const effects = eventChoice.attributeEffects;
for (const [attrName, delta] of Object.entries(effects)) {
    updatedAttributes[key] = Math.max(0, Math.min(100, updatedAttributes[key] + delta));
}
```

Reducer 使用客户端 payload 中的 `attributeEffects`，完全忽略世界蓝图中 `option.attributeEffects`（服务端权威数据）。`ActionValidator` 也不校验此字段。

**修复**: 改用 `option.attributeEffects` (从世界蓝图获取)。

---

### C-4: 突破失败可将 lifespan 推为负数

| 属性 | 值 |
|------|-----|
| 位置 | `packages/game-engine/src/reducers/reducers.ts:735-736` |
| 影响 | 违反 StateBoundsChecker 规则，可能导致异常状态 |

```typescript
const lifespanPenalty = 2;
const newLifespan = currentState.lifespan - lifespanPenalty; // 无下界保护
```

当 `lifespan` 为 1 或 2 时，结果为负。对比属性消耗 (line 701) 正确使用了 `Math.max(0, ...)`。

**修复**: `const newLifespan = Math.max(1, currentState.lifespan - lifespanPenalty);`

---

### C-5: Python `full_output_check` 从未被调用

| 属性 | 值 |
|------|-----|
| 位置 | `apps/agent-service/app/routes/world.py:23`, `npc.py:23`, `event.py:25`, `ending.py:23` |
| 影响 | 安全管道形同虚设 |

所有 4 个生成路由只调用 `check_output_safety()`，跳过了：
- `check_field_allowlist` — 额外字段检测
- `check_reference_integrity` — 引用完整性校验
- `check_size_limit` — 大小限制

AGENTS.md 要求 "All AI output must pass `fullOutputCheck()`"，但 Python 侧从未执行。

**修复**: 所有路由改用 `full_output_check(data, allowed_fields=...)`.

---

### C-6: Python 内存存储无持久化

| 属性 | 值 |
|------|-----|
| 位置 | `apps/agent-service/app/routes/memory.py:12` |
| 影响 | 服务重启丢失所有 NPC 记忆 |

`MemoryStore()` 是纯 Python list。`pyproject.toml` 声明了 `asyncpg` 依赖，`.env.example` 定义了 `AGENT_DATABASE_URL`，但**无任何数据库代码存在**。

**修复**: 实现 PostgreSQL 持久化，或至少使用 Redis。

---

### C-7: TS↔Python `NpcDialogueOutput` Schema 不匹配

| 属性 | 值 |
|------|-----|
| 位置 | `game.service.ts:44-53` vs `models.py:199-206` |
| 影响 | Agent Bridge 模式下每次对话验证失败 |

| 字段 | TS 期望 | Python 输出 |
|------|---------|-------------|
| `role` | ✅ 必需 | ❌ 缺失 |
| `content` | ✅ 必需 | ✅ 存在 |
| `metadata.emotion` | ✅ 嵌套在 metadata | ❌ 平铺为顶层 `emotion` |
| `metadata.trustChange` | ✅ 嵌套在 metadata | ❌ 平铺为顶层 `trust_change` |
| `suggested_follow_up` | ❌ 不期望 | ✅ 多余字段 |
| `memory_reference` | ❌ 不期望 | ✅ 多余字段 |

**修复**: 统一 schema — Python 输出嵌套在 `metadata` 下，添加 `role` 字段。

---

### C-8: Prompt 模板变量注入

| 属性 | 值 |
|------|-----|
| 位置 | `packages/ai/src/prompts/prompt-registry.ts:334-345` |
| 影响 | 用户可通过模板语法注入指令 |

```typescript
// render() 方法 — 直接替换，无转义
result = result.replaceAll(`{{${key}}}`, String(value));
```

用户输入 `}} Ignore all previous instructions {{` 可破坏模板结构。虽然 `InputSafetyPipeline` 会检查渲染后的 prompt，但阈值 0.8 不够可靠。

**修复**: 对变量值做 delimiter 转义（如 `{{` → `\{\{`），或使用结构化注入（JSON message 而非字符串拼接）。

---

## TIER 1 — 本周必须修 (HIGH)

### 安全 (6 项)

| # | 问题 | 位置 | 修复 |
|---|------|------|------|
| H1 | 无任何认证/鉴权 — 所有路由裸奔 | 全部 Controller | 实现 JWT 或 API key guard |
| H2 | 无速率限制 — 可无限触发 LLM | `main.ts` (缺失) | 安装 `@nestjs/throttler` |
| H3 | 无 Helmet 安全头 | `main.ts` (缺失) | `app.use(helmet())` |
| H4 | SESSION_SECRET = `change-me` | `.env.local:24` | 生成随机 64 字节 secret |
| H5 | `apps/api/.env` 未在 `.gitignore` | `.gitignore` | 添加 `apps/**/.env` |
| H6 | Python `npc_agent.py` 用 `str.format()` — prompt 注入 | `npc_agent.py:63-74` | 改用 `Template.substitute()` 或安全模板 |

### 数据库 (4 项)

| # | 问题 | 位置 | 修复 |
|---|------|------|------|
| H7 | 8 个 FK 列无索引 — 全表扫描 | `schema.prisma` | 添加 `@@index` |
| H8 | `loadSession` 重复调用 3 次/action | `game.service.ts:178-241` | 单次加载，传递结果 |
| H9 | 无乐观锁 — 并发 action 竞态 | `game.service.ts:116-151` | 添加 `version Int @default(0) @updatedAt` |
| H10 | 多步写操作不在事务中 | `generation.service.ts:78-132` | 包装 `$transaction` |

**H7 详细 — 缺失索引清单**:

```prisma
model GameState       { ... @@index([sessionId, turn]) }
model DialogueMessage { ... @@index([sessionId, npcId, turn]) }
model WorldEvent      { ... @@index([sessionId, turn]) }
model JournalEntry    { ... @@index([sessionId, turn]) }
model AgentMemory     { ... @@index([sessionId, npcId]) }
model LlmCall         { ... @@index([sessionId]) }
model SafetyEvent     { ... @@index([sessionId]) }
model GameTrace       { ... @@index([sessionId, turn]) }
```

**H8 详细 — 冗余查询分析**:

| 方法 | `loadSession` 调用次数 | 通过 `loadWorldBlueprint` | 通过 `loadPlayerState` | 总计 |
|------|----------------------|--------------------------|----------------------|------|
| `applyAction` | 1 | 1 | 1 | **3** |
| `nextYear` | 1 | 1 | 1 | **3** |
| `triggerEnding` | 1 | 1 | 1 | **3** |
| `startDialogue` | 1 | 1 | 1 | **3** |
| `generateDialogueMessage` | 1 | 1 | 1 | **3** |

### 游戏引擎 (4 项)

| # | 问题 | 位置 | 修复 |
|---|------|------|------|
| H11 | `StateBoundsChecker` 从未被调用 | `rules.ts:188-223` | 在 reducer 中调用或移除 |
| H12 | realm 增长检查用旧属性 | `reducers.ts:274-278` | 改用 `updatedAttributes` |
| H13 | `death` 转换不可达 | `game-state-machine.ts:100-106` | 在 `nextYear` 中触发或移除 |
| H14 | `GameStateMachine` 零测试 | `__tests__/` | 补充测试 |

### API (5 项)

| # | 问题 | 位置 | 修复 |
|---|------|------|------|
| H15 | `generateWorld` 零错误处理 | `generation.controller.ts:10-17` | 添加 try/catch |
| H16 | 两种错误响应格式 | `generation.controller.ts:25` vs `game.controller.ts` | 统一为 NestJS exception |
| H17 | 无全局异常过滤器 | `main.ts` | `app.useGlobalFilters(new AllExceptionsFilter())` |
| H18 | `logStateChange` 静默吞 DB 错误 | `audit.service.ts:102-106` | 重新抛出异常 |
| H19 | `generateDialogueMessage` 160 行神方法 | `game.service.ts:416-576` | 拆分为 3-4 个方法 |

### 前端 (4 项)

| # | 问题 | 位置 | 修复 |
|---|------|------|------|
| H20 | 零 ErrorBoundary — 白屏 | 全部路由 | 添加根级 `<ErrorBoundary>` |
| H21 | 异步 handler 竞态 + stale closure | `explore.tsx:53,88` | 消除 `!` 断言，添加 AbortController |
| H22 | 零无障碍属性 | 全部组件 | 添加 aria/role/label |
| H23 | 3 处 `catch {}` 静默吞错误 | `explore.tsx:103,231` | 至少 `console.error` |

### AI/LLM (4 项)

| # | 问题 | 位置 | 修复 |
|---|------|------|------|
| H24 | Python 无重试机制 | 所有 agent | 添加 httpx 重试或 tenacity |
| H25 | Python 输入安全不完整 | 4 个路由 | 检查所有输入字段 |
| H26 | 无成本追踪/预算限制 | 全栈 | 实现 token 聚合 + 阈值告警 |
| H27 | 无 API key 热轮换 | `openai-compatible.ts:38` | 支持 env 重新读取 |

---

## TIER 2 — 本月修复 (MEDIUM)

### 架构 (5 项)

| # | 问题 | 位置 |
|---|------|------|
| M1 | 三处类型重复 (shared Zod / web TS / agent Pydantic) | `shared/src/schemas/`, `web/src/types/`, `agent-service/app/schemas/` |
| M2 | `GenerationService` 直接 `new PromptRegistry()` 而非用 DI | `generation.service.ts:14` |
| M3 | `AgentBridgeModule` 在 `GenerationModule` 中导入但未使用 | `generation.module.ts:8` |
| M4 | Observability 包几乎死代码 — 仅 `createTraceId` 被使用 | `packages/observability/` |
| M5 | 测试 harness 函数从生产 barrel 导出 | `packages/ai/src/index.ts`, `packages/game-engine/src/index.ts` |

### 数据库 (4 项)

| # | 问题 | 位置 |
|---|------|------|
| M6 | 字符串列应为 enum (`status`, `role`, `severity`) | `schema.prisma` |
| M7 | `GameTrace` 每行 3 个大 JSON blob — 存储膨胀 | `schema.prisma:146-157` |
| M8 | `loadSession` 总是 include 大 JSON 关联 | `game.service.ts:91-97` |
| M9 | 列表查询无 `take` 限制 | `game.service.ts:655,695` |

### API (6 项)

| # | 问题 | 位置 |
|---|------|------|
| M10 | 无 UUID 格式校验 | 全部 `@Param('id')` |
| M11 | 15+ 处 `as` 类型断言 | `game.service.ts` 全文 |
| M12 | 错误消息泄露内部细节 | `game.controller.ts:37`, `generation.service.ts:130` |
| M13 | 无 HTTP 请求日志中间件 | `main.ts` (缺失) |
| M14 | 无 Swagger/OpenAPI 文档 | 全部 Controller |
| M15 | `POST /sessions` 返回 200 而非 201 | `game.controller.ts:15` |

### 游戏引擎 (4 项)

| # | 问题 | 位置 |
|---|------|------|
| M16 | `event_choice` 在 `exploring` 阶段可用 | `game-state-machine.ts:66` |
| M17 | `next_year` 总是转到 `event` 即使无事件 | `game-state-machine.ts:48-52` |
| M18 | `ActionValidator` 不检查当前阶段 | `rules.ts:74-185` |
| M19 | 4 个 reducer 零测试覆盖 | `__tests__/reducers.test.ts` |

### 前端 (5 项)

| # | 问题 | 位置 |
|---|------|------|
| M20 | 无 Suspense/code splitting | `routeTree.gen.ts` — 全静态导入 |
| M21 | 无 AbortController | `api.ts`, 全部 `useEffect` |
| M22 | `explore.tsx` 460 行单体组件 | `explore.tsx` |
| M23 | 零 `useMemo`/`useCallback`/`React.memo` | 全部组件 |
| M24 | 死依赖 (`react-hook-form`, `zod`, `@radix-ui/react-dialog`) | `package.json` |

### Python Agent Service (5 项)

| # | 问题 | 位置 |
|---|------|------|
| M25 | `_validate_llm_config` 重复 5 次 | 5 个 agent 文件 |
| M26 | `Settings` 不通过 `Depends()` 注入 | 所有路由 |
| M27 | `httpx.AsyncClient` 每请求新建 | `context.py:15,36` |
| M28 | 多处 schema 枚举类型缺失 | `models.py` — `risk_level`, `memory_type`, `source` 等用 `str` |
| M29 | `raw_content` 作为 URL query 参数 | `agent-bridge.service.ts:91` |

### AI/LLM (5 项)

| # | 问题 | 位置 |
|---|------|------|
| M30 | 重试无 jitter — thundering herd | `llm.service.ts:102` |
| M31 | 流式无 chunk-level 超时 | `openai-compatible.ts:184` |
| M32 | 只有 `user` role，无 `system` role | `openai-compatible.ts:61-63` |
| M33 | API key redaction 泄露 30% | `openai-compatible.ts:23-29` |
| M34 | 存储型 prompt 注入 (NPC memory) | `game.service.ts:447-449` |

---

## TIER 3 — 低优先级 (LOW)

| # | 问题 | 位置 |
|---|------|------|
| L1 | `pnpm dev:web` 脚本错误 — filter 用错包名 | `package.json:13` |
| L2 | `REALM_ORDER` / `REALM_NAMES_ORDERED` 重复导出 3 处 | `constants/`, `state-machine/`, `rules/` |
| L3 | `applyRealmAdvancement` 导出但从未使用 | `reducers.ts:765-805` |
| L4 | `turn` 字段在 GameStateSnapshot 中从未更新 | `game-state-machine.ts:22` |
| L5 | Death 页面属性标签硬编码 (仅 2/8 有中文) | `death.tsx:56` |
| L6 | ProgressBar 硬编码 50% | `world-gen.tsx:66` |
| L7 | Python 无结构化日志 | 全部 Python 文件 |
| L8 | CORS 无生产配置 (硬编码 localhost) | `main.py:13` |
| L9 | `User` 关联缺 `onDelete: Cascade` | `schema.prisma:14-15` |
| L10 | 连接池未配置 | `prisma.service.ts` |
| L11 | `AgentMemory.sessionId` 可空但总被填充 | `schema.prisma:104` |
| L12 | `as FriendshipLevel` 运算符优先级问题 | `reducers.ts:630` |
| L13 | `ending_candidate` 若有 trivial ending 则永久可用 | `game-state-machine.ts:76-78` |
| L14 | `GameActionSchema.sessionId` 在 API 边界冗余 | `game-state.schema.ts:68-73` |
| L15 | Python `import re` 未使用 | `schemas/models.py:3` |
| L16 | Python Agent 未认证 | `main.py` — 无 auth middleware |
| L17 | `Agent` 每请求重新实例化 | 5 个 agent 文件 |
| L18 | Python `check_size_limit` 返回 `safe=True` (应为 blocker) | `pipeline.py:172-177` |
| L19 | Python 缺中文注入模式 (TS 有 5 个中文模式) | `pipeline.py:17-31` |
| L20 | 引用完整性仅检查顶层字段 | `safety-pipeline.ts:145-223` |
| L21 | Prompt 版本追踪但未强制 | `prompt-registry.ts:313-353` |
| L22 | 流式 `generateStream` 无重试 | `llm.service.ts:273-283` |
| L23 | `getSession` 返回原始 Prisma 对象可能泄露内部数据 | `game.controller.ts:19` |
| L24 | `breakthrough` 缺 `'炼体'` 的 BREAKTHROUGH_COST 条目 | `reducers.ts:74-88` |
| L25 | `as object` 类型断言绕过 Prisma JsonValue 检查 (11 处) | `game.service.ts` 全文 |
| L26 | 世界蓝图 JSON 无 DB 级大小约束 | `schema.prisma` — 7 个 Json 列 |
| L27 | `routeTree.gen.ts` 有 7 个 `as any` (自动生成代码) | `routeTree.gen.ts` |
| L28 | `AccumulatedTrustChange` useState 声明顺序不佳 | `dialogue.tsx:121` |
| L29 | `pnpm-workspace.yaml` allowBuilds 有非布尔占位符 | `pnpm-workspace.yaml:5,11,13` |

---

## 统计仪表盘

```
┌─────────────────────────────────────────────────────────────┐
│                    全栈审查统计                               │
├─────────────────────────────────────────────────────────────┤
│  总发现          112 项                                      │
│  ┌──────────┬──────┬──────┬──────┬──────┐                   │
│  │ Severity │ CRIT │ HIGH │ MED  │ LOW  │                   │
│  │ Count    │   8  │  27  │  48  │  29  │                   │
│  └──────────┴──────┴──────┴──────┴──────┘                   │
│                                                             │
│  按领域分布:                                                 │
│  安全 ........... 12    游戏引擎 ........ 11                  │
│  数据库 ........ 10     API 设计 ........ 14                  │
│  前端 ........... 12    Python Agent .... 13                  │
│  AI/LLM ........ 12     架构 ............ 8                   │
│  DevOps ........  3     测试覆盖 ........ 6                   │
│  性能 ........... 6     其他 ............ 5                   │
│                                                             │
│  关键指标:                                                   │
│  认证/鉴权       ❌ 完全缺失                                  │
│  速率限制        ❌ 完全缺失                                  │
│  全局异常过滤    ❌ 缺失                                      │
│  DB 索引         ❌ 8 个 FK 无索引                            │
│  事务覆盖        ⚠️  仅 1 处 $transaction                    │
│  测试覆盖        ⚠️  game-engine 有 2 文件, 其余 0           │
│  安全头 (Helmet) ❌ 缺失                                     │
│  API 文档        ❌ 无 Swagger                               │
│  Schema 一致性   ❌ 三处独立维护                              │
│  ErrorBoundary   ❌ 零个                                      │
│  无障碍 (a11y)   ❌ 零 aria/role                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 修复优先级路线图

### Sprint 1 (本周) — 止血

| 序号 | 任务 | 工作量 | 关联发现 |
|------|------|--------|----------|
| 1 | 轮换 API key + `.gitignore` 补全 | 0.5h | C-1, H5 |
| 2 | Prisma schema 添加 `@@index` (8 个表) | 1h | H7 |
| 3 | 修复 `applyEventChoiceAction` 用服务端 option | 0.5h | C-3 |
| 4 | 修复 lifespan 负数 bug | 5min | C-4 |
| 5 | Python 路由改用 `full_output_check` | 1h | C-5 |
| 6 | 添加 `ParseUUIDPipe` | 1h | M10 |
| 7 | 添加全局异常过滤器 | 1h | H17 |
| 8 | 添加 Helmet | 0.5h | H3 |
| 9 | 所有 LLM 调用添加 `max_tokens` | 1h | C-2 |

### Sprint 2 (下周) — 安全加固

| 序号 | 任务 | 工作量 | 关联发现 |
|------|------|--------|----------|
| 1 | 实现 API key guard 或 JWT 认证 | 4h | H1 |
| 2 | 添加 `@nestjs/throttler` 速率限制 | 2h | H2 |
| 3 | 统一 TS↔Python schema | 4h | C-7, M1 |
| 4 | Python agent 添加重试 + 完整输入安全 | 3h | H24, H25 |
| 5 | 修复 `logStateChange` 静默吞错 | 0.5h | H18 |
| 6 | `loadSession` 重构为单次加载 | 2h | H8 |
| 7 | 多步写操作包装 `$transaction` | 2h | H10 |

### Sprint 3 (本月) — 质量提升

| 序号 | 任务 | 工作量 | 关联发现 |
|------|------|--------|----------|
| 1 | 添加 ErrorBoundary + Suspense | 2h | H20, M20 |
| 2 | 拆分 `GameService` 为多个服务 | 4h | H19 |
| 3 | 补充游戏引擎测试 | 4h | H14, M19 |
| 4 | 前端 `explore.tsx` 拆分 | 3h | M22 |
| 5 | 添加无障碍属性 | 3h | H22 |
| 6 | Python `MemoryStore` 持久化 | 3h | C-6 |
| 7 | 修复 prompt 模板注入 | 2h | C-8 |
| 8 | 统一错误响应格式 | 2h | H16 |

---

## 附录: 各领域详细报告

### A. 架构与依赖图

**依赖 DAG (零循环)**:

```
Layer 0 (leaf):    observability, shared
Layer 1 (mid):     ai, game-engine        (both depend only on shared)
Layer 2 (app):     api                     (depends on all Layer 0+1)
                   web                     (standalone, no workspace deps)
                   agent-service (Python)  (standalone)
```

**正面发现**:
- 零循环依赖
- 零 dist/ 导入
- 零包边界违反
- 所有跨包引用使用 workspace specifier

**负面发现**:
- `GenerationModule` 导入 `AgentBridgeModule` 但未使用 (dead import)
- `@variational-infinity/ai` 和 `@variational-infinity/game-engine` 导出测试 harness 函数
- `@variational-infinity/observability` 仅 `createTraceId` 被使用，其余 3 个函数死代码

---

### B. 安全审计

**正面发现**:
- Prisma ORM 全程使用参数化查询 — 零 SQL 注入风险
- 全局 `ZodValidationPipe` 验证所有 DTO
- 零 `eval()`/`exec()`/动态代码执行
- API key 在错误消息中已脱敏
- Agent Bridge 无 SSRF 风险 (URL 来自服务端配置)
- 所有 LLM 输入/输出都有安全检查

**负面发现 — 缺失安全控制**:

| 控制 | 状态 | 位置 |
|------|------|------|
| 认证 (JWT/API Key) | ❌ 缺失 | 全部 Controller |
| 鉴权 (session ownership) | ❌ 缺失 | `game.service.ts` |
| 速率限制 | ❌ 缺失 | `main.ts` |
| Helmet (安全头) | ❌ 缺失 | `main.ts` |
| CSRF 保护 | ❌ 缺失 | `main.ts` |
| 输入长度限制 | ❌ 缺失 | `dto.ts` (无 `.max()`) |
| UUID 参数校验 | ❌ 缺失 | 全部 `@Param('id')` |
| 请求 body 大小限制 | ⚠️  部分 | NestJS 默认 100KB |
| 错误脱敏 | ❌ 缺失 | Controller 直接转发原始错误 |
| 安全日志/告警 | ⚠️  部分 | AuditService 存在但无告警 |
| CSP | ❌ 缺失 | 无前端 CSP header |
| API 版本化 | ❌ 缺失 | `/api/` 无版本段 |

---

### C. 数据库与 Prisma

**索引缺失清单**:

| 表 | 查询列 | 查询位置 |
|----|--------|----------|
| `GameState` | `sessionId`, `turn` | `game.service.ts:95` |
| `DialogueMessage` | `sessionId`, `npcId` | `game.service.ts:441` |
| `WorldEvent` | `sessionId` | loadSession include |
| `JournalEntry` | `sessionId` | loadSession include |
| `AgentMemory` | `sessionId`, `npcId` | `game.service.ts:441,655` |
| `LlmCall` | `sessionId` | `audit.service.ts:110` |
| `SafetyEvent` | `sessionId` | `audit.service.ts:117` |
| `GameTrace` | `sessionId`, `turn` | `game.service.ts:695` |

**竞态条件**: `applyAction` 先 READ session 状态，CHECK active，再 WRITE — 无 `SELECT FOR UPDATE` 或乐观锁。两个并发 action 可同时通过检查。

**N+1 模式**: `syncJournalToAgentMemory` 对 N 个 NPC 顺序执行 HTTP 调用 + DB 插入，应并行化。

**非事务写操作对**:
- `dialogueMessage.create` + `gameState.create` (`game.service.ts:530+567`)
- `persistStateUpdate` (事务) + `recordGameTrace` (非事务)
- `worldBlueprint.create` + `gameState.create` (`generation.service.ts:79+118`)

---

### D. NestJS API 模式

**错误处理问题**:
- `generateWorld` 零 try/catch — 任何异常 → 500
- `getWorldBlueprint` 返回 HTTP 200 + `{success: false}` (应为 4xx)
- `GenerationService` 抛 `new Error()` 而非 `HttpException` → 500
- Controller catch 块吞掉原始错误上下文

**God Method**: `generateDialogueMessage` 160 行，执行 17 个操作 — 需拆分。

**DI 问题**: `GenerationService` 直接 `new PromptRegistry()` 而非注入 `PromptRegistryService`。

---

### E. 游戏引擎

**状态机问题**:
- `event_choice` 在 `exploring` 阶段可用 (应仅在 `event` 阶段)
- `death` 转换不可达 — 无代码调用 `transition('death')`
- `next_year` 总是转到 `event`，即使无事件触发
- `turn` 字段在 snapshot 中从未更新

**Reducer Bug**:
- `applyEventChoiceAction` 信任客户端 `attributeEffects` (C-3)
- 突破失败 lifespan 可为负 (C-4)
- realm 增长检查用旧属性 (H12)
- `StateBoundsChecker` 从未被调用 (H11)

**测试覆盖**:
- `GameStateMachine`: 0 测试
- `StateBoundsChecker`: 0 测试
- `applyInvestigateAction`: 0 测试
- `applyEventChoiceAction`: 0 测试
- `applyEndDialogueAction`: 0 测试
- `applyResolveEventAction`: 0 测试

---

### F. 前端 React

**组件问题**:
- `explore.tsx` 460 行单体 — 10+ state, 9 个 async handler, 零 memo
- 零 `useMemo`/`useCallback`/`React.memo` — 每次 state 变更重渲染全部
- `hooks/` 目录存在但为空 — 所有逻辑内联在路由组件中

**API 客户端**:
- `fetchApi` 无 AbortSignal 支持 — 请求无法取消
- 无请求超时 — `fetch()` 无限挂起
- `res.data!` 非空断言 (10+ 处) — API 无 data 时崩溃

**死依赖**: `react-hook-form`, `zod`, `@radix-ui/react-dialog` 已安装但从未导入。

---

### G. Python Agent Service

**安全管道不完整**:
- `full_output_check` 从未调用 — 只用 `check_output_safety`
- `check_reference_integrity` 从未调用
- `check_field_allowlist` 从未传入真实 allowlist
- 缺中文注入模式 (TS 有 5 个)
- `check_size_limit` 返回 `safe=True` (应为 blocker)

**Prompt 注入风险**:
- `npc_agent.py` 用 `str.format()` — NPC context 未转义
- `memory_agent.py` 用 `str.format()` — `raw_content` 直接注入 prompt
- `memory` 路由无输入安全检查

**基础设施缺失**:
- 零测试文件
- 零结构化日志
- 零认证 middleware
- `asyncpg` 依赖未使用
- `MemoryStore` 纯内存

---

### H. AI/LLM 集成

**Provider**:
- 仅 `openai-compatible` — 零 fallback
- API key 构造时读取一次，不支持热轮换
- 30s 超时对复杂世界生成可能过短
- 流式 60s 超时仅覆盖连接，不覆盖 chunk

**重试逻辑**:
- 指数退避无 jitter → thundering herd
- 429 不读 `Retry-After` header
- Python 无任何重试
- `generateStream()` 无重试

**Prompt 注入**:
- `PromptRegistry.render()` 用 `replaceAll` 无转义
- 用户控制变量直接注入模板
- NPC memory 存储型注入 (LLM 输出 → DB → 下次 prompt)

**安全管道差异**:
- Python `check_size_limit` 返回 `safe=True` (TS 返回 `false`)
- Python 缺 5 个中文注入模式
- 引用完整性仅检查顶层字段

---

*报告由 8 个并行审查 Agent 生成，覆盖 112 个源文件。*
