# 资深开发工程审查 — 变分无限 (Variational Infinity)

## 一、根本诊断：为什么9项欺骗性实现会反复出现

四轮审计的核心问题不是"bug多"，而是**团队缺乏"写代码就是写契约"的意识**。

欺骗性实现的本质是：代码存在、编译通过、甚至有函数签名，但不执行实际逻辑或执行了错误的逻辑。这不是技术能力问题，是工程纪律问题。

**根因分析：**

| 根因 | 表现 | 后果 |
|------|------|------|
| 先写壳再填逻辑的习惯 | SSE stream、OTel、Redis依赖都有import和函数，但无调用方 | 审计时看起来"有"，运行时实际"无" |
| 安全管道返回warning而非blocker | FieldAllowlistPipeline.extra fields → safe:true + severity:warning | 安全检查永远通过，等于没有 |
| 状态机是临时对象 | `new GameStateMachine()` 在方法内创建，方法结束即丢弃 | 状态机不驱动任何流程 |
| Schema分散定义 | NpcDialogueOutputSchema在game.service.ts内联，不在shared包 | TS/Python schema不同步，role enum阻断对话 |
| 错误静默吞掉 | `syncJournalToAgentMemory` catch后仅warn | 数据丢失完全无感知 |

---

## 二、当前代码逐文件诊断

### 2.1 API层 — `game.service.ts` (711行)

**问题：God Service反模式**

这个文件承担了：路由处理、状态加载、动作分发、LLM调用、安全校验、对话逻辑、结局逻辑、记忆同步、追踪记录。单一职责原则完全违反。

**具体问题：**

```typescript
// 问题1: persistStateUpdate 只合并了 attributes 和 discoveredClues
// discoveredLocations 被完全忽略
private async persistStateUpdate(sessionId: string, playerState: PlayerState, stateUpdate: StateUpdate) {
  const mergedState: PlayerState = { ...playerState, ...stateUpdate.newState };
  if (stateUpdate.newState.attributes) {
    mergedState.attributes = { ...playerState.attributes, ...stateUpdate.newState.attributes };
  }
  if (stateUpdate.newState.discoveredClues) {
    mergedState.discoveredClues = [...playerState.discoveredClues, ...stateUpdate.newState.discoveredClues.filter(...)];
  }
  // ❌ discoveredLocations 去哪了？discoveredNpcs 去哪了？discoveredRumors 去哪了？
  // ❌ relationships 的合并呢？
}
```

```typescript
// 问题2: NpcDialogueOutputSchema 内联定义而非使用 shared 包
const NpcDialogueOutputSchema = z.object({
  role: z.string(),  // ✅ 已修复，不再是 z.enum(['npc'])
  content: z.string(),
  metadata: z.object({...}).optional(),
});
// ❌ 这个 schema 应该在 packages/shared/src/schemas/ 里，和 Python 端统一管理
```

```typescript
// 问题3: 对话路径的 fullOutputCheck 传了 allowedFields，但 FieldAllowlistPipeline 永远不 block
const outputSafetyResult = this.safetyService.fullOutputCheck(
  data,
  NPC_DIALOGUE_ALLOWED_FIELDS,  // 传了也白传，allowlist 管道只返回 warning
  undefined,
  { npcIds: [npcId] },
);
// 结果：即使 LLM 返回了 extra fields，安全检查也通过
```

```typescript
// 问题4: startDialogue 里创建了临时 GameStateMachine，但从未持久化
const stateMachine = new GameStateMachine({...});
stateMachine.transition('talk');  // 转了，然后呢？这个对象随方法结束就没了
// 下次请求又要重新 new 一个，从数据库加载的 phase 又是旧的
```

```typescript
// 问题5: syncJournalToAgentMemory 静默吞错
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  this.logger.warn(`Agent memory sync skipped for session ${sessionId}: ${message}`);
  // ❌ 记忆同步失败应该让调用方知道，至少写入审计日志
}
```

```typescript
// 问题6: 大量 as 类型断言
const data = session.worldBlueprint?.data;
// data 是 JsonValue 类型，直接传给 WorldBlueprintSchema.parse(data)
// 如果 Prisma 返回的数据结构有微小偏差，parse 会炸，但错误信息极难定位
```

### 2.2 安全管道 — `safety-pipeline.ts`

**核心问题：FieldAllowlistPipeline 和 ReferenceIntegrityPipeline 永远不阻断**

