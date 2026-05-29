# 变分无限 (Variational Infinity) — 三巨头联合评审文档

> **评审日期**: 2026-05-28
> **评审方式**: 三方独立深度审计 + 交叉质疑多轮辩论
> **评审官**: 🏗️ 字节AI全栈Hermeness架构师 | 🎮 腾讯AI全栈游戏主策划 | 🤖 阿里Agent架构师
> **评审范围**: 全项目 88+ 源码文件，每一行代码、每一个逻辑链路

---

## 目录

- [一、项目架构拓扑全景](#一项目架构拓扑全景)
- [二、🔴 阻断性缺陷 (Blocker) — 3方共识](#二阻断性缺陷-blocker--3方共识)
- [三、🏗️ 字节架构师 — 全栈架构审计](#三🏗️-字节架构师--全栈架构审计)
- [四、🎮 腾讯主策划 — 游戏设计评审](#四🎮-腾讯主策划--游戏设计评审)
- [五、🤖 阿里Agent架构师 — AI系统评审](#五🤖-阿里agent架构师--ai系统评审)
- [六、🔥 三巨头交叉质疑与多轮辩论](#六🔥-三巨头交叉质疑与多轮辩论)
- [七、综合评级与修复路线图](#七综合评级与修复路线图)

---

## 一、项目架构拓扑全景

```
┌────────────────────────────────────────────────────────────────┐
│  Frontend (React 19 + Zustand + TanStack Router)               │
│  Port 16543, Vite proxy → localhost:3000                       │
│  ┌─ types/index.ts (手工类型定义，与 @vi/shared 独立维护)        │
│  └─ stores/gameStore.ts (Zustand + immer 状态管理)              │
├────────────────────────────────────────────────────────────────┤
│  NestJS API (Port 3000, /api 前缀, bare CORS)                  │
│  ├─ GameController    → GameService (God Service, 397行)        │
│  ├─ GenerationController → GenerationService                   │
│  ├─ LlmController     → LlmService → ProviderRegistryWrapper   │
│  │                                → OpenaiCompatibleProviderWrapper│
│  │                                → @vi/ai OpenaiCompatibleProvider│
│  ├─ SafetyService ← @vi/ai (5 safety pipelines)                │
│  ├─ AuditService ← PrismaService                               │
│  └─ PrismaService ← PostgreSQL (12 models, 0 indexes)          │
├────────────────────────────────────────────────────────────────┤
│  Python Agent Service (Port 8000) — ⚠️ 完全孤岛，无生产调用     │
│  ├─ 5 routes: world/npc/event/ending/memory                    │
│  ├─ 5 pydantic-ai agents (独立LLM调用路径)                      │
│  ├─ MemoryStore (内存list，无持久化，无session隔离)              │
│  └─ Safety pipeline (Python重写版，仅用2/5 pipeline)            │
├────────────────────────────────────────────────────────────────┤
│  Packages (共享层)                                              │
│  ├─ @vi/shared  → Zod schemas + API types                      │
│  ├─ @vi/ai      → ProviderRegistry + Safety + Prompts          │
│  ├─ @vi/game-engine → StateMachine + 7 Reducers + 4 Checkers   │
│  └─ @vi/observability → traceId + formatLatency + AuditContext │
├────────────────────────────────────────────────────────────────┤
│  PostgreSQL (variational_infinity)                              │
│  12 Prisma models, 0 @@index, 0 migration history              │
│  AgentMemory model 定义了 embedding 字段但从未使用               │
└────────────────────────────────────────────────────────────────┘
```

**三方共识 — 架构拓扑核心矛盾**:

| 矛盾点 | 字节视角 | 腾讯视角 | 阿里视角 | 共识 |
|--------|---------|---------|---------|------|
| TS+Python双AI服务 | 孤岛架构，投入浪费 | 功能重叠，玩家无感知差异 | 双路LLM调用无协同 | **必须决策统一** |
| Schema三重定义 | 维护成本×3 | 前端类型应从@vi/shared引入 | Zod+Pydantic字段不一致 | **自动化同步机制缺失** |
| GameService God Service | 397行高耦合不可测 | 策划逻辑散落单一service | LLM调用链7层嵌套 | **必须拆分** |

---

## 二、🔴 阻断性缺陷 (Blocker) — 3方共识

以下缺陷经3方独立审计后交叉确认，为**当前系统不可运行**的致命问题。

### B1: `{{mode}}` 模板变量不存在 — world generation 完全阻断

- **位置**: `prompt-registry.ts:65-68` + `generation.service.ts:32`
- **发现者**: 🤖 阿里Agent架构师 (D1)
- **交叉确认**: 🏗️ 字节架构师审查了 PromptRegistry render 逻辑后确认 — `{{mode}}` 传入 render 但模板中无此占位符，行338-341 的 unresolved 检测会 throw Error
- **影响**: 世界生成是游戏的第一步，此 bug 导致**游戏完全无法启动**
- **修复**: 在 world_generation 模板中添加 `{{mode}}` 占位符，或从 generation.service.ts 的 render 调用中移除 mode 参数

### B2: Schema 验证双重执行导致 attemptAutoRepair 成为死代码

- **位置**: `openai-compatible.ts:109-124` + `llm.service.ts:80-103`
- **发现者**: 🏗️ 字节架构师 (P0-2) + 🤖 阿里架构师 (D2)
- **交叉确认**: 两方独立发现同一问题 — Provider 层 safeParse 失败直接 throw，LlmService 的 attemptAutoRepair 永远不可达
- **影响**: LLM 输出一次 schema 验证失败即硬性报错，无修复机会，整个容错机制失效
- **修复**: Provider 层移除 schema 验证（仅返回 raw data），LlmService 为唯一校验+修复点

### B3: 线索发现链路完全断裂 — 结局系统不可触发

- **位置**: `world-blueprint.schema.ts:175-184` (无 Clue 定义) + `reducers.ts:277-361` + `explore.tsx:109`
- **发现者**: 🎮 腾讯主策划 (断裂5 + D1-D3)
- **交叉确认**: 🏗️ 字节架构师审查了 EndingArbitrator 逻辑后确认 requiredEvidence 检查依赖 discoveredClues；🤖 阿里架构师确认 ReferenceIntegrity 不检查 clue ID 引用
- **影响**: EndingCandidate 的 requiredEvidence 指向不存在的实体，0% 结局可被触发
- **修复**: WorldBlueprint 新增 `clues` 字段；discover/investigate/talk reducer 将线索加入 discoveredClues；前端展示可发现线索而非传 locationId

### B4: Python Agent Service 与 NestJS API 零集成

- **位置**: 全项目无 NestJS→Python HTTP 调用代码
- **发现者**: 🏗️ 字节架构师 (P0-1) + 🎮 腾讯主策划 + 🤖 阿里架构师 (D14)
- **交叉确认**: 三方独立确认 — NestJS 从未调用 Python agent 的任何路由，Python 5个agent+5路由+1MemoryStore+1safety 全部为死代码
- **影响**: ~800行 Python 代码零生产价值，双套 prompt 版本分裂
- **修复**: 决策一：删除 Python agent，NestJS 承担全部 LLM 调用；决策二：NestJS 改为调用 Python HTTP API

### B5: NPC 列表永远为空 — 对话永远不可启动

- **位置**: `explore.tsx:39-41` + `generation.service.ts:109` (discoveredNpcs 初始空数组)
- **发现者**: 🎮 腾讯主策划 (D11)
- **交叉确认**: 🏗️ 字节架构师审查了 talk reducer 逻辑，确认 discoveredNpcs 只通过 talk 动作填充——但玩家必须先看到 NPC 才能点击 talk，形成鸡生蛋悖论
- **影响**: 核心玩法功能（NPC对话）完全不可用
- **修复**: 显示当前地点的所有 NPC（从世界蓝图获取），或将起始地点 NPC 初始化到 discoveredNpcs

### B6: Python Agent 跨端 Schema 不一致导致生成必然失败

- **位置**: LegendaryFigure/NpcDialogueOutput/EndingCandidate 三处跨端定义不一致
- **发现者**: 🤖 阿里架构师 (D4/D5/D6)
- **交叉确认**: 🎮 腾讯主策划审查了 Python prompt 内容后确认 — ending_director 的 prompt 要求输出 `{eligibleEndings, ineligibleEndings}` 双数组，但 output_type 是单个 EndingCandidate 对象，pydantic-ai parse 必然失败
- **影响**: 若启用 Python agent，world/npc/ending 三个生成端点都会因 schema 不匹配而失败
- **修复**: 统一 TS Zod 与 Python Pydantic 的字段定义；修复 ending_director 的 output_type

---

## 三、🏗️ 字节架构师 — 全栈架构审计

### 3.1 关键架构缺陷（按严重级别）

#### 🔴 P0 — 系统性致命缺陷

| # | 缺陷 | 文件 | 影响 |
|---|------|------|------|
| P0-1 | NestJS与Python零集成（孤岛架构） | game.service.ts + agent-service/routes | Python服务~800行死代码 |
| P0-2 | Schema验证双重执行，auto-repair死代码 | openai-compatible.ts:109-124 + llm.service.ts:80-103 | 容错机制完全失效 |
| P0-3 | 数据库写入无事务保护 | game.service.ts:84-113 (persistStateUpdate) | 部分写入导致数据不一致 |
| P0-4 | GameActionSchema.sessionId与URL参数冲突 | game-state.schema.ts:67-73 + game.controller.ts:27-29 | 双重发送同一ID，可能不一致 |

#### 🟠 P1 — 严重架构缺陷

| # | 缺陷 | 文件 | 影响 |
|---|------|------|------|
| P1-1 | Safety SECRET_PATTERNS误杀NPC数据 | safety-pipeline.ts:24-32 | NPC secret字段被系统性拦截 |
| P1-2 | Safety检查对象错误（检查系统提示词而非用户输入） | generation.service.ts:34 | 模板文本触发误报 |
| P1-3 | EndingArbitrator两个独立实现 | game-state-machine.ts:130-157 + rules.ts:33-67 | 维护需同步两版本 |
| P1-4 | 零认证零授权——全部API裸奔 | main.ts + 全部controller | 任何客户端可操作任意session |
| P1-5 | Python MemoryStore纯内存无持久化 | memory/store.py | 服务重启清零NPC记忆 |
| P1-6 | Python format string注入漏洞 | world_generator.py:82等 | 用户输入含{}导致KeyError |
| P1-7 | Prisma User→GameSession无onDelete Cascade | schema.prisma:34 | 删除User不级联删除Session |
| P1-8 | Prisma零@@index | schema.prisma全文 | 高频查询无索引，性能退化 |

### 3.2 工程质量问题清单

| # | 文件+行号 | 问题 | 级别 |
|---|-----------|------|------|
| Q1 | game.service.ts:127-134 | applyAction嵌套调用loadSession 3次 | P1 |
| Q2 | game.controller.ts:21-23 | getSession统一throw NotFoundException | P2 |
| Q3 | game.service.ts:165-168 | rest/trade返回空StateUpdate | P2 |
| Q4 | rules.ts:150-167 | ActionValidator对event_choice不验证requiresRealm | P1 |
| Q5 | reducers.ts:288-289 | reducer重复检查clue已发现(与validator不一致) | P2 |
| Q6 | game.service.ts:239-266 | triggerEnding取LLM结果仅用description，其余丢弃 | P2 |
| Q7 | api.ts:35等8处 | 前端fetchApi用res.data!非空断言 | P1 |
| Q8 | gameStore.ts:47-49 | mergeState浅合并可能覆盖partial属性 | P2 |
| Q9 | provider-registry.ts:13-24 | ProviderRegistryWrapper.onModuleInit是死代码 | P2 |
| Q10 | llm.service.ts等3处 | PromptRegistry三实例而非单例 | P2 |
| Q11 | safety.service.ts:39-42 | checkSizeLimit频繁创建短命对象 | P3 |
| Q12 | prisma.module.ts:4 | @Global()模块冗余import | P3 |
| Q13 | schema.prisma:20 | GameSession.status String无enum约束 | P2 |
| Q14 | dependencies.py:14 | 硬编码postgres:postgres密码 | P1 |
| Q15 | main.py:11-17 | Python CORS allow_methods=["*"] | P2 |
| Q16 | routes/memory.py:12 | MemoryStore模块级单例多worker不共享 | P2 |
| Q17 | npc_agent.py:91 | api_key传给pydantic-ai model_settings | P1 |
| Q18 | game-state.schema.ts:67-73 | GameActionSchema.turn字段service层不使用 | P3 |
| Q19 | types/index.ts:226-230 | 前端重新定义enum而非从@vi/shared引入 | P2 |
| Q20 | generation.controller.ts:9-16 | 无DTO class-validator | P2 |
| Q21 | prisma.service.ts | 无连接池配置 | P2 |
| Q22 | openai-compatible.ts:79 | LLM超时30s/60s硬编码 | P2 |

### 3.3 安全审计发现

| # | 类别 | 严重性 |
|---|------|--------|
| S1 | 零认证 — 12个API路由完全公开 | 🔴 Critical |
| S2 | CORS硬编码localhost | 🟠 High |
| S3 | API key内存驻留 | 🟠 High |
| S4 | SECRET_PATTERNS误杀NPC合法数据 | 🟠 High |
| S5 | Safety检查系统提示词而非用户输入 | 🟠 High |
| S6 | Python format string注入 | 🟠 High |
| S7 | 无速率限制 | 🟠 High |
| S8 | 硬编码postgres:postgres密码 | 🟠 High |
| S9 | api_key传给第三方库 | 🟡 Medium |
| S10 | ValidationPipe无自定义DTO | 🟡 Medium |
| S11 | playerMessage无长度限制 | 🟡 Medium |

### 3.4 可扩展性与可测试性

**高耦合**:
- GameService: God Service 397行，依赖4个厚重服务，无接口抽象
- PromptRegistry: 3实例而非DI单例
- Safety pipeline: TS+Python两套独立维护
- Schema: Zod+Pydantic+前端手工类型三重定义

**硬编码**:
- 初始PlayerState (game.service.ts + generation.service.ts 重复定义)
- CORS origin、注入阈值0.8、Size limit 50KB、LLM超时30s/60s
- 境界提升阈值、DB URL含密码

**零测试覆盖**: Jest/Vitest配置但0测试文件。GameService不可单元测试（无mock接口），Reducer理论上可测但无人写，Python agent不可隔离测试。

### 3.5 运维与部署风险

| # | 风险 | 严重性 |
|---|------|--------|
| O1 | pnpm-workspace.yaml含占位字符串阻塞CI | 🔴 |
| O2 | @nestjs/config v4 vs common/core v11跨大版本 | 🟠 |
| O3 | 零HTTP请求日志，无request-id/latency | 🟠 |
| O4 | 健康检查硬编码'ok'不验DB/LLM | 🟠 |
| O5 | 无优雅关机(SIGTERM handler) | 🟡 |
| O6 | db:push而非db:migrate，无migration历史 | 🟠 |
| O7 | 零索引，随数据增长查询退化 | 🟠 |
| O8 | GameState.data Json存储80+全量快照无压缩 | 🟡 |
| O9 | 无Docker Compose | 🟠 |
| O10 | bullmq+ioredis死依赖 | 🟡 |
| O11 | 无密钥rotation机制 | 🟠 |

---

## 四、🎮 腾讯主策划 — 游戏设计评审

### 4.1 玩法循环闭环断裂分析

| 断裂点 | 描述 | 严重性 |
|--------|------|--------|
| 断裂1 | 无rest/trade/end_dialogue/resolve_event的转换路径 — 4个动作完全无效 | 🔴 |
| 断裂2 | 属性增长唯一通路过窄 — 只靠事件选项attributeEffects | 🔴 |
| 断裂3 | resolve_event无触发机制 — 状态机phase卡死在event | 🔴 |
| 断裂4 | end_dialogue无触发机制 — 状态机phase卡死在dialoguing | 🔴 |
| 断裂5 | 线索发现链路断裂 — ClueSchema不存在，discover传locationId当clueId | 🔴 |

**核心循环状态**: 探索→对话→事件→修炼→结局 链路在**5个关键节点断裂**，闭环严重不完整。

### 4.2 数值体系自洽性审计

**属性增长总量 vs 境界需求**:

| 目标 | 需增长总量 | 事件可供给量 | 差距 |
|------|-----------|------------|------|
| 无限境界(calc=100) | 572点(8属性×平均72) | ≈320点(8事件×4选项×+10×4属性) | **缺口252点** |

**关键问题**:
1. 572点总需求 vs ≈320点供给 — **终点不可达**
2. family属性在14境界阈值中从未出现 — **死属性**
3. 境界突破全自动 — 剥夺玩家策略选择(无"暂缓破境"选项)
4. 80年寿元 vs 13次突破 — 平均4.9年/次，后期可能需20-30年空转
5. attributeEffects无范围/属性名约束 — AI可生成+1000或非法属性名"strength"

### 4.3 叙事架构完整性

| 缺陷 | 描述 | 严重性 |
|------|------|--------|
| 叙事-1 | WorldBlueprint无ClueSchema — 线索层完全缺失 | 🔴 |
| 叙事-2 | NPC secret与evidence系统无关联 — secret是纯叙事装饰 | 🔴 |
| 叙事-3 | Rumor与evidence系统无关联 — rumor永远不能触发结局 | 🟠 |
| 叙事-4 | 世界状态静态无演进 — 无势力冲突/地点变化/NPC关系演化 | 🟠 |
| 叙事-5 | 事件触发条件是纯文本includes('age')匹配 — 不可编程判定 | 🟠 |

### 4.4 结局系统可达成性

**结论: 0% 结局可被触发**

路径可达性证明失败:
1. Clue ID 来源不明 — WorldBlueprint无Clue定义
2. discover传入locationId而非clueId — ID永远不匹配
3. investigate不加入discoveredClues — 制造假证据
4. talk不将NPC secret转化为clue — secret无追踪
5. eventChoice不改discoveredClues — 事件选项无线索产出

### 4.5 用户体验评估

| 问题 | 描述 | 严重性 |
|------|------|--------|
| UX-1 | NPC列表永远为空(鸡生蛋悖论) | 🔴 |
| UX-2 | StatusPanel显示locationId而非地名 | 🟠 |
| UX-3 | 探索页10+功能区块信息过载 | 🟠 |
| UX-4 | 无新手引导(规则/操作/目标) | 🟠 |
| UX-5 | 对话启动双重API调用 | 🟡 |
| UX-6 | 年度推进后无反馈闭环 | 🟠 |
| UX-7 | 属性数值纯数字无进度条可视化 | 🟡 |

**Neo Brutalism风格评估**: 风格独特一致，但厚边框+硬阴影在信息密集页面造成视觉层叠混乱，缺乏层次区分。

### 4.6 游戏节奏与可重玩性

| 问题 | 描述 | 评分 |
|------|------|------|
| 节奏-1 | next_year不增长属性/不生成事件 — 5年后内容耗尽 | 🔴 |
| 节奏-2 | 无时间加速/减速机制 — 每年推进速度完全相同 | 🟠 |
| 可重玩性 | 结构相同、玩法相同、无分支叙事、无角色差异化 | **2/10** |

### 4.7 AI内容生成质量保障

| 问题 | 描述 |
|------|------|
| AI-1 | attributeEffects无Zod范围约束 — Schema仅z.record(z.string(),z.number()) |
| AI-2 | location.connections无引用完整性Schema约束 |
| AI-3 | TS与Python prompt双版本内容不一致 |
| AI-4 | Safety SECRET_PATTERNS误杀修仙叙事 |
| AI-5 | 无retry/fallback — AI失败即游戏崩溃 |

### 4.8 关键游戏设计缺陷清单 (20项)

| # | 缺陷 | 影响 | 优先级 |
|---|------|------|--------|
| D1 | WorldBlueprint无ClueSchema | 结局永远不可触发 | P0 |
| D2 | discover需客户端传入clueId但无来源 | 玩家无法知道该探索什么 | P0 |
| D3 | investigate不加入discoveredClues | 制造假证据 | P0 |
| D4 | talk不将NPC secret转化为clue | NPC秘密无追踪 | P1 |
| D5 | 无rest/trade/end_dialogue/resolve_event转换 | 4动作完全无效 | P1 |
| D6 | family属性在14境界阈值中从未出现 | 死属性 | P2 |
| D7 | next_year不增长属性/不生成事件 | 5年后内容耗尽 | P0 |
| D8 | 境界突破全自动 | 剥夺策略深度 | P2 |
| D9 | attributeEffects无范围/属性名约束 | AI可生成+1000 | P1 |
| D10 | Location.connections无引用完整性约束 | AI可生成不存在ID | P2 |
| D11 | NPC列表永远为空 | 对话不可启动 | P0 |
| D12 | StatusPanel显示locationId而非地名 | 玩家看技术标识符 | P2 |
| D13 | 初始属性固定无选择 | 可重玩性低 | P2 |
| D14 | rest/trade返回空StateUpdate | 虚假选择感 | P2 |
| D15 | handleDiscover传locationId当clueId | 概念错配 | P0 |
| D16 | 事件触发条件includes('age')文本匹配 | 不可编程判定 | P1 |
| D17 | 无AI生成retry机制 | 一次失败=崩溃 | P1 |
| D18 | /secret/i pattern误杀修仙叙事 | NPC secret不可输出 | P1 |
| D19 | TS+Python prompt双版本不一致 | 两端生成风格不同 | P1 |
| D20 | age≥lifespan只记日志不结束session | 前端需额外判断 | P2 |

---

## 五、🤖 阿里Agent架构师 — AI系统评审

### 5.1 LLM Provider抽象层审计

| 缺陷 | 描述 | 级别 |
|------|------|------|
| 无fallback | getActiveProvider() null时直接throw | P1 |
| 无provider健康检查 | isAvailable()仅初始化时检查一次 | P2 |
| 仅设response_format=json_object | 无schema definition注入，LLM幻觉风险极高 | P1 |
| 无重试逻辑 | 429/502/503直接throw | P1 |
| SSE流式JSON parse失败catch{}静默丢弃 | 行222-224 | P2 |
| 仅1种provider实现 | 扩展性为0 | P2 |

### 5.2 Prompt工程与模板系统

| 缺陷 | 描述 | 级别 |
|------|------|------|
| **{{mode}}不在模板中** | **world generation完全阻断** | **P0 Blocker** |
| world_generation prompt过长(~2K tokens) | instruction-following衰减 | P2 |
| 无few-shot示例 | LLM对复杂schema理解困难 | P2 |
| TS+Python prompt内容不一致 | Python缺少legendaryFigures/mode等 | P1 |
| npc_dialogue输出格式跨端不一致 | TS嵌套metadata vs Python扁平 | P1 |

### 5.3 Schema校验与修复链路

| 缺陷 | 描述 | 级别 |
|------|------|------|
| **Provider层safeParse提前throw** | **attemptAutoRepair永远不可达(死代码)** | **P0 Blocker** |
| attemptAutoRepair能力近零 | 仅做JSON.parse和re-safeParse | P2 |
| 全链路throw无降级 | AI失败即游戏崩溃 | P1 |

### 5.4 安全管道5级设计

| Pipeline | 缺陷 | 级别 |
|----------|------|------|
| InputSafety | 13 pattern全是英文，无中文覆盖 | P1 |
| InputSafety | 无Unicode normalization | P2 |
| InputSafety | 阈值0.8过低，3低权重即达0.9 | P2 |
| OutputSafety | **TS端缺少OUTPUT_INJECTION_PATTERNS(<<,[system],### system)** | **P1** |
| OutputSafety | /secret/i误杀NPC合法数据 | P1 |
| OutputSafety | toxicityScore始终为0(未实现) | P2 |
| FieldAllowlist | 不支持嵌套字段检查 | P2 |
| FieldAllowlist | **generation.service.ts传入allowedFields=undefined，完全跳过** | **P1** |
| ReferenceIntegrity | 仅检查7个flat字段，不检查叙事文本中的引用 | P2 |
| ReferenceIntegrity | validRealmIds硬编码与RealmIdEnum重复 | P2 |
| SizeLimit | 50KB限制远超实际需求(5-15KB) | P3 |
| **级联逻辑** | **Python短路返回 vs TS累积所有errors — 行为不一致** | **P1** |

### 5.5 Python Pydantic AI Agent

| 缺陷 | 描述 | 级别 |
|------|------|------|
| 每次请求创建新Agent实例 | 5个agent都是 | P2 |
| _validate_llm_config重复5次 | 完全相同的函数复制5次 | P2 |
| MemoryStore无持久化无session隔离 | 重启清零，多session混乱 | P1 |
| MemoryStore.search用keyword匹配 | 无语义搜索 | P2 |
| api_key每次传入model_settings | 重复初始化HTTP client | P2 |
| pydantic-ai retries=1(默认无重试) | schema validation失败不重试 | P2 |
| Python路由仅用2/5 safety pipeline | 不做reference/allowlist/size检查 | P1 |
| npc_context Optional[dict] | 缺失时fallback到"Unknown" | P1 |
| ending_director output_type与prompt不匹配 | pydantic-ai parse必然失败 | P0 |

### 5.6 TS/Python双端Schema不一致

| Schema | TS(Zod) | Python(Pydantic) | 不一致程度 |
|--------|---------|------------------|-----------|
| LegendaryFigure | {id,name,realm,backstory} | {id,name,realm,mathematical_contribution,legend} | 🔴 字段名+数量完全不同 |
| NpcDialogueOutput | 嵌套metadata{emotion,trustChange,hintAtSecret,suggestedActions:Array} | 扁平{content,emotion,trustChange,suggested_follow_up:string} | 🔴 嵌套vs扁平+类型不同 |
| EndingCandidate输出 | {eligibleEndings,ineligibleEndings}双数组 | 单个EndingCandidate对象 | 🔴 结构完全不同 |
| RiskLevelEnum | z.enum(['low','medium','high','extreme']) | Optional[str]无enum | 🟠 |
| GenerationScale | const enum | str无enum | 🟠 |

### 5.7 数据流断点

| 断点 | 描述 |
|------|------|
| NestJS→Python无HTTP调用 | 双路LLM调用无协同 |
| AGENT_NESTJS_API_URL定义但未使用 | Python config有回调URL但无代码引用 |
| NPC对话生成链路断裂 | NestJS有prompt但调用链不完整，Python有完整流程但前端不调用 |
| Event生成链路断裂 | 同上 |
| 前端对话消息客户端存储 | 重启丢失，无服务端持久化 |

### 5.8 容错与成本控制

| 缺陷 | 描述 |
|------|------|
| 零retry | Provider/LlmService/Python Agent三层均无重试 |
| Token usage仅记录不消费 | 无budget cap/per-session limit/alerting |
| 无prompt token预估 | 无法做cost estimation |
| 流式输出无schema validation | 质量保障完全缺失 |
| 流式输出无安全检查 | 增量delta无法实时检测 |

### 5.9 关键AI架构缺陷清单 (20项)

| # | 缺陷 | 级别 |
|---|------|------|
| D1 | {{mode}}模板变量不存在(world generation阻断) | **P0** |
| D2 | attemptAutoRepair死代码 | **P0** |
| D3 | TS端缺少OUTPUT_INJECTION_PATTERNS | P1 |
| D4 | LegendaryFigure跨端schema不一致 | P0 |
| D5 | NPC对话输出格式跨端不一致 | P1 |
| D6 | ending_director output_type与prompt不匹配 | P0 |
| D7 | MemoryStore无持久化无session隔离 | P1 |
| D8 | Agent每次请求新建实例 | P2 |
| D9 | InputSafety无中文pattern覆盖 | P1 |
| D10 | /secret/i误杀NPC secret | P1 |
| D11 | 零retry逻辑 | P1 |
| D12 | FieldAllowlist传入undefined完全跳过 | P1 |
| D13 | npc_context Optional导致对话质量差 | P1 |
| D14 | NestJS与Python零集成 | P0 |
| D15 | 仅设json_object无schema definition | P1 |
| D16 | attemptAutoRepair能力近零 | P2 |
| D17 | Python/TS safety级联逻辑不一致 | P1 |
| D18 | TS无output injection pattern | P1 |
| D19 | _validate_llm_config重复5次 | P2 |
| D20 | api_key每次传入model_settings | P2 |

---

## 六、🔥 三巨头交叉质疑、多轮辩论与裁决结论

> 本章每个辩论点均经过3轮交锋，最终产出**裁决结论**和**具体执行决策**。格式：质疑→回应→反驳→终裁。

---

### 辩论1: rest/trade是空壳还是设计空洞？

| 轮次 | 方 | 论点 |
|------|-----|------|
| 1 | 🏗️字节→🎮腾讯 | ActionTypeEnum含rest/trade但reducer返回空StateUpdate，前端展示按钮但点击无反馈——是设计空洞不是"待实现"，应从枚举移除 |
| 2 | 🎮腾讯回应 | 确认策划文档无rest/trade规则定义。同意是设计空洞。但提出：从枚举移除会减少操作多样性，建议实现"休整回合"(恢复体魄+3/专注+2)和"市集交易"(家世-5→获取线索) |
| 3 | 🏗️字节反驳 | 当前零实现+零规则文档=已上线但无效的功能。玩家看到按钮→点击→无任何反馈=信任崩塌。移除比保留空壳更安全——空壳制造虚假选择感。如果要实现，应先有规则文档再写代码 |

**✅ 裁决结论**: **立即移除rest/trade ActionTypeEnum枚举值和对应reducer空壳**。后续若有策划规则文档定义具体数值逻辑（如休整恢复规则、交易消耗/产出公式），再以新feature形式重新加入。空壳功能上线比功能缺失更伤害玩家体验。

**具体执行**: 从`game-state.schema.ts:54-63` ActionTypeEnum移除`rest`和`trade`；从`game.service.ts:165-168`移除空StateUpdate返回分支；从前端explore.tsx移除"休息"/"交易"按钮。

---

### 辩论2: 境界突破应全自动还是手动触发？

| 轮次 | 方 | 论点 |
|------|-----|------|
| 1 | 🏗️字节→🎮腾讯 | next_year每年自动检查境界提升，满足即突破，玩家无选择权。14境界变为纯属性达标即自动升级的线性管道，剥夺策略深度 |
| 2 | 🎮腾讯回应 | 确认非策划意图。修仙核心策略之一是"破境时机选择"——暂缓破境稳固根基vs冒险破境抢先机遇。应改为手动触发+失败风险 |
| 3 | 🏗️字节追问 | 手动触发需要新的UI交互（"尝试破境"按钮）、新的状态机转换、失败后的惩罚机制（属性损失/寿元消耗）——这些策划规则文档都不存在。改动范围多大？是否影响next_year reducer的核心逻辑？ |
| 4 | 🎮腾讯反驳 | 确实需要新规则，但当前自动突破本身就是未设计的默认行为——不是"已设计"需要"改设计"，而是"未设计"需要"补设计"。手动突破规则：玩家选择尝试→属性达标则成功+属性消耗(突破消耗5点主属性)→属性未达标则失败+寿元消耗(-2年)→玩家可选择暂缓。改动集中在next_year reducer+新增realmAdvancement reducer+新增UI按钮 |

**✅ 裁决结论**: **境界突破改为手动触发+失败风险机制**。理由：自动突破是未设计的默认行为而非已设计要改设计，手动触发+失败风险是修仙游戏的策略核心。改动范围可控：next_year移除自动突破检查、新增"尝试破境"action+reducer、新增"破境失败"journal event。

**具体执行**: `next_year reducer`移除自动`realmAdvancement`逻辑（保留条件提示"可尝试破境"）；新增`ActionTypeEnum`值`attempt_breakthrough`；新增`realmAdvancement reducer`处理成功(属性消耗)/失败(寿元消耗)分支；`GameStateMachine`新增`exploring→event(attempt_breakthrough)`转换；前端新增"尝试破境"按钮+失败结果展示。

---

### 辩论3: NPC secret被safety pipeline系统性拦截

| 轮次 | 方 | 论点 |
|------|-----|------|
| 1 | 🏗️字节→🎮腾讯+🤖阿里 | NPC secret字段设计为游戏核心机制(trust≥0.7暗示secret)，但OutputSafety的/secret/i pattern会标记任何包含"secret"语义的输出，系统性误杀 |
| 2 | 🤖阿里回应 | 同意。secret_pattern应区分"业务语义secret(NPC秘密)"和"系统安全secret(API密钥泄露)"。/secret/i过于宽泛，应改为精确的API key格式匹配(如`/api[_-]?key\s*[:=]/i`, `/sk-[a-zA-Z0-9]{20,}/i`) |
| 3 | 🎮腾讯追问 | 移除/secret/i后，如何防止LLM真的泄露系统密钥？密钥格式匹配是否足够覆盖所有泄露场景？ |
| 4 | 🤖阿里反驳 | 系统密钥泄露的pattern应该是`/sk-/i`(OpenAI key格式)、`/api[_-]?key\s*[=:]/i`(config格式)、`/Bearer\s+[a-zA-Z0-9]/i`(auth header)——这些是精确匹配实际密钥格式，而非匹配自然语言中的"secret"一词。中文修仙叙事中"秘传法门"/"隐秘之事"不应被拦截 |

**✅ 裁决结论**: **SECRET_PATTERNS移除宽泛语义pattern(/secret/i, /password/i, /authorization/i)，替换为精确密钥格式pattern**。理由：safety pipeline面向通用web场景设计，不适配修仙叙事语境；业务语义"secret"和系统安全"secret"必须区分；精确密钥格式匹配比语义匹配更安全（不会漏过真实密钥泄露，也不会误杀叙事内容）。

**具体执行**: `safety-pipeline.ts:24-32` SECRET_PATTERNS从`[/secret/i, /password/i, /authorization/i, ...]`改为`[/sk-[a-zA-Z0-9]{20,}/i, /api[_-]?key\s*[=:]\s*\S/i, /Bearer\s+[a-zA-Z0-9._-]+/i, /token\s*[=:]\s*[a-zA-Z0-9._-]{16,}/i]`；Python `pipeline.py:35-37` 同步修改。保留对实际密钥泄露的检测能力，移除对自然语言语义的误杀。

---

### 辩论4: Python Agent Service保留还是删除？

| 轮次 | 方 | 论点 |
|------|-----|------|
| 1 | 🎮腾讯→🏗️字节 | 双AI服务功能重叠、prompt不一致、维护成本翻倍。从游戏体验角度玩家不关心TS还是Python——统一为全TS更简单 |
| 2 | 🏗️字节回应 | 同意功能重叠。但Python pydantic-ai的structured output能力比TS fetch+JSON.parse更强——pydantic-ai内置retry+schema validation+model routing。应保留Python做heavy generation，NestJS只做game orchestration |
| 3 | 🤖阿里反驳字节 | Python当前5个agent全部是死代码(NestJS从未调用)。保留一个零集成的服务不是"保留能力"而是"保留债务"。如果要用Python，必须先完成NestJS→Python HTTP API集成。否则保留=继续浪费维护资源 |
| 4 | 🎮腾讯反驳字节 | TS的LlmService已有attemptAutoRepair(虽然当前是死代码但可修活)，pydantic-ai的"内置retry"实际上默认retries=1(无重试)——所谓"更强"并不成立。且两套prompt版本分裂问题无法通过"保留Python"解决，反而因为保留而加剧 |
| 5 | 🏗️字节终辩 | 两套prompt分裂是真实问题。但如果删除Python，所有generation逻辑回到NestJS→GameService(God Service)→LlmService，God Service会更膨胀。Python的优势不是pydantic-ai而是**职责分离**——game logic和AI generation应由不同服务承担。解决方案不是删除Python而是**集成Python**：NestJS orchestrator → HTTP call → Python generator。prompt统一为YAML单一源，TS和Python都从同一源加载 |

**✅ 裁决结论**: **保留Python Agent Service，但必须立即完成NestJS→Python HTTP API集成**。理由：职责分离(orchestration vs generation)是正确的架构方向；删除Python会让God Service更膨胀；但保留而不集成=继续浪费资源。集成后prompt统一为YAML单一源消除分裂问题。如果集成未在2周内完成，则降级为删除Python+全TS方案。

**具体执行**: GenerationService改为HTTP调用`http://localhost:8000/api/agent/world`；GameService.generateDialogueMessage改为HTTP调用`http://localhost:8000/api/agent/npc/dialogue`；next_year调用`http://localhost:8000/api/agent/event`生成年度事件；Python端统一从YAML prompt文件加载，TS端PromptRegistry也改为从同一YAML加载；AGENT_NESTJS_API_URL开始被使用（Python回调NestJS获取玩家状态）。**2周未完成集成则降级删除Python**。

---

### 辩论5: Prisma数据模型是否过度设计？

| 轮次 | 方 | 论点 |
|------|-----|------|
| 1 | 🎮腾讯→🏗️字节 | AgentMemory有embedding字段但无向量搜索实现；LlmCall有12字段记录每次AI调用——运维需求不是游戏功能；GameState只需存latest一条；过度持久化增加查询复杂度 |
| 2 | 🏗️字节回应 | 不同意完全删减。LlmCall的12字段对成本监控和prompt版本管理有价值——没有LlmCall记录，无法知道每次world generation消耗多少token、花费多少成本、用了哪个prompt版本。GameState存全量快照对debug和回溯有价值 |
| 3 | 🎮腾讯反驳 | LlmCall的"审计价值"是真实需求，但当前AuditService只写了`structuredOutputValid`一个字段到LlmCall记录——其余10个字段全部空写。功能声明了但未实现，是"预期过度设计"不是"实际过度设计"。GameState全量快照：80年游戏=80+条GameState记录，每条包含完整PlayerState JSON，查询性能会退化 |
| 4 | 🏗️字节终辩 | 同意GameState改为latest-only+增量变更日志(JournalEntry已有增量记录，GameState只需1条)。LlmCall保留但简化为6核心字段(sessionId, promptVersion, model, inputTokens, outputTokens, costUsd)——其余6字段目前空写确实无价值。AgentMemory.embedding移除(当前无向量搜索实现，标注TODO供未来使用) |

**✅ 裁决结论**: **LlmCall简化为6核心字段保留；GameState改为latest-only；AgentMemory.embedding移除标注TODO**。理由：审计有价值但空写字段无价值——保留核心字段满足成本监控需求；GameState全量快照在80年场景下查询退化——JournalEntry已提供增量记录；embedding字段声明但未使用是误导性设计。

**具体执行**: Prisma schema `LlmCall`模型从12字段简化为6(sessionId, promptVersion, model, inputTokens, outputTokens, costUsd)；`GameState`改为唯一1条记录(sessionId+latest标记)，删除turn字段多记录设计；`AgentMemory`移除`embedding Bytes?`字段，添加`@@comment("TODO: add embedding when vector search implemented")`注释。

---

### 辩论6: Safety Pipeline软性问题的处理方式

| 轖次 | 方 | 论点 |
|------|-----|------|
| 1 | 🎮腾讯→🏗️字节 | 五级流水线任一失败即全部拒绝。宁接受connection引用不存在ID的世界(可运行时忽略)，不让玩家因AI小错误无法开始游戏。应区分"硬性安全"和"软性质量"，后者降级为warning |
| 2 | 🏗️字节回应 | 部分同意。硬性安全(注入/密钥泄露)应阻断，软性质量(引用完整性/白名单)应auto-fix后继续——ReferenceIntegrity失败→删除不存在ID而非throw；FieldAllowlist→裁剪多余字段而非throw |
| 3 | 🤖阿里反驳 | auto-fix比warning更危险——自动删除字段可能导致数据语义变化。例如：AI输出的WorldBlueprint多了一个`timeline`字段，auto-fix直接删除→timeline信息丢失→后续没有时间线叙事→玩家体验不一致。且两端行为需统一：Python短路返回vs TS累积，如果改为auto-fix两端需同步 |
| 4 | 🎮腾讯终辩 | auto-fix+warning是最佳平衡。关键原则：**不阻断游戏启动，但不静默修改数据**。具体：软性质量pipeline失败→记录warning+返回原始数据+前端展示warning("世界生成有小瑕疵但不影响游戏")→不throw、不auto-fix。让玩家看到warning后选择"接受"或"重新生成"。这比auto-fix更透明，比阻断更宽容 |

**✅ 裁决结论**: **Safety分级为三级：硬性安全→阻断throw；软性质量→warning+原始数据返回+前端展示warning让玩家选择；SizeLimit→可配置阈值**。理由：auto-fix静默修改数据有语义丢失风险；阻断对游戏体验过于严苛；warning+玩家选择是最透明的方案。两端级联逻辑统一为累积模式。

**具体执行**: SafetyService新增`fullOutputCheckWithSeverity()`返回`{blockers: Error[], warnings: Warning[], data: T}`；硬性pipeline(InputSafety injection/OutputSafety real-key-leak)失败→加入blockers→throw；软性pipeline(ReferenceIntegrity/FieldAllowlist)失败→加入warnings→不throw；前端`api.ts`新增warning处理逻辑——展示"世界生成有N个小瑕疵，是否继续？"弹窗；Python safety pipeline同步改为累积模式；`generation.service.ts` FieldAllowlist从传undefined改为传WorldBlueprint allowlist。

---

### 辩论7: Schema校验应单点还是双层？

| 轮次 | 方 | 论点 |
|------|-----|------|
| 1 | 🤖阿里→🏗️字节 | Provider层safeParse失败直接throw，LlmService的attemptAutoRepair是死代码。Provider层验证+LlmService层验证=双层但第二层永远不执行 |
| 2 | 🏗️字节回应 | 确认是设计缺陷。Provider层应只做JSON解析和基础错误处理(网络/超时)，不做schema validation。LlmService为唯一校验+修复点 |
| 3 | 🤖阿里追问 | 移除Provider层schema validation后，Provider的generate()方法返回什么？raw string? raw object? 如果返回raw string，LlmService需要先JSON.parse再safeParse+attemptAutoRepair——JSON.parse失败怎么办？如果返回raw object，Provider层已做了JSON.parse但不做schema validation |
| 4 | 🏗️字节终辩 | Provider.generate()返回`{raw: string | object, parsed: boolean}`结构。Provider做JSON.parse(如需)，但不做Zod safeParse。返回raw data给LlmService。LlmService做safeParse→attemptAutoRepair→throw。JSON.parse失败在Provider层处理(返回raw string给LlmService由attemptAutoRepair处理) |

**✅ 裁决结论**: **Schema校验单点化：Provider层移除Zod safeParse，仅做JSON.parse和基础错误处理；LlmService为唯一safeParse+attemptAutoRepair点**。理由：双层校验第二层不可达是bug而非设计——attemptAutoRepair应有修复机会；单点校验简化链路、统一错误处理、消除7层嵌套中的重复逻辑。

**具体执行**: `openai-compatible.ts:109-124`移除Zod safeParse逻辑，改为返回`ProviderResult{data: unknown, raw: string}`；`llm.service.ts:80-103`的attemptAutoRepair改为可触达——先JSON.parse(raw)再safeParse再attemptAutoRepair(含type coercion/default填充/字段裁剪)；Provider层仅处理网络/超时/4xx/5xx错误。

---

### 辩论8: MemoryStore持久化与NPC记忆机制

| 轖次 | 方 | 论点 |
|------|-----|------|
| 1 | 🏗️字节→🤖阿里 | MemoryStore纯内存无持久化，声称"长期记忆"实为"临时存储"。Prisma AgentMemory model定义了但从未使用。服务重启清零NPC记忆 |
| 2 | 🤖阿里回应 | 承认。应接入Prisma持久化+session隔离 |
| 3 | 🎮腾讯追问 | 持久化方案：MemoryStore存Prisma AgentMemory表。但AgentMemory有embedding字段(已决定移除)和content字段——content存什么？JSON string of memory? 还是纯文本？纯文本怎么搜索？JSON怎么做语义检索？ |
| 4 | 🤖阿里终辩 | 短期方案：content存JSON string(含npcId/sessionId/type/summary/trustLevel)，搜索用Prisma text search(简单keyword match但数据在DB不丢失)。中期方案：embedding字段恢复+pgvector扩展做语义检索。长期方案：memory_agent压缩后的内容存入，NPC对话前调用memory_agent检索历史 |

**✅ 裁决结论**: **MemoryStore接入Prisma持久化+session隔离；短期JSON string存储+keyword search；中期恢复embedding+pgvector**。理由：内存存储是不可接受的——服务重启清零3小时session记忆是灾难性。短期JSON string已满足基本需求(数据不丢失+session隔离)；中期向量检索提升NPC对话质量。

**具体执行**: `memory/store.py` MemoryStore改为Prisma AgentMemory持久化——add_short_term/add_long_term写入Prisma；search改为Prisma查询(sessionId过滤+keyword match)；NestJS generateDialogueMessage在调用前先从Prisma查询该NPC历史对话摘要，传入npc_agent作为memory_summary；中期恢复AgentMemory.embedding字段+安装pgvector扩展。

---

### 辩论9: Prompt统一源机制

| 轮次 | 方 | 论点 |
|------|-----|------|
| 1 | 🏗️字节→🤖阿里 | TS PromptRegistry有5个内置prompt(hardcoded string)，Python 5个agent有5个独立prompt字符串——两套prompt各自演化、内容不一致(TS有legendaryFigures Python没有、Python有npc_realm TS没有) |
| 2 | 🤖阿里回应 | 确认分裂。建议统一为单一prompt源(YAML文件) |
| 3 | 🎮腾讯追问 | YAML文件放在哪？packages/shared？独立repo？TS和Python如何加载YAML？运行时还是构建时？YAML中的变量语法{{var}}还是{var}？ |
| 4 | 🤖阿里终辩 | YAML放在`packages/shared/prompts/`目录(5个YAML文件对应5个prompt)。TS PromptRegistry运行时加载YAML+{{var}}模板渲染(当前逻辑不变，只是prompt文本从YAML读取而非hardcoded)。Python agent运行时加载YAML+{{var}}渲染(统一为{{var}}语法而非Python {var} format)。构建时用rollup/vite打包YAML到bundle。变量语法统一为{{var}} |

**✅ 裁决结论**: **Prompt统一为YAML单一源，放置在`packages/shared/prompts/`，TS和Python运行时加载，变量语法统一{{var}}**。理由：两套prompt分裂是确定性bug源——修改一处必须修改另一处否则不一致；YAML单一源消除分裂；{{var}}语法统一消除Python format注入风险。

**具体执行**: 新建`packages/shared/prompts/world-generation.yaml`等5个YAML文件，内容为合并TS+Python版本的最终prompt文本；TS `PromptRegistry`从hardcoded改为YAML读取(运行时fs.readFileSync或构建时bundled)；Python agent从hardcoded string改为YAML读取；Python模板语法从`{var}`改为`{{var}}`(与TS统一，消除format注入风险)；Python `npc_agent.py`增加npc_realm/npc_trust/npc_math_strength/memory_summary变量(从TS prompt合并过来)。

---

### 辩论10: 跨端Schema一致性保障机制

| 轮次 | 方 | 论点 |
|------|-----|------|
| 1 | 🤖阿里→全方 | LegendaryFigure(NPC对话/EndingCandidate)三处跨端schema不一致——字段名不同、结构不同、类型不同。pydantic-ai parse必然失败 |
| 2 | 🎮腾讯回应 | 确认schema设计错误。ending_director应输出双数组结构匹配Arbitrator逻辑 |
| 3 | 🏗️字节追问 | 统一后如何保障未来修改的一致性？手工同步Zod+Pydantic+前端types三套定义？每次改schema要改3处？ |
| 4 | 🤖阿里终辩 | Zod为唯一真相源。Python Pydantic从Zod自动生成(用zod-to-pydantic工具或手工映射脚本)。前端types从@vi/shared Zod schema自动推断(用z.infer<typeof Schema>)。三套定义→一套定义+两套自动生成 |

**✅ 裁决结论**: **Zod为唯一真相源，Python Pydantic从Zod映射生成，前端types用z.infer自动推断，消除三重手工维护**。理由：三套手工定义=三个bug源，每次改schema漏改一处就是跨端不一致；Zod为single source of truth+自动生成消除人为遗漏。

**具体执行**: `packages/shared/src/schemas/`为唯一schema定义点；`LegendaryFigureSchema`统一为`{id, name, realm, legend, mathematicalContribution}`(合并TS+Python)；`NpcDialogueOutputSchema`统一为嵌套metadata结构(按TS设计)；`EndingCandidateOutputSchema`新增`eligibleEndings+ineligibleEndings`双数组；前端`types/index.ts` WorldBlueprint/PlayerState等改为`z.infer<typeof WorldBlueprintSchema>`导入而非手工定义；Python `models.py`改为从Zod schema映射生成(使用脚本或手工映射但有自动化验证CI check)。

---

### 辩论11: LLM retry机制与容错策略

| 轖次 | 方 | 论点 |
|------|-----|------|
| 1 | 🤖阿里→🏗️字节 | 全系统零retry。429/502/503直接throw。5分钟API rate limit波动导致所有session失败 |
| 2 | 🏗️字节回应 | 同意需要retry。但retry策略需要区分：429(rate limit)→exponential backoff重试3次；502/503(server error)→重试1次；4xx(client error)→不重试 |
| 3 | 🎮腾讯追问 | retry增加了延迟——如果world generation already takes 30s，3次retry可能total 90s。玩家等待90s看错误页面体验极差。是否需要max total timeout？ |
| 4 | 🤖阿里终辩 | retry+total timeout。单次请求30s超时不变，但429 retry最多3次(total max 90s)，502/503最多1次(total max 60s)。超时后降级方案：前端展示"生成失败，点击重试"而非错误页面——给玩家主动权而非被动等待 |

**✅ 裁决结论**: **429 exponential backoff重试3次(max 90s)；502/503重试1次(max 60s)；4xx不重试；超时后前端展示"重试"按钮而非错误页面**。理由：零retry=不可接受；但无限retry=延迟爆炸；区分错误类型+限制总时长+给玩家主动权是最佳平衡。

**具体执行**: `openai-compatible.ts`新增retry逻辑——429检测→1s/2s/4s backoff重试；502/503→立即重试1次；其余4xx→不重试；`llm.service.ts` generateWithSchema包装retry结果→如果所有retry失败→返回`{success: false, error: string}`而非throw；前端`api.ts` generateWorld失败→展示"世界生成失败，点击重新生成"按钮而非跳转错误页面。

---

### 辩论12: attributeEffects数值约束——Schema强制还是Prompt约定？

| 轖次 | 方 | 论点 |
|------|-----|------|
| 1 | 🎮腾讯→🤖阿里 | attributeEffects当前是`z.record(z.string(), z.number())`无范围约束——AI可生成+1000或非法属性名"strength"。Schema不强制-15~+15范围 |
| 2 | 🤖阿里回应 | 同意。应改为`z.record(AttributeNameEnum, z.number().min(-15).max(15))` |
| 3 | 🏗️字节追问 | AttributeNameEnum从哪来？当前AttributeSchema定义了8个属性key(calc/geo/abs/proof/int/focus/body/family)，但AttributeNameEnum需要显式列出这8个key。新增属性时是否需要改Schema？ |
| 4 | 🎮腾讯终辩 | 8属性是游戏核心设计固定值——不应随意新增。AttributeNameEnum=`['calculation','geometry','abstraction','proof','intuition','focus','physique','family']`，与AttributeSchema的8个key一致。新增属性=改游戏设计=改Schema=改阈值表=改prompt=需要全链路评估 |

**✅ 裁决结论**: **attributeEffects改为`z.record(AttributeNameEnum, z.number().min(-15).max(15))`**。理由：8属性是固定游戏设计不应随意扩展；Schema强制约束比Prompt约定更可靠——AI无法绕过Schema的min/max/enum约束。

**具体执行**: `world-blueprint.schema.ts`新增`AttributeNameEnum = z.enum(['calculation','geometry','abstraction','proof','intuition','focus','physique','family'])`；`EventOptionSchema.attributeEffects`从`z.record(z.string(), z.number()).optional()`改为`z.record(AttributeNameEnum, z.number().min(-15).max(15)).optional()`；Python `models.py` EventOption.attributeEffects对应改为`dict[AttributeName, constrained_number(-15,15)]`。

---

### 辩论13: 事件触发条件——结构化对象还是自然语言文本？

| 轖次 | 方 | 论点 |
|------|-----|------|
| 1 | 🎮腾讯→全方 | EventSeed.triggerCondition是`z.string()`纯文本，前端用`includes('age')`文本匹配——不可编程判定 |
| 2 | 🏗️字节回应 | 确认是设计缺陷。应改为结构化条件对象如`{minAge: 20, minRealm: "筑基", locationId: "loc_x"}` |
| 3 | 🤖阿里追问 | 结构化条件对象的Schema定义？支持哪些条件类型？AND/OR组合？嵌套条件？简单对象还是复杂表达式树？ |
| 4 | 🎮腾讯终辩 | 不需要表达式树。修仙游戏的触发条件通常是"境界≥X AND 地点=Y AND 年龄≥Z"——简单AND组合足够。Schema: `{minRealm?: RealmIdEnum, minAge?: number, locationId?: string, discoveredNpcId?: string, discoveredClueId?: string}`——所有条件AND组合。前端/GameService做简单条件判定而非文本匹配 |

**✅ 裁决结论**: **EventSeed.triggerCondition从`z.string()`改为结构化条件对象`TriggerConditionSchema`**。理由：自然语言触发条件不可编程判定，前端includes('age')匹配是伪实现；修仙游戏触发条件是简单AND组合不需要表达式树。

**具体执行**: `world-blueprint.schema.ts`新增`TriggerConditionSchema = z.object({minRealm: RealmIdEnum.optional(), minAge: z.number().optional(), locationId: z.string().optional(), discoveredNpcId: z.string().optional(), discoveredClueId: z.string().optional()})`；`EventSeedSchema.triggerCondition`从`z.string()`改为`TriggerConditionSchema`；前端`explore.tsx:64-67`从`includes('age')`改为条件对象判定；Python `models.py`同步修改。

---

### 辩论总结：12项裁决结论一览

| # | 辩论主题 | 裁决结论 | 赢方 |
|---|---------|---------|------|
| 1 | rest/trade空壳动作 | **立即移除枚举值+空壳reducer，后续有规则文档再重新加入** | 🏗️字节(移除派胜出) |
| 2 | 境界突破机制 | **手动触发+失败风险，next_year移除自动突破** | 🎮腾讯(策略派胜出) |
| 3 | NPC secret被safety拦截 | **SECRET_PATTERNS改为精确密钥格式，移除/secret/i等宽泛pattern** | 🤖阿里+🎮腾讯联合(语境适配派胜出) |
| 4 | Python Agent Service取舍 | **保留+立即集成NestJS→Python HTTP API，2周未完成则降级删除** | 🏗️字节(集成派胜出，🎮腾讯的删除方案为备选) |
| 5 | Prisma数据模型 | **LlmCall简化6字段保留；GameState latest-only；embedding移除标TODO** | 🏗️字节+🎮腾讯折中(简化派胜出) |
| 6 | Safety软性处理 | **三级分级：硬性→阻断；软性→warning+原始数据+玩家选择；SizeLimit→可配置** | 🎮腾讯(透明warning派胜出，而非字节auto-fix派) |
| 7 | Schema校验单点化 | **Provider移除safeParse，LlmService为唯一校验+修复点** | 🤖阿里(单点派胜出) |
| 8 | MemoryStore持久化 | **接入Prisma+session隔离，短期JSON+keyword，中期embedding+pgvector** | 三方共识 |
| 9 | Prompt统一源 | **YAML单一源，TS+Python运行时加载，{{var}}语法统一** | 🤖阿里(YAML源派胜出) |
| 10 | 跨端Schema一致性 | **Zod唯一真相源，Pydantic从Zod映射，前端用z.infer** | 🤖阿里(自动化派胜出) |
| 11 | LLM retry机制 | **429 backoff×3(max90s)；502/503×1(max60s)；超时后前端展示重试按钮** | 🤖阿里(分级retry派胜出) |
| 12 | attributeEffects约束 | **改为z.record(AttributeNameEnum, z.number().min(-15).max(15))** | 🎮腾讯(Schema强制派胜出) |
| 13 | 事件触发条件 | **从z.string()改为TriggerConditionSchema结构化条件对象** | 🎮腾讯(结构化派胜出) |

---

### 三方共识的7条修复原则

1. **单一AI调用路径**: NestJS orchestration → HTTP call → Python generation（2周集成deadline）
2. **单一Schema源**: Zod为唯一真相源，Pydantic映射，前端z.infer
3. **单一Prompt源**: YAML文件，TS+Python运行时加载，{{var}}统一语法
4. **Safety三级分级**: 硬性→阻断；软性→warning+玩家选择；SizeLimit→可配置
5. **Schema校验单点**: Provider层不做validation，LlmService唯一校验+修复
6. **数据写入事务化**: 所有关联写入用Prisma $transaction
7. **核心玩法闭环先行**: 先修闭环断裂再优化架构——一个闭环断裂的游戏再好的架构也是空壳

---

## 七、综合评级与修复路线图

### 综合评级

| 维度 | 评分 | 说明 |
|------|------|------|
| 架构设计 | 4/10 | 分层思路正确，但God Service+孤岛Python+Schema三重维护严重拉低 |
| 代码质量 | 3/10 | 零测试、硬实例化、浅合并、嵌套重复查询、死代码 |
| 安全性 | 2/10 | 零认证、CORS硬编码、Safety误杀、Python format注入 |
| 游戏设计 | 2/10 | 闭环5处断裂、结局0%可达、属性增长缺口252点、5年后空转 |
| AI系统 | 2/10 | {{mode}}阻断、attemptAutoRepair死代码、跨端schema不一致、零retry |
| 可运维性 | 2/10 | 零索引、零migration、零监控、零Docker、硬编码密码 |
| **综合** | **2.5/10** | **可编译但不可运行，架构完整但闭环断裂** |

### 修复路线图 — 按优先级排列

#### Phase 0: 阻断性修复 (1-3天)

| # | 修复项 | 负责 | 前置 |
|---|--------|------|------|
| 0-1 | 修复{{mode}}模板变量 — world generation解除阻断 | 🤖 阿里 | 无 |
| 0-2 | Provider层移除safeParse，LlmService为唯一校验+修复点 | 🏗️ 字节 | 无 |
| 0-3 | WorldBlueprint新增ClueSchema — 线索层补全 | 🎮 腾讯 | 无 |
| 0-4 | 前端NPC显示改为当前地点所有NPC(从蓝图获取) | 🎮 腾讯 | 无 |
| 0-5 | discover/investigate/talk reducer加入discoveredClues逻辑 | 🎮 腾讯 | 0-3 |

#### Phase 1: 核心闭环修复 (3-7天)

| # | 修复项 | 负责 | 前置 |
|---|--------|------|------|
| 1-1 | next_year加入年度属性自然增长(如focus+1/year) | 🎮 腾讯 | 无 |
| 1-2 | next_year调用Python event_agent生成年度事件 | 🤖 阿里 | 0-3 |
| 1-3 | 移除rest/trade空壳动作或实现基础逻辑 | 🎮 腾讯 | 无 |
| 1-4 | 补充end_dialogue/resolve_event转换路径 | 🏗️ 字节 | 无 |
| 1-5 | 境界突破改为手动触发+失败风险 | 🎮 腾讯 | 1-1 |
| 1-6 | EventSeed.triggerCondition改为结构化条件对象 | 🎮 腾讯 | 无 |
| 1-7 | attributeEffects改为 `z.record(AttributeNameEnum, z.number().min(-15).max(15))` | 🤖 阿里 | 无 |

#### Phase 2: AI系统修复 (5-10天)

| # | 修复项 | 负责 | 前置 |
|---|--------|------|------|
| 2-1 | NestJS→Python HTTP API集成(NestJS调用Python做generation) | 🏗️ 字节 | 0-1 |
| 2-2 | 统一LegendaryFigure/NpcDialogueOutput/EndingCandidate跨端schema | 🤖 阿里 | 无 |
| 2-3 | ending_director output_type改为双数组结构 | 🤖 阿里 | 2-2 |
| 2-4 | 单一Prompt源(YAML文件，TS+Python都从同一源加载) | 🤖 阿里 | 2-2 |
| 2-5 | attemptAutoRepair实现字段级修复(type coercion/default填充/裁剪) | 🤖 阿里 | 0-2 |
| 2-6 | MemoryStore接入Prisma持久化+session隔离 | 🤖 阿里 | 2-1 |
| 2-7 | NPC对话调用memory_agent获取历史摘要 | 🤖 阿里 | 2-6 |
| 2-8 | LLM retry机制(exponential backoff for 429/502/503) | 🏗️ 字节 | 无 |
| 2-9 | OpenaiCompatibleProvider注入schema definition(json_schema格式) | 🤖 阿里 | 无 |
| 2-10 | Safety分级: 硬性→阻断, 软性→warning+auto-fix | 🏗️ 字节 | 0-2 |

#### Phase 3: 安全与认证 (5-7天)

| # | 修复项 | 负责 | 前置 |
|---|--------|------|------|
| 3-1 | 基础Session auth(createSession→token, 后续请求携带) | 🏗️ 字节 | 无 |
| 3-2 | CORS改为从env读取origin白名单 | 🏗️ 字节 | 无 |
| 3-3 | 移除/secret/i等宽泛pattern，改为精确API key/密码格式 | 🤖 阿里 | 无 |
| 3-4 | TS端添加OUTPUT_INJECTION_PATTERNS | 🤖 阿里 | 无 |
| 3-5 | InputSafety添加中文injection pattern | 🤖 阿里 | 无 |
| 3-6 | generation.service.ts checkInput改为检查用户输入而非系统提示词 | 🏗️ 字节 | 无 |
| 3-7 | FieldAllowlist传入WorldBlueprint allowlist而非undefined | 🏗️ 字节 | 无 |
| 3-8 | Rate limiting middleware | 🏗️ 字节 | 3-1 |

#### Phase 4: 数据与运维 (5-7天)

| # | 修复项 | 负责 | 前置 |
|---|--------|------|------|
| 4-1 | Prisma $transaction包裹关联写入 | 🏗️ 字节 | 无 |
| 4-2 | Prisma添加@@index(高频查询字段) | 🏗️ 字节 | 无 |
| 4-3 | User→GameSession onDelete:Cascade | 🏗️ 字节 | 无 |
| 4-4 | GameSession.status改为enum | 🏗️ 字节 | 无 |
| 4-5 | 移除hardcoded postgres:postgres密码 | 🏗️ 字节 | 无 |
| 4-6 | PrismaService连接池配置 | 🏗️ 字节 | 无 |
| 4-7 | Health check检查DB连接+LLM provider | 🏗️ 字节 | 无 |
| 4-8 | db:migrate替代db:push | 🏗️ 字节 | 无 |
| 4-9 | Docker Compose(PostgreSQL + NestJS + Python Agent) | 🏗️ 字节 | 无 |
| 4-10 | 移除bullmq+ioredis死依赖 | 🏗️ 字节 | 无 |

#### Phase 5: 代码质量与重构 (7-14天)

| # | 修复项 | 负责 | 前置 |
|---|--------|------|------|
| 5-1 | GameService拆分为SessionService/ActionService/DialogueService/EndingService | 🏗️ 字节 | 1-1~1-7 |
| 5-2 | PromptRegistry NestJS DI单例 | 🏗️ 字节 | 无 |
| 5-3 | 统一EndingArbitrator为单一类实现 | 🏗️ 字节 | 无 |
| 5-4 | 前端types从@vi/shared自动生成 | 🏗️ 字节 | 2-2 |
| 5-5 | Python _validate_llm_config提取为共享模块 | 🤖 阿里 | 无 |
| 5-6 | Python Agent改为单例+动态user_prompt | 🤖 阿里 | 无 |
| 5-7 | applyAction一次性加载避免嵌套重复查询 | 🏗️ 字节 | 5-1 |
| 5-8 | 前端fetchApi改为安全访问(res.data ?? throw) | 🎮 腾讯 | 无 |
| 5-9 | gameStore mergeState对attributes/relationships深合并 | 🎮 腾讯 | 无 |
| 5-10 | Core reducer + GameStateMachine 单元测试 | 🏗️ 字节 | 1-1~1-7 |

#### Phase 6: 用户体验优化 (7-10天)

| # | 修复项 | 负责 | 前置 |
|---|--------|------|------|
| 6-1 | 新手引导页面(规则/操作/目标/数学修仙概念) | 🎮 腾讯 | 1-1~1-7 |
| 6-2 | StatusPanel显示地名而非locationId | 🎮 腾讯 | 无 |
| 6-3 | 属性数值改为ProgressBar可视化 | 🎮 腾讯 | 无 |
| 6-4 | 年度推进后显示年度总结叙事 | 🎮 腾讯 | 1-2 |
| 6-5 | 探索页信息分区/折叠 | 🎮 腾讯 | 无 |
| 6-6 | 创世阶段属性分配(分配50点初始属性) | 🎮 腾讯 | 无 |
| 6-7 | 修复对话启动双重API调用 | 🏗️ 字节 | 无 |

---

### 总评

> **变分无限是一个架构思路有前瞻性（AI-native、Schema-first、安全管道分级）但执行层面严重断裂的项目。** 最致命的不是任何单一代码缺陷，而是：
>
> 1. **玩法闭环5处断裂** — 线索系统不存在导致结局0%可达，属性增长唯一通路过窄导致高境界不可达，年度推进空转导致5年后内容耗尽
> 2. **AI系统3个阻断性bug** — {{mode}}模板变量不存在、attemptAutoRepair死代码、跨端schema不一致
> 3. **架构层面孤岛+三重维护** — Python Agent Service零集成、Zod+Pydantic+前端类型三重定义、TS+Python prompt双版本
>
> **修复策略: 先修闭环断裂(B3→B5→0-3→0-5)，再修AI阻断(B1→B2→B6)，再重构架构(2-1→5-1)。在闭环修复之前，任何架构优化都是次要的——一个闭环断裂的游戏，再好的架构也只是精美的空壳。**
>
> 三方评审官一致认为：项目的AI-native修仙概念有价值，Schema-first+安全管道的设计思路正确，但**必须先让游戏能玩起来**，再让游戏玩得好，再让系统跑得稳。

---

*评审文档生成时间: 2026-05-28*
*评审工具: opencode AI + 三方独立深度审计 + 交叉质疑3轮辩论*