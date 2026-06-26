# 变分无限 — 游戏设计重构方案

> 版本: v1.0 | 日期: 2026-05-29
> 状态: 待审批 — 涉及 schema/prompt/frontend 三层联动改动

---

## 一、诊断总结

### 1.1 API 500 根因

| 层级 | 问题 | 严重度 |
|------|------|--------|
| LLM | qwen3.5-plus 返回 JSON 无法通过 `WorldBlueprintSchema` 严格验证 | P0 |
| LLM | `attemptAutoRepair` 无法修复缺失/多余字段 | P0 |
| API | `AuditService.logLlmCall` catch 块 re-throw → 500 叠加 500 | P0 |
| API | 无全局异常过滤器，任何未处理异常都变 500 | P1 |
| Agent | `USE_AGENT_BRIDGE=true` 但 Agent Service 未启动 | P2 |

### 1.2 硬编码参数问题

当前世界生成参数:

```
theme: "纯粹数学" / "应用数学" / "计算数学" / "统计概率" / "随机混沌"
mode: "快速模式" / "完整模式" / "无限模式"
seed: 随机种子（用户可输入）
scale: small / medium / large
tone: "immersive"（硬编码）
```

问题:
- **数学方向**不应该作为世界参数 — 这应该由世界观内部决定，不是玩家选的
- **推演模式** (quick/complete/infinite) 区分毫无意义 — 游戏本身就该是一个完整体验
- **随机种子**暴露给用户是技术细节泄漏
- **scale/tone** 是 LLM 提示参数，不应出现在用户界面

### 1.3 设计哲学错位（根本问题）

**当前设计**: 数学 = 核心机制
- 8 个属性全是数学领域: calculation, geometry, abstraction, proof, intuition, focus, physique, family
- NPC 有 `mathematicalStrength` 字段
- Faction 有 `mathematicalDoctrine` 字段
- LegendaryFigure 有 `mathematicalContribution` 字段
- Prompt 反复强调"数学真理"、"数学证明"、"数学启蒙"

**结果**: 玩家体验像在"学数学"而不是"过一生"。

**正确设计**: 人生模拟 = 核心机制，数学 = 世界观包装
- 类比: 《人生重开模拟器》里属性是"颜值/智力/体质/家境"，不是"几何/代数/分析"
- 类比: 修仙小说里属性是"灵根/悟性/根骨/机缘"，不需要拆分到数学子领域
- 数学应该像修仙小说里的功法名、丹药名 — 提供氛围和命名体系，但不决定游戏机制

---

## 二、重构设计

### 2.1 设计支柱 (Design Pillars)

1. **人生如棋** — 每个选择都有代价，时间不可逆，后悔药不存在
2. **数学即天道** — 数学是世界运行规则的隐喻，不是玩家要"学"的东西
3. **众生相** — NPC 有自己的欲望、秘密和命运线，不是数学教具
4. **变分求极值** — 人生在约束中寻找最优路径，这是变分法的哲学，也是游戏的哲学

### 2.2 属性体系重构

**当前 (8个数学属性)**:
```
calculation, geometry, abstraction, proof, intuition, focus, physique, family
```

**重构后 (6个人生属性)**:

| 属性 ID | 名称 | 含义 | 对应修仙概念 | 数学隐喻 |
|---------|------|------|-------------|---------|
| `talent` | 天赋 | 先天悟性与才智 | 灵根资质 | 变分直觉 |
| `diligence` | 勤修 | 后天努力与毅力 | 修炼刻苦度 | 迭代逼近 |
| `physique` | 体魄 | 身体健康与寿元 | 根骨体质 | 连续性 |
| `insight` | 悟性 | 灵感与洞察力 | 顿悟机缘 | 临界点突破 |
| `connections` | 人脉 | 社会资源与关系 | 宗门靠山 | 网络拓扑 |
| `fortune` | 运势 | 随机好运与天命 | 气运天道 | 混沌系统 |

**设计理由**:
- 这6个属性描述的是"一个人的一生"，不是"一个数学家的简历"
- 每个属性都有清晰的修仙映射和数学隐喻，但玩家不需要理解隐喻就能玩
- `fortune` 替代了原先隐式的随机种子 — 好运本身就是一种属性
- 属性数量从8减到6，降低认知负担，提高每个属性的决策权重

### 2.3 世界生成参数重构

**删除**:
- `theme` (数学方向) — 世界观由 LLM 自由生成
- `seed` (随机种子) — 技术细节，后端自动生成
- `mode` (quick/complete/infinite) — 无意义的区分
- `scale` (small/medium/large) — LLM 提示参数不暴露

**替换为**:

```typescript
interface WorldPreferences {
  background: '寒门' | '世家' | '散修' | '遗孤'
  ambition: '长生' | '求真' | '权势' | '逍遥'
  era: '盛世' | '乱世' | '末法'
}
```

**设计理由**:
- `background` = 出生背景 — 直接决定初始属性分布和起始事件
- `ambition` = 人生目标 — 影响结局走向和 NPC 关系
- `era` = 时代背景 — 影响世界氛围和事件池

这三个参数是**角色扮演选择**，不是技术参数。玩家选择"我想演一个乱世中的寒门散修"，而不是"我要 small scale quick mode seed=42"。

### 2.4 Schema 字段清理

**删除/重命名的字段**:

