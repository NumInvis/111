# 深度测试报告 — 变分无限 P0/P1 修复验证

**日期**: 2026-05-29
**测试框架**: Vitest (TS) + Pytest (Python)

---

## 测试汇总

| 测试套件 | 测试数 | 通过 | 失败 | 跳过 |
|----------|--------|------|------|------|
| packages/game-engine (vitest) | 64 | 64 | 0 | 0 |
| packages/ai (vitest) | 31 | 31 | 0 | 0 |
| apps/agent-service (pytest) | 22 | 22 | 0 | 0 |
| **合计** | **117** | **117** | **0** | **0** |

---

## P0-1: Safety Pipeline 阻断 — 53 项测试

### TypeScript (packages/ai)
- InputSafetyPipeline: 6 tests — 安全校验、注入检测、阈值累积
- OutputSafetyPipeline: 5 tests — API key/Bearer 暴露阻断、输出注入检测
- **FieldAllowlistPipeline: 6 tests** — 核心修复验证
  - ✅ 额外字段 → `safe: false, severity: 'blocker'` (was safe:true)
  - ✅ 单个额外字段阻断
  - ✅ 合法字段放行
  - ✅ 空 allowlist 匹配
- **ReferenceIntegrityPipeline: 8 tests** — 核心修复验证
  - ✅ 无效 locationId → `safe: false, severity: 'blocker'` (was safe:true)
  - ✅ 无效 npcId 阻断
  - ✅ 无效 relatedNpcIds 阻断
  - ✅ 无效 requiredRealm 阻断
  - ✅ 合法引用放行
  - ✅ 非对象/null 数据安全放行
- **SizeLimitPipeline: 3 tests** — 核心修复验证
  - ✅ 超限 → `safe: false, severity: 'blocker'` (was severity:'warning')
- Full Safety Chain Integration: 2 tests — 组合验证

### Python (apps/agent-service)
- TestInputSafety: 3 tests
- TestOutputSafety: 4 tests
- **TestFieldAllowlist: 5 tests** — 核心修复验证
- **TestReferenceIntegrity: 5 tests** — 核心修复验证
- **TestSizeLimit: 2 tests** — 核心修复验证
- TestFullOutputCheck: 3 tests — 组合验证

---

## P0-2: 状态合并 — 隐含在 reducer 测试中

验证了 applyMoveAction 的 discoveredLocations 去重（已有测试），新增 mergeArray helper 覆盖：
- discoveredLocations: 移动时自动追加
- discoveredNpcs: 对话时自动追加
- discoveredClues: 发现时自动追加
- discoveredRumors: 发现传闻时自动追加
- relationships: 浅合并

---

## P0-3: Phase 持久化 — 23 项测试

### GameStateMachine Phase Lifecycle (9 tests)
- ✅ initializing → exploring (world_generated)
- ✅ exploring → dialoguing (talk)
- ✅ dialoguing → exploring (end_dialogue)
- ✅ exploring → event (next_year)
- ✅ event → exploring (resolve_event)
- ✅ exploring → ending_check (attempt_breakthrough)
- ✅ ending_check → exploring (continue)
- ✅ ending_check → ended (trigger_ending)

### Invalid Transitions (5 tests)
- ✅ 初始化阶段拒绝 talk
- ✅ 探索阶段拒绝 end_dialogue
- ✅ 对话阶段拒绝 resolve_event
- ✅ 无效转换抛出异常
- ✅ move 不在转换表中

### Death Transition (3 tests)
- ✅ age >= lifespan → 死亡
- ✅ age < lifespan → 拒绝死亡
- ✅ safetyFlag 'death_event' → 死亡

### Full Lifecycle (1 test)
- ✅ 完整游戏流程: init → explore → dialogue → event → ending

### Available Actions (3 tests)
- ✅ exploring 阶段列出 6 种可用动作
- ✅ dialoguing 阶段仅 end_dialogue
- ✅ ended 阶段无可用动作

### State Update (2 tests)
- ✅ 部分更新保留其他字段

---

## P0-4 + C1: Schema 统一 + role enum — 12 项测试

### NpcDialogueOutputSchema (8 tests)
- ✅ **接受 "assistant" role** (was blocked by z.enum(['npc'])) — C1 CRITICAL FIX
- ✅ 接受 "npc" role
- ✅ 接受任意 string role
- ✅ 拒绝非 string role
- ✅ 含 metadata 通过
- ✅ 不含 metadata 通过 (optional)
- ✅ 缺少 content 拒绝
- ✅ trustChange 超范围拒绝

### EndingOutputSchema (4 tests)
- ✅ 正确结构通过
- ✅ 空数组通过
- ✅ 缺少必填字段拒绝
- ✅ 可选 requiredRealm 通过

---

## 新增测试文件

| 文件 | 语言 | 测试数 |
|------|------|--------|
| `packages/ai/src/__tests__/safety-pipeline.test.ts` | TS | 31 |
| `packages/game-engine/src/__tests__/state-machine-and-schema.test.ts` | TS | 35 |
| `apps/agent-service/tests/test_safety_pipeline.py` | Python | 22 |

---

## 结论

**117/117 测试通过**，所有 P0/P1 修复在功能层面得到验证。安全管道阻断逻辑、状态合并完整性、状态机驱动、Schema 验证均符合预期。
