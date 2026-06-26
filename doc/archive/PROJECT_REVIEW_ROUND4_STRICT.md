# 变分无限 (Variational Infinity) — 四审严厉终裁文档

> **四审日期**: 2026-05-28 | **审判性质**: 极其严厉，不允许任何"部分修复"混过
> **参赛赛题**: 腾讯云黑客松 游戏开发挑战赛 · 蛹题三(叙事类游戏)
> **评分维度**: 主题契合度30 + AI工具使用40 + 游戏品质30 + 社交传播5 = 105
> **四审新要素**: 首次对照项目设计文档(doc/ai-narrative-game/)逐条审查设计意图 vs 实际实现偏差

---

## 一、设计文档 vs 实际实现 — 偏差审判表

> 设计文档(doc/ai-narrative-game/01-06)是项目的设计契约。代码必须与之一致。

| # | 设计文档要求 | 实现状态 | 判定 |
|---|------------|---------|------|
| 1 | 02-§4: Mock Provider硬性要求，无Key时游戏完整可运行 | LlmService/LlmModule/Python全部throw Error，AGENTS.md禁mock | **❌致命偏差** |
| 2 | 02-§4: LLM Gateway支持超时/重试/限流/熔断/降级 | 零retry/零限流/零熔断/零降级 | **❌偏差** |
| 3 | 02-§3: Agent架构包含CrewAI NPC/Event Agent + LangGraph状态图 | Python 5个agent全部用Pydantic AI，无CrewAI/LangGraph | **❌偏差** |
| 4 | 02-§6: Prompt审计须记录12项字段 | AuditService.logLlmCall记录7项，5项永远null | **⚠️欺骗性实现** |
| 5 | 02-§7: 记忆检索=向量相似度+重要性+时间衰减+权限过滤 | MemoryStore=内存list+keyword+零衰减+零权限+零持久化 | **❌偏差** |
| 6 | 02-§8.2: 后端校验session与worldBlueprint归属关系 | loadSession加载但不验证worldBlueprint.sessionId===sessionId | **⚠️部分实现** |
| 7 | 02-§8.4: 高频请求限流 | 全系统零限流 | **❌偏差** |
| 8 | 01-§6: 调试页(Prompt版本/模型调用/traceId/安全事件) | 无调试页路由/组件 | **❌偏差** |
| 9 | 01-§6: 世界概览页(地图/势力/修为体系) | 无世界概览页 | **❌偏差** |
| 10 | 04-首页: "继续游戏"按钮 | 首页仅"开天辟地"，无继续游戏 | **❌偏差** |
| 11 | 01-§4.6: 重开可保留天赋/传闻/前世痕迹 | reset()清空一切，零继承 | **❌偏差** |
| 12 | 03-§3: TanStack Query v5 | 未安装/未使用 | **❌偏差** |
| 13 | 03-§3: Radix UI | 未使用，全部自定义组件 | **❌偏差** |
| 14 | 03-§3: React Hook Form + Zod | 未使用 | **❌偏差** |
| 15 | 03-§4: Pino structured logging | nestjs-pino未安装，用NestJS默认Logger | **❌偏差** |
| 16 | 03-§4: OpenTelemetry预留 | observability仅createTraceId/formatLatency/AuditContext | **⚠️欺骗性实现** |
| 17 | 03-§4: Redis + BullMQ | package.json声明但代码零引用 | **❌偏差** |
| 18 | 04-对话页: 流式输出 | generateStream()存在但dialogue从未调用 | **⚠️欺骗性实现** |
| 19 | 04-对话页: "引用记忆"标签 | DialogueMessage.memoryRefs从未填充/展示 | **❌偏差** |
| 20 | 01-§7: 无Key环境能完整跑通 | 无Mock Provider，无Key=游戏完全不可启动 | **❌致命偏差** |
| 21 | 06-§5: Schema/API/前端/安全测试 | 零测试文件 | **❌偏差** |
| 22 | 04-状态面板: 地名一眼可见 | 显示locationId技术标识符 | **❌偏差** |