```typescript
// FieldAllowlistPipeline
export class FieldAllowlistPipeline {
  check(data: Record<string, unknown>, allowlist: string[]): SafetyCheckResult {
    const extraFields = Object.keys(data).filter((key) => !allowlist.includes(key));
    if (extraFields.length > 0) {
      return {
        safe: true,  // ❌ 永远返回 safe: true
        severity: 'warning',  // ❌ 永远只是 warning
        errors: [`Extra fields not in allowlist: ${extraFields.join(', ')}`],
      };
    }
    return { safe: true };
  }
}
```

```typescript
// ReferenceIntegrityPipeline
if (errors.length > 0) {
  return {
    safe: true,  // ❌ 永远返回 safe: true
    severity: 'warning',
    errors,
  };
}
```

**这意味着：** LLM 可以返回任意额外字段、任意不存在的 locationId/npcId，安全管道都不会阻断。这等于安全管道是装饰品。

### 2.3 状态机 — `game-state-machine.ts`

**问题：正确实现但从未被正确使用**

状态机本身的实现是合理的（7个phase、10个transition、条件检查），但在 GameService 中的使用方式完全错误：

- 每次 HTTP 请求创建一个新的 StateMachine 实例
- phase 信息没有持久化到数据库
- 前端 store 有 phase，但和后端不同步
- 状态机的 `getAvailableActions()`、`checkEndingCandidates()`、`getTriggerableEvents()` 从未被 GameService 调用

**正确用法：** GameService 应该从数据库加载 phase，构造 StateMachine，执行业务逻辑，然后将新 phase 持久化。

### 2.4 LLM Provider — `openai-compatible.ts`

**问题：`generateStream` 存在但从未被调用**

- `generateStream` 是完整的 SSE 流式实现（80行代码）
- GameService 只调用 `llmService.generateWithSchema()` → `provider.generate()`（非流式）
- 前端也没有接收 SSE 的逻辑
- 这是典型的"写了但没用"的欺骗性代码

### 2.5 前端 — `gameStore.ts`

**问题：Phase 和后端完全脱节**

- `phase` 字段在前端 store 里手动管理（`setPhase`）
- 后端 GameService 创建了临时 StateMachine 做验证，但不会返回 phase 变更
- 前端的 `exploring/dialoguing/event` 切换纯靠猜测，没有后端权威

### 2.6 Python Agent Service

**问题：100%死代码**

- 5个 Pydantic AI Agent 定义完整
- API 路由定义完整
- 但 `USE_AGENT_BRIDGE=true` 时，NestJS 通过 HTTP 调用 Python Agent
- Python Agent 的 LLM provider 配置 (`AGENT_LLM_*`) 可能根本没设
- 即使设了，Python 端的安全管道和 TS 端是独立实现，行为可能不一致
- `WorldBlueprint` Python 端已有 `clues` 字段 ✅（已修复）

---

## 三、架构级问题

### 3.1 双路径问题（TS LLM vs Python Agent）

当前架构：
```
USE_AGENT_BRIDGE=true  → NestJS → HTTP → Python Agent → LLM
USE_AGENT_BRIDGE=false → NestJS → LlmService → LLM
```

两条路径使用不同的：
- Schema 定义（TS内联 vs Python Pydantic）
- 安全管道（TS 5管道 vs Python 独立实现）
- Prompt 模板（TS PromptRegistry vs Python 内嵌）
- 错误处理（TS throws vs Python raises）

**裁决：R3审计已决定保留双路径。** 但需要确保两条路径的行为一致。

### 3.2 Phase 持久化缺失

当前数据流：
```
前端 phase → store.setPhase()  （手动，无后端验证）
后端 phase → 临时 StateMachine  （请求结束即销毁）
数据库     → 无 phase 字段     （Prisma schema 无此列）
```

应该：
```
前端 phase ← API 返回 ← 后端 StateMachine ← 数据库 phase 字段
```

### 3.3 Schema 管理分散

| Schema | TS 位置 | Python 位置 | 问题 |
|--------|---------|-------------|------|
| NpcDialogueOutput | game.service.ts 内联 | models.py NpcDialogueOutput | TS不是source of truth |
| EndingOutput | game.service.ts 内联 | models.py 无对应 | Python端缺失 |
| WorldBlueprint | shared/schemas/ ✅ | models.py ✅ | clues已修复 ✅ |
| PlayerState | shared/schemas/ ✅ | models.py 无对应 | Python端缺失 |

---

## 四、修复优先级和具体方案

### P0 — 立即修复（阻断功能）

#### P0-1: FieldAllowlistPipeline 改为阻断