| 位置 | 旧字段 | 新字段 | 理由 |
|------|--------|--------|------|
| NpcSeed | `mathematicalStrength` | `specialty` | NPC 擅长的是修行方向，不是数学 |
| Faction | `mathematicalDoctrine` | `philosophy` | 门派的理念，不只是数学 |
| LegendaryFigure | `mathematicalContribution` | `legacy` | 传奇人物留下的遗产 |
| EventOption | `attributeEffects: Record<AttributeNameEnum, ...>` | `attributeEffects: Record<AttributeEnum, ...>` | 匹配新属性 |
| WorldBlueprint | `stateModel` | 删除 | 技术细节不应出现在世界蓝图 |
| GenerationPreferences | 整个替换 | `WorldPreferences` | 见 2.3 |

### 2.5 Prompt 重构

**核心原则**: prompt 描述的是一个修仙世界的设定，数学只是命名体系的灵感来源。

旧 prompt 关键句:
> "Cultivation is NOT martial combat — it is the pursuit of mathematical enlightenment."

新 prompt 关键句:
> "这是一个人一生的故事。修行世界的境界、功法、丹药都以数学概念命名，但玩家体验的是人生抉择，不是数学课。变分原理是这个世界的天道法则——万物求极值，但玩家不需要懂变分法就能感受到：每个选择都有代价，人生在约束中寻找最优路径。"

### 2.6 核心循环重构

```
年循环 (5-30分钟):
  ┌─────────────────────────────┐
  │  1. 年初 — 天命揭晓         │  ← 运势属性决定本年基调
  │  2. 事件抉择 (2-3个)        │  ← 人生决策，非数学题
  │  3. 修行进展               │  ← 属性自然增长 + 突破机会
  │  4. 人际变化               │  ← NPC 关系演化
  │  5. 年末 — 回顾与抉择       │  ← 留下还是离开？坚持还是放下？
  └─────────────────────────────┘
  
长期循环 (小时-周):
  境界突破 → 解锁新地图/NPC/事件 → 发现世界真相 → 追求结局
```

### 2.7 初始属性映射

| 出身 | 天赋 | 勤修 | 体魄 | 悟性 | 人脉 | 运势 |
|------|------|------|------|------|------|------|
| 寒门 | 10 | 20 | 15 | 12 | 5 | 8 |
| 世家 | 15 | 10 | 12 | 10 | 25 | 12 |
| 散修 | 12 | 15 | 18 | 15 | 3 | 10 |
| 遗孤 | 8 | 12 | 10 | 20 | 2 | 18 |

---

## 三、API 500 修复方案

### 3.1 紧急修复 (P0)

1. **AuditService 不再 re-throw** — 审计日志写入失败只记 logger.error，不影响主流程
2. **WorldBlueprintSchema 放宽约束** — `clues.min(3)` → `min(1)`, `npcs.min(3)` → `min(2)`, `events.min(3)` → `min(2)`
3. **attemptAutoRepair 增强修复** — 对缺失数组自动填充空数组，对多余字段自动剔除

### 3.2 结构修复 (P1)

4. **添加全局异常过滤器** — `AllExceptionsFilter` 返回有意义错误码和消息
5. **LlmService 错误降级** — Schema 验证失败时返回部分结果 + warnings，而非直接 throw
6. **Agent Service 状态检查** — 启动时检测 `AGENT_SERVICE_URL` 可达性，不可达则自动 `USE_AGENT_BRIDGE=false`

---

## 四、影响范围

### 需要修改的文件

| 文件 | 改动类型 |
|------|---------|
| `packages/shared/src/schemas/world-blueprint.schema.ts` | 属性重定义 + 字段清理 |
| `packages/shared/src/types/api.ts` | `GenerationPreferences` → `WorldPreferences` |
| `packages/shared/src/schemas/game-state.schema.ts` | 属性枚举更新 |
| `packages/ai/src/prompts/prompt-registry.ts` | 全部5个 prompt 重写 |
| `apps/api/src/dto/dto.ts` | `GenerationPreferencesSchema` 替换 |
| `apps/api/src/generation/generation.service.ts` | 参数适配 + 默认状态更新 |
| `apps/api/src/game/game.service.ts` | 属性引用更新 |
| `apps/api/src/audit/audit.service.ts` | 移除 re-throw |
| `apps/api/src/llm/llm.service.ts` | Schema 验证降级 |
| `apps/api/src/filter/` (新建) | 全局异常过滤器 |
| `apps/web/src/types/index.ts` | 属性 + 偏好类型更新 |
| `apps/web/src/routes/world-gen.tsx` | UI 重设计 |
| `apps/web/src/lib/api.ts` | `toGenPref` 替换 |
| `apps/web/src/components/` | 属性显示组件更新 |

### 向后兼容性

**不兼容** — 这是破坏性重构。旧存档无法使用。
建议: 清空现有数据库，重新生成。

---

## 五、实施顺序

```
Phase 1 (P0, 紧急): API 500 修复
  ├─ 1.1 AuditService 移除 re-throw
  ├─ 1.2 WorldBlueprintSchema 放宽约束
  ├─ 1.3 全局异常过滤器
  └─ 1.4 LlmService 错误降级

Phase 2 (核心): 属性体系 + Schema 重构
  ├─ 2.1 AttributeNameEnum 重定义
  ├─ 2.2 NpcSeed/Faction/LegendaryFigure 字段清理
  ├─ 2.3 GenerationPreferences → WorldPreferences
  └─ 2.4 PlayerState 默认值更新

Phase 3 (体验): Prompt + Frontend 重构
  ├─ 3.1 5个 prompt 全部重写
  ├─ 3.2 世界生成页面 UI 重设计
  └─ 3.3 属性面板组件更新
```