**统计**: ❌致命偏差2项 / ❌偏差16项 / ⚠️欺骗性实现4项 / ⚠️部分实现1项 / ✅一致0项

---

## 二、欺骗性实现揭露

> 欺骗性实现 = 看起来实现了但不工作或不被使用的功能。比功能缺失更伤害可信度。

| # | 欺骗性实现 | 表面声明 | 实际真相 |
|---|-----------|---------|---------|
| **D1** | SSE流式对话 | LlmService.generateStream()完整实现(216行代码) | dialogue从未调用generateStream，使用非流式generateWithSchema。**216行代码=死代码** |
| **D2** | ZodValidationPipe | main.ts安装nestjs-zod+全局pipe | 无per-route Zod schema装饰器，pipe无schema信息=不验证任何请求体。**安装了但不工作** |
| **D3** | Prompt审计12字段 | AuditService.logLlmCall接口定义12字段 | 5字段(inputHash/outputHash/safetyResult/toolsCalled/checkpointId)永远null空写。**声明记录但不记录** |
| **D4** | OpenTelemetry | observability包存在+设计文档声明OTel预留 | 仅3个工具函数，零真实OTel集成。**声称预留但无实质** |
| **D5** | Redis/BullMQ | package.json声明依赖 | 代码零引用，零模块注册。**声明依赖但不使用** |
| **D6** | Memory reference标签 | DialogueMessage.memoryRefs字段定义 | 从未填充/从未渲染。**纯装饰字段** |
| **D7** | Python Agent Service | 5个agent+5个route+1个safety+1个memory=完整微服务 | NestJS从未调用任何Python route。**800行Python=100%死代码** |
| **D8** | Safety allowlist级联 | SafetyService.fullOutputCheck实现5级pipeline+blocker/warning分级 | FieldAllowlist在generation路径传入allowedFields但game.service对话路径未传入=**完全跳过** |
| **D9** | GameStateMachine驱动游戏 | state-machine完整实现(247行) | 仅在startDialogue()做一次canTransition检查。游戏phase由前端Zustand独立管理。**StateMachine从不驱动实际游戏流程** |

---

## 三、前三审遗漏的隐藏问题

| # | 隐藏问题 | 说明 | 严重度 |
|---|---------|------|--------|
| **H1** | `NpcDialogueOutputSchema.role: z.enum(['npc'])` 是静默阻断器 | LLM默认返回"assistant"，safeParse必然失败。attemptAutoRepair不处理enum coercion。**每次NPC对话有高概率崩溃** | 🔴CRITICAL |
| **H2** | Python WorldBlueprint模型缺失clues字段 | models.py WorldBlueprint不含clues。Python生成世界=0线索=0结局可触发 | 🔴CRITICAL |
| **H3** | AuditService.logStateChange只写console不写DB | audit.service.ts:77-83仅logger.log()，不persist到Prisma。**state change记录只在console不可查询** | 🟠HIGH |
| **H4** | docker-compose.yml密码与Python dependencies.py冲突 | docker-compose用`vi/vi_local_dev`，Python用`postgres:postgres`。**Python无法连接docker-compose的PG** | 🟠HIGH |
| **H5** | 前端mergeState不处理discoveredLocations | explore.tsx mergeState处理attributes/clues/npcs但不处理locations。**move reducer返回的新discoveredLocations被丢弃** | 🟠HIGH |
| **H6** | Python format string注入 | world_generator.py:59-62用str.format()渲染prompt，用户输入含`{`导致KeyError崩溃 | 🟠HIGH |
| **H7** | GameService.applyAction对同一session做3次DB查询 | loadSession→loadWorldBlueprint(再次loadSession)→loadPlayerState(第三次loadSession) | 🟡MEDIUM |

---

## 四、四审逐行源码新发现问题清单

### 🔴 CRITICAL (必须修复才能参赛)