```typescript
// safety-pipeline.ts — FieldAllowlistPipeline
export class FieldAllowlistPipeline {
  check(data: Record<string, unknown>, allowlist: string[]): SafetyCheckResult {
    const extraFields = Object.keys(data).filter((key) => !allowlist.includes(key));
    if (extraFields.length > 0) {
      return {
        safe: false,           // ← 改为 false
        severity: 'blocker',   // ← 改为 blocker
        errors: [`Extra fields not in allowlist: ${extraFields.join(', ')}. Allowed: ${allowlist.join(', ')}`],
      };
    }
    return { safe: true };
  }
}
```

同理，`ReferenceIntegrityPipeline` 在发现无效引用时也应返回 blocker（至少对 npcId/locationId）。

#### P0-2: persistStateUpdate 合并所有数组字段

```typescript
private async persistStateUpdate(sessionId: string, playerState: PlayerState, stateUpdate: StateUpdate) {
  const mergedState: PlayerState = { ...playerState, ...stateUpdate.newState };

  // 合并所有数组字段
  for (const arrayField of ['discoveredLocations', 'discoveredNpcs', 'discoveredClues', 'discoveredRumors'] as const) {
    const incoming = stateUpdate.newState[arrayField];
    if (incoming) {
      const existing = playerState[arrayField];
      (mergedState as Record<string, unknown>)[arrayField] =
        [...existing, ...incoming.filter((id: string) => !existing.includes(id))];
    }
  }

  // 合并 attributes
  if (stateUpdate.newState.attributes) {
    mergedState.attributes = { ...playerState.attributes, ...stateUpdate.newState.attributes };
  }

  // 合并 relationships
  if (stateUpdate.newState.relationships) {
    mergedState.relationships = { ...playerState.relationships, ...stateUpdate.newState.relationships };
  }

  PlayerStateSchema.parse(mergedState);
  // ... persist
}
```

#### P0-3: Phase 持久化

1. Prisma schema `GameState` 添加 `phase String` 字段
2. GameService 从数据库加载 phase
3. 构造 StateMachine 后执行业务逻辑
4. 将新 phase 持久化
5. API 返回 phase 给前端

#### P0-4: NpcDialogueOutputSchema 移至 shared 包

```typescript
// packages/shared/src/schemas/game-state.schema.ts
export const NpcDialogueOutputSchema = z.object({
  role: z.string(),
  content: z.string(),
  metadata: z.object({
    emotion: z.string(),
    trustChange: z.number().min(-0.1).max(0.1),
    hintAtSecret: z.boolean().optional(),
    suggestedActions: z.array(z.string()).optional(),
  }).optional(),
});
```

Python 端 `NpcDialogueOutput` 必须镜像这个定义。

### P1 — 高优先级（工程质量）

#### P1-1: 拆分 GameService

当前 711 行的 God Service 拆分为：
- `GameSessionService` — 创建/加载/结束会话
- `GameActionService` — applyAction 分发逻辑
- `DialogueService` — 对话生成、信任度管理
- `EndingService` — 结局检查、触发
- `MemorySyncService` — Agent 记忆同步

#### P1-2: 删除死代码

- `OpenaiCompatibleProvider.generateStream()` — 删除或标记为 internal/unstable
- `redis` 和 `bullmq` 依赖 — 从 package.json 移除
- `packages/observability` 中未使用的 OTel 壳代码
- `pnpm-workspace.yaml` 中的 placeholder 字符串

#### P1-3: syncJournalToAgentMemory 错误处理

```typescript
private async syncJournalToAgentMemory(sessionId: string, journalEntries: [...]): Promise<void> {
  // ...
  try {
    // ...
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`Agent memory sync FAILED for session ${sessionId}: ${message}`);
    await this.auditService.logSafetyEvent(sessionId, 'memory_sync_failed', 'high', { error: message });
    // 不再吞错，至少写入审计
  }
}
```

#### P1-4: 安全管道分级策略

不是所有场景都该用同样的严格度：
- 对话输出：FieldAllowlist 应为 blocker（LLM 可能注入恶意字段）
- 世界生成输出：ReferenceIntegrity 应为 blocker（locationId 必须存在）
- 但 size limit 可以是 warning

建议添加 `SafetyPolicy` 概念：
```typescript
interface SafetyPolicy {
  extraFields: 'blocker' | 'warning' | 'ignore';
  invalidReferences: 'blocker' | 'warning' | 'ignore';
  sizeLimit: 'blocker' | 'warning';
}
```

### P2 — 中优先级（架构改善）

#### P2-1: 统一 Schema 管理

所有 LLM 输出 Schema 必须在 `packages/shared/src/schemas/` 定义，作为唯一真相源。
Python 端从 TS schema 生成或手动镜像，但必须有一个同步验证机制。

#### P2-2: GameStateMachine 持久化集成