| # | 文件:行 | 问题 | 影响 |
|---|--------|------|------|
| C1 | game.service.ts:43 | `role: z.enum(['npc'])` 阻断对话 | LLM返回"assistant"时safeParse失败，**每次NPC对话高概率崩溃**。前三审从未发现 |
| C2 | 全项目 | 无Mock Provider | 设计文档硬性要求"无Key时游戏完整可运行"，代码禁止mock。**无Key=游戏完全不可启动**。评审无Key环境无法体验 |
| C3 | models.py:153-164 | Python WorldBlueprint缺失clues | Python生成世界无线索数据→结局系统不可触发 |
| C4 | StatusPanel.tsx:48 | 显示locationId而非地名 | 设计文档要求"地名一眼可见"，实际显示"loc_mystic_mountain"等技术ID |

### 🟠 HIGH

| # | 文件:行 | 问题 |
|---|--------|------|
| H1 | pipeline.py:34-37 | Python SECRET_PATTERNS仍含/secret/i宽泛pattern，TS已改精确模式但Python未同步 |
| H2 | 全controller | 零认证零授权——所有路由完全裸奔 |
| H3 | game.service.ts:75+llm.service.ts:28+generation.service.ts:18 | PromptRegistry 3实例非DI单例 |
| H4 | types/index.ts 263行 | 前端手工定义全部类型而非z.infer，schema变更不传播 |
| H5 | 全Provider/LlmService/Python | 零retry——429/502/503直接throw |
| H6 | main.ts:16 | ZodValidationPipe全局注册无per-route schema=不验证任何请求体 |
| H7 | 全项目 | 零测试覆盖 |
| H8 | game.controller.ts:17-24 | getSession统一throw NotFoundException掩盖真实错误类型 |
| H9 | dialogue.tsx | 对话结束未调用end_dialogue持久化trust |

### 🟡 MEDIUM

| # | 文件:行 | 问题 |
|---|--------|------|
| M1 | schema.prisma | 零@@index、User→GameSession无Cascade、status String无enum |
| M2 | schema.prisma:108 | AgentMemory.embedding仍存在无实现 |
| M3 | game.service.ts:110-118 | persistStateUpdate浅合并可能丢失relationships部分更新 |
| M4 | app.controller.ts:16 | health check硬编码'ok'不验DB/LLM |
| M5 | Python 5个agent | 每次请求新建实例+api_key传入model_settings+_validate_llm_config重复5次 |
| M6 | docker-compose.yml | 仅PostgreSQL，无API/Web/Agent |
| M7 | AuditService | LlmCall 5字段永远null空写 |
| M8 | game.service.ts:457-462 | REALM_NAMES_ORDERED重复定义3处 |

---

## 五、赛题评分严厉重估

> 三审78分基于"修复后预期"——假设10项裁决全部执行。四审逐行复核发现执行偏差+欺骗性实现+隐藏问题，不允许同情分。

| 维度 | 三审预估 | 四审严厉重估 | 理由 |
|------|---------|-------------|------|
| **主题契合度(30)** | 25 | **20** | 数学修仙概念9分，但: StatusPanel显示技术ID(-2)、无Mock无Key不可运行(-3)、Journal部分混英文(-2)、无继续游戏/无继承(-2)、无调试页/世界概览(-1) |
| **AI工具使用(40)** | 28 | **18** | 世界生成可用(+8)但: role=z.enum阻断对话(-5)、SSE流式216行死代码(-3)、Python800行死代码(-4)、记忆引用纯装饰(-3)、零retry(-2)、Prompt审计5字段空写(-2)、Prompt 3实例非单例(-1) |
| **游戏品质(30)** | 23 | **15** | 核心闭环7/8但: trust不持久化(-2)、无Mock无Key不可玩(-3)、StatusPanel技术ID(-2)、零测试(-2)、无继续游戏(-2)、无世界概览页(-1)、family上限无截断(-1) |
| **社交传播(5)** | 2 | **1** | Neo Brutalism有辨识度(+1)，无社交分享功能 |

| **总分** | **78** | **54/105** | |

---

## 六、四审终裁与裁决

### 终裁1: Mock Provider — 设计契约硬性违反，必须实现

| 设计文档要求 | 实际代码 | 裁决 |
|------------|---------|------|
| 02-§4: "无Key时Mock Provider可完整跑通同一流程" | AGENTS.md: "NO mock/fallback anywhere"，LlmService throw | **必须实现MockProvider** |

**裁决**: 实现一个最简MockProvider，返回预定义的WorldBlueprint/NpcDialogue/EndingOutput JSON。MockProvider仅在AI_BASE_URL/AI_API_KEY缺失时自动激活，有真实配置时使用真实provider。**这不是降低工程质量——这是满足设计契约的硬性要求**。评审在无Key环境必须能完整体验游戏。

**具体执行**: `packages/ai/src/providers/mock-provider.ts` 新增MockProvider类(实现LlmProviderAdapter接口)，返回3个预定义JSON(world_blueprint_mock.json, npc_dialogue_mock.json, ending_mock.json)；`ProviderRegistry.register('mock', mockProvider)` 在onModuleInit中检测：若AI_BASE_URL缺失→注册mock为activeProvider；有配置→注册openai-compatible为activeProvider。

---

### 终裁2: role=z.enum(['npc']) → 改为z.string()

| 问题 | 裁决 |
|------|------|
| LLM默认返回role="assistant"，safeParse必然失败 | **NpcDialogueOutputSchema.role从z.enum(['npc'])改为z.string()** |

**裁决**: enum约束过于严格。role字段对游戏逻辑无影响(前端不使用role做任何判定)，改为string允许LLM返回任何role值。

**具体执行**: game.service.ts:43 `role: z.enum(['npc'])` → `role: z.string()`

---

### 终裁3: Python WorldBlueprint缺失clues — 必须补齐

| 问题 | 裁决 |
|------|------|
| models.py WorldBlueprint不含clues字段 | **Python WorldBlueprint新增clues字段与TS schema对齐** |

**裁决**: Python端必须能生成含clues的WorldBlueprint，否则Python Agent Service无法产出完整数据。

**具体执行**: models.py:153-164 WorldBlueprint新增`clues: list[Clue] = Field(default_factory=list)`，与TS schema一致(min3 max15)

---

### 终裁4: 9项欺骗性实现 — 分类处理

| 类型 | 处理方式 |
|------|---------|
| **已实现但未使用(D1 SSE流式/D7 Python Agent/D9 StateMachine)** | 保留代码但标注"未接入主流程"，提交PPT说明架构预留 |
| **已安装但不生效(D2 ZodValidationPipe/D5 Redis/BullMQ/D8 Safety allowlist)** | ZodValidationPipe:补per-route schema装饰器；Redis:移除死依赖；Safety allowlist:对话路径也传入allowedFields |
| **已定义但空写(D3 Prompt审计/D6 memoryRefs/D4 OTel)** | Prompt审计:实现inputHash/outputHash计算；memoryRefs:对话prompt传入memory摘要后填充；OTel:移除observability空壳或实现真实集成 |

---

### 终裁5: docker-compose密码与Python配置冲突

| 问题 | 裁决 |
|------|------|
| docker-compose用vi/vi_local_dev，Python用postgres:postgres | **Python dependencies.py DATABASE_URL改为从环境变量读取，docker-compose传入正确PG_URL** |

**具体执行**: dependencies.py:14 `database_url: str = "postgresql://..."` 改为 `database_url: str = Field(default="", alias="DATABASE_URL")`，docker-compose.yml为agent-service传入DATABASE_URL环境变量

---

### 终裁6: StatusPanel显示locationId → 显示地名

| 问题 | 裁决 |
|------|---------|
| StatusPanel.tsx:48显示player.currentLocationId技术ID | **从worldBlueprint.locations查找当前locationId对应的name显示** |