```typescript
// 理想的 GameService 用法
async applyAction(sessionId: string, action: GameAction): Promise<StateUpdate> {
  const { phase, playerState, worldBlueprint } = await this.loadFullState(sessionId);

  const stateMachine = new GameStateMachine({
    phase,
    turn: playerState.age,
    playerState,
    worldBlueprint,
    pendingActions: [],
    safetyFlags: [],
  });

  // 用状态机验证动作合法性
  if (!stateMachine.canTransition(action.actionType)) {
    throw new BadRequestException(`Cannot ${action.actionType} from phase ${phase}`);
  }

  // 执行动作
  const stateUpdate = this.dispatchAction(stateMachine, action);

  // 状态机转换
  stateMachine.transition(action.actionType);

  // 持久化（包括新 phase）
  await this.persistStateUpdate(sessionId, playerState, stateUpdate, stateMachine.getPhase());

  return stateUpdate;
}
```

#### P2-3: 前端 Phase 同步

所有会修改 phase 的 API 响应必须包含当前 phase：
```typescript
interface ActionResponse {
  stateUpdate: StateUpdate;
  phase: GamePhase;
  availableActions: string[];
}
```

前端不再手动 setPhase，而是从 API 响应获取。

#### P2-4: MockProvider 实现

设计文档要求 MockProvider，代码禁止 mock。这是规格冲突。

**解决方案：** 实现 MockProvider 作为开发/测试专用 provider，通过环境变量控制：
```
AI_PROVIDER=mock  →  仅在非生产环境可用
AI_PROVIDER=openai →  生产环境
```

MockProvider 返回预设的合法 JSON，通过 schema 校验。不是 fallback，是显式选择。

---

## 五、工程纪律建议

### 5.1 Code Review 检查清单

每次 PR 必须通过以下检查：

- [ ] 新增代码有调用方（无死代码）
- [ ] 安全管道的返回值被正确处理（warning ≠ blocker）
- [ ] Schema 在 shared 包定义（不在 service 内联）
- [ ] StateMachine 的 phase 被持久化
- [ ] 错误不被静默吞掉（至少 audit log）
- [ ] as 类型断言有注释说明为什么安全
- [ ] 数组字段合并用 filter 去重（不是覆盖）

### 5.2 "代码就是契约"原则

每写一个函数，问自己：
1. **调用方是谁？** 如果没有调用方，不要写。
2. **前置条件是什么？** 如果前置条件不满足，明确 throw 而非返回空值。
3. **后置条件是什么？** 返回值必须被校验后才能进入业务逻辑。
4. **失败怎么办？** 失败路径必须可观测（日志/审计/错误传播）。

### 5.3 消除"看起来有"的反模式

| 反模式 | 正确做法 |
|--------|----------|
| 写了 import 但没使用 | 不 import，或立即实现调用方 |
| 函数签名完整但函数体空/返回默认值 | 要么实现，要么 throw new Error('Not implemented') |
| 安全检查只返回 warning | 明确文档说明为什么允许通过，否则改为 blocker |
| 配置项存在但从未读取 | 删除配置或实现读取逻辑 |
| 数据库字段存在但从未写入 | 删除字段或实现写入逻辑 |

### 5.4 测试策略

当前 game-engine 有基础测试。需要补充：

1. **Safety Pipeline 测试** — 验证每种管道在 blocker 场景下返回 safe:false
2. **GameService 集成测试** — 验证 phase 持久化和状态机驱动
3. **Schema 一致性测试** — 自动对比 TS Zod schema 和 Python Pydantic schema 的字段名/类型
4. **End-to-End 测试** — 从创建 session 到触发 ending 的完整流程

---

## 六、修复后的预期评分

| 阶段 | 评分 | 说明 |
|------|------|------|
| 当前 | 54/105 C+ | R4 审计结果 |
| P0 修复后 | 72/105 B | 消除4个 CRITICAL + 安全管道生效 |
| P1 修复后 | 85/105 B+ | 工程质量达标，死代码清除 |
| P2 修复后 | 95/105 A | 架构合理，可维护性强 |

---

## 七、团队技术能力提升路径

### Level 1: 代码规范（1-2周）

- 严格执行"无死代码"原则
- 所有 Schema 集中管理
- 错误处理标准化（不吞错、不静默）

### Level 2: 架构意识（2-4周）

- God Service 拆分
- Phase 持久化
- 安全管道分级策略

### Level 3: 工程体系（持续）

- 自动化 Schema 一致性检查
- CI/CD 流水线
- 安全管道单元测试覆盖
- E2E 测试覆盖核心流程

---

*本审查基于对项目全部源码、6份设计文档、4轮审计报告的完整阅读。所有问题均附有具体代码位置和修复方案。*