**具体执行**: StatusPanel.tsx:48改为从gameStore获取worldBlueprint，`worldBlueprint?.locations.find(l => l.id === player.currentLocationId)?.name ?? player.currentLocationId`

---

### 终裁7: 前端mergeState遗漏discoveredLocations

| 问题 | 裁决 |
|------|---------|
| explore.tsx mergeState不处理discoveredLocations | **mergeState增加discoveredLocations合并逻辑** |

**具体执行**: gameStore.ts mergeState函数增加: `discoveredLocations: [...(base.discoveredLocations || []), ...(update.discoveredLocations || [])].filter(...unique)` 模式，与discoveredClues/npcs合并逻辑一致

---

## 七、四审最终评级

| 维度 | 一审 | 二审 | 三审 | **四审** |
|------|------|------|------|---------|
| 主题契合度 | ~18 | 22 | 25 | **20** |
| AI工具使用 | ~12 | 21 | 28 | **18** |
| 游戏品质 | ~10 | 17 | 23 | **15** |
| 社交传播 | 0 | 1 | 2 | **1** |
| **总分** | **~40** | **61** | **78** | **54** |
| **综合评级** | D | B- | B+ | **C+** |

### 评级轨迹解读

三审78分B+是基于**修复后预期**——假设10项裁决全部执行。四审逐行复核发现：
- 4项裁决执行有偏差(破境消耗≠50%阈值、nestjs-zod空壳、Python clues缺失、trust持久化只做reducer未做前端触发)
- 2项裁决完全未执行(ValidationPipe/Python集成)
- 5项前三审从未发现的隐藏问题(role enum阻断/Python clues缺失/AuditService空写/docker密码冲突/mergeState遗漏)
- **9项欺骗性实现**——看起来实现了但不工作或不被使用

**不允许同情分**: 三审的78分含有"假设修复完成"的虚增成分。四审去除所有虚增，严格按当前代码状态评分。

### 修复后预期

若7项终裁全部执行(MockProvider+role改string+Python clues+Safety allowlist对话路径+Prompt审计5字段实现+StatusPanel地名+mergeState locations):

| 维度 | 四审当前 | 修复后预期 |
|------|---------|-----------|
| 主题 | 20 | 24(+4:Mock可运行+地名+Journal中文) |
| AI工具 | 18 | 26(+8:Mock+role修复+Safety+审计实现) |
| 品质 | 15 | 20(+5:Mock可玩+地名+trust持久化+mergeState) |
| 传播 | 1 | 2(+1:完整可运行原型) |
| **总分** | **54** | **72/105** |

---

## 八、终裁结论

**四审结论**: 变分无限是一个**有完整架构骨架和真实LLM交互链路的原型**，但存在：

1. **设计契约硬性违反(Mock Provider)** — 设计文档明确为硬性要求，代码明确禁止。评审在无Key环境无法体验游戏。
2. **9项欺骗性实现** — 比功能缺失更伤害可信度。看起来实现了但不工作或不被使用。
3. **1项结构性对话阻断(role enum)** — 前三审从未发现，每次NPC对话有高概率因role值不匹配而safeParse失败。
4. **Python端clues缺失** — 前三审修复了TS端clues但从未检查Python端。
5. **22项设计文档偏差** — 设计文档与实际实现大面积不一致。

**底线**: 54/105 C+ — 有Key时可运行原型(对话有崩溃风险)，无Key时完全不可启动。核心架构完整(状态机+reducer+安全管道+AI链路)，但欺骗性实现和设计契约违反严重损害可信度。

**修复优先级**: C1(role string) → C2(MockProvider) → C3(Python clues) → C4(StatusPanel地名) → D类欺骗性实现分类处理

---

*四审日期: 2026-05-28*
*审判性质: 极其严厉终裁——不允许任何"部分修复"混过*
*新要素: 首次对照设计文档(doc/ai-narrative-game/)逐条审查*
*赛题: 腾讯云黑客松 游戏开发挑战赛 · 蛹题三(叙事类游戏)*