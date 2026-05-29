# 变分无限 — 游戏设计重构方案 v2

> 版本: v2.0 | 日期: 2026-05-29
> 核心原则: **无为** — AI 生成一切内容，引擎只提供运转机制
> 世界观: **数学替代玄幻** — 修仙体系用数学概念重构，但由 AI 定义具体内容
> 不动项: **14 境界** (炼体→练气→筑基→本元→通明→化神→归一→渡劫→天门→仙境→圣境→变分境→天道境→无限)

---

## 零、核心设计哲学

### 无为原则

> 引擎不预设内容，AI 生成一切。

当前问题的根源不是"数学太多"或"数学太少"，而是**开发者在代码里预设了太多**：

| 硬编码项 | 当前 | 应该 |
|---------|------|------|
| `AttributeNameEnum` | 8 个固定属性名 (calculation/geometry/abstraction/proof/intuition/focus/physique/family) | **由 AI 在 WorldBlueprint 中定义** |
| `REALM_ADVANCEMENT_THRESHOLDS` | 14 个境界各有什么属性门槛 | **由 AI 在 CultivationTier.requiredAttributes 中定义** |
| `ANNUAL_ATTRIBUTE_GROWTH` | 每年各属性固定增长值 | **由 AI 在 stateModel 中定义** |
| `BREAKTHROUGH_COST` | 突破消耗固定值 | **由 AI 在 stateModel 中定义** |
| `LIFESPAN_EXTENSION` | 突破成功增加固定寿元 | **由 AI 在 stateModel 中定义** |
| `FAMILY_ATTRIBUTE_CAP` | family 属性上限 30 | **由 AI 在 stateModel 中定义** |

**正确的架构**：

```
引擎提供:  运转机制（回合推进、属性运算、事件路由、NPC 状态机、结局判定）
          境界骨架（14 个境界的顺序和 ID，但突破条件不硬编码）
AI 提供:   世界内容（属性名、突破规则、增长速率、事件文本、NPC 人格）
```

引擎是骨，AI 是魂。骨不预设魂的样子。

### 数学替代玄幻

> 玄幻大世界的体系用数学替代，但替代方式由 AI 决定。

修仙世界有灵根、功法、丹药、阵法、天劫。我们的世界可以有：

| 玄幻概念 | 可能的数学替代 | 注意：具体替代由 AI 决定，开发者不预设 |
|---------|-------------|----------------------------------|
| 灵根 | 数根？天赋？ | AI 决定叫什么、有哪些种类 |
| 功法 | 理论？心法？ | AI 决定名称和体系 |
| 丹药 | 公理？精华？ | AI 决定命名和效果 |
| 阵法 | 结构？结界？ | AI 决定概念和规则 |
| 天劫 | 证明？证道？ | AI 决定触发和后果 |
| 境界 | 14个固定境界 | 境界名固定，但每个境界的含义由 AI 诠释 |

关键区别：**上表的"可能替代"只是给 AI prompt 的灵感参考，不是硬编码到 schema 里的字段名。** AI 可能生成"代数根/几何根/分析根"作为灵根种类，也可能生成"火灵根/水灵根/风灵根"的数学化版本——这完全取决于 AI 的创造力，开发者不替它做决定。

### 14 境界——不动

这 14 个境界是游戏的核心骨架，引擎必须知道它们的顺序：

```typescript
// 永远不变的常量
const REALM_ORDER = [
  '炼体', '练气', '筑基', '本元', '通明', '化神', '归一',
  '渡劫', '天门', '仙境', '圣境', '变分境', '天道境', '无限'
] as const;
```

但**每个境界的突破条件、属性需求、消耗代价**全部由 AI 在 WorldBlueprint 中定义。

---

## 一、架构重构

### 1.1 属性体系：从硬编码到 AI 定义

**现状**：

```typescript
// world-blueprint.schema.ts
export const AttributeNameEnum = z.enum([
  'calculation', 'geometry', 'abstraction', 'proof',
  'intuition', 'focus', 'physique', 'family',
]);

// game-state.schema.ts
export const AttributeSchema = z.object({
  calculation: z.number().min(0).max(100),
  geometry: z.number().min(0).max(100),
  // ... 固定 8 个
});
```

**重构后**：

```typescript
// world-blueprint.schema.ts
// AttributeNameEnum 删除。属性名由 WorldBlueprint.attributeDefs 定义。

export const AttributeDefSchema = z.object({
  id: z.string().describe('属性标识符，如 "insight", "rootBone"'),
  name: z.string().describe('属性显示名，如 "悟性", "根骨"'),
  description: z.string().describe('属性描述，融入数学替代玄幻的世界观'),
  range: z.tuple([z.number(), z.number()]).describe('属性值域 [min, max]'),
  growthPerYear: z.number().describe('每年自然增长量'),
  cap: z.number().optional().describe('属性上限（如有）'),
});

// game-state.schema.ts
// AttributeSchema 从固定对象变为动态 Record
export const AttributeSchema = z.record(z.string(), z.number())
  .describe('动态属性映射，key 由 WorldBlueprint.attributeDefs 定义');
```

**影响**：

- `PlayerState.attributes` 从 `{ calculation: 10, geometry: 5, ... }` 变为 `{ insight: 12, rootBone: 18, ... }`（AI 决定 key 名）
- 引擎不关心属性叫什么，只做数值运算（加减、clamp、比较阈值）
- `EventOption.attributeEffects` 的 key 也由 AI 定义，引擎只做 `attributes[key] += delta`

### 1.2 突破规则：从硬编码到 AI 定义

**现状**：

```typescript
// rules.ts
const REALM_ADVANCEMENT_THRESHOLDS = {
  '练气': { calculation: 10, focus: 10, physique: 10 },
  '筑基': { calculation: 20, geometry: 10, focus: 15, physique: 15, family: 8 },
  // ... 全部硬编码
};
const BREAKTHROUGH_COST = { '练气': 3, '筑基': 3, ... };
const LIFESPAN_EXTENSION = { '炼体': 5, '练气': 5, ... };
```

**重构后**：

这些全部从 `WorldBlueprint` 中读取：

```typescript
// world-blueprint.schema.ts 新增
export const RealmAdvancementRuleSchema = z.object({
  realm: z.string().describe('目标境界名'),
  requiredAttributes: z.record(z.string(), z.number())
    .describe('突破所需最低属性，key 匹配 attributeDefs.id'),
  costAttribute: z.string().describe('突破消耗的属性 ID'),
  costAmount: z.number().describe('突破消耗量'),
  lifespanExtension: z.number().describe('突破成功增加的寿元'),
  failurePenalty: z.number().describe('突破失败减少的寿元'),
});

// WorldBlueprint 新增字段
advancementRules: z.array(RealmAdvancementRuleSchema)
  .describe('14 个境界（除第一个）的突破规则'),
```

**引擎逻辑变化**：

```typescript
// rules.ts — RealmAdvancementChecker
// 旧: 从硬编码 REALM_ADVANCEMENT_THRESHOLDS 读取
// 新: 从 worldBlueprint.advancementRules 读取

checkRealmAdvancement(currentRealm, attributes, worldBlueprint) {
  const nextRealm = REALM_NAMES_ORDERED[realmOrder(currentRealm) + 1];
  const rule = worldBlueprint.advancementRules.find(r => r.realm === nextRealm);
  if (!rule) return { allowed: false, reason: 'No rule defined' };
  // 用 rule.requiredAttributes 检查属性门槛
  // key 是 AI 定义的属性 ID，不硬编码
}
```

### 1.3 年增长：从硬编码到 AI 定义

**现状**：

```typescript
// reducers.ts
const ANNUAL_ATTRIBUTE_GROWTH = {
  calculation: 1, geometry: 1, abstraction: 1, proof: 1,
  intuition: 1, focus: 2, physique: 2, family: 1,
};
```

**重构后**：

从 `WorldBlueprint.attributeDefs[].growthPerYear` 读取。

### 1.4 世界生成参数：从技术参数到角色扮演

**现状**：

```typescript
// api.ts
export interface GenerationPreferences {
  theme: string;      // "纯粹数学" — 技术参数
  scale: string;      // "small/medium/large" — 技术参数
  tone: string;       // "immersive" — 技术参数
  mode: string;       // "quick/complete/infinite" — 技术参数
  seed?: number;      // 随机种子 — 技术参数
}
```

前端让用户选"数学方向"和"推演模式"，这不是角色扮演。

**重构后**：

```typescript
export interface WorldPreferences {
  background: string;  // 出身背景，如 "寒门"/"世家"/"散修"/"遗孤"
  ambition: string;    // 人生志向，如 "长生"/"求真"/"权势"/"逍遥"
  era: string;         // 时代背景，如 "盛世"/"乱世"/"末法"
}
```

三个参数全是**角色扮演选择**：
- `background` → 影响初始属性分布
- `ambition` → 影响结局走向和事件倾向
- `era` → 影响世界氛围和难度曲线

**不再暴露**：theme, scale, tone, mode, seed。这些全部由后端自动处理。

### 1.5 Schema 字段清理

| Schema | 旧字段 | 新字段/处理 | 理由 |
|--------|--------|------------|------|
| `NpcSeed` | `mathematicalStrength: string?` | `specialty: string?` | NPC 的修行方向，不叫"数学强项" |
| `Faction` | `mathematicalDoctrine: string?` | `philosophy: string?` | 门派理念，不叫"数学教条" |
| `LegendaryFigure` | `mathematicalContribution: string?` | `legacy: string?` | 传奇遗产，不叫"数学贡献" |
| `WorldBlueprint` | `stateModel: Record<string, [number, number]>?` | `attributeDefs: AttributeDefSchema[]` + `advancementRules` | 从简单范围扩展为完整属性定义 |
| `GenerationPreferences` | 整个接口 | `WorldPreferences` | 角色扮演参数替代技术参数 |
| `AttributeNameEnum` | 硬编码 8 个枚举 | **删除** | 属性名由 AI 定义 |
| `AttributeSchema` | 固定 8 个字段的对象 | `z.record(z.string(), z.number())` | 动态属性映射 |

### 1.6 初始玩家状态：从硬编码到 AI 决定

**现状**：`generation.service.ts` 里硬编码了初始属性：

```typescript
attributes: {
  calculation: 10, geometry: 5, abstraction: 5, proof: 3,
  intuition: 5, focus: 10, physique: 20, family: 10,
},
```

**重构后**：初始属性由 AI 根据玩家的 `background` 选择在 WorldBlueprint 中生成。

WorldBlueprint 新增：

```typescript
export const StartingStateSchema = z.object({
  attributes: z.record(z.string(), z.number()).describe('初始属性值'),
  lifespan: z.number().describe('初始寿元'),
  startingLocationId: z.string().describe('初始位置 ID'),
  historySummary: z.string().describe('初始人生概要'),
});

// WorldBlueprint 新增
startingState: StartingStateSchema.describe('由 AI 根据 background 生成的初始玩家状态');
```

---

## 二、Prompt 重构

### 2.1 核心原则

Prompt 描述的是一个**玄幻大世界**，数学替代了传统修仙的灵气/功法/丹药体系。但具体怎么替代——叫什么名字、怎么分类——**全部由 AI 决定**。

### 2.2 world_generation prompt 改写要点

**删除**：
- `Theme hint: {{theme}}` / `Scale: {{scale}}` / `Generation mode: {{mode}}` / `Tone hint: {{tone}}` / `Seed: {{seed}}`
- "8 Attributes (DO NOT rename)" 的硬编码约束

**替换为**：
- `Background: {{background}}` / `Ambition: {{ambition}}` / `Era: {{era}}`
- 要求 AI 自行设计 5-8 个属性，每个属性必须融入"数学替代玄幻"的世界观
- 要求 AI 在 `advancementRules` 中为每个境界定义突破规则
- 要求 AI 在 `startingState` 中根据 `background` 设定初始属性

**prompt 核心段**：

```
你是一个玄幻大世界的造物主。这个世界以数学替代传统修仙的灵气、功法、丹药体系。

关键规则：
1. 14 个境界固定不变（炼体→练气→...→无限），但每个境界的突破条件由你定义
2. 你需要设计 5-8 个属性来描述一个人的修行资质，属性名和含义由你决定
   - 属性可以是修仙风格的（根骨、悟性、灵根、气运），也可以是数学风格的（计算、直觉、抽象）
   - 重要的是：这些属性在这个世界里要以数学概念来诠释
   - 例如：如果你定义了"灵根"属性，那么在这个世界里它可能叫"数根"，衡量对数学本质的亲和力
3. 门派的理念、NPC的专长、传说的遗产——都用数学语言来表达，但表达方式由你决定
4. 你生成的 startingState 必须匹配 background（出身背景）

玩家选择：
- 出身：{{background}}
- 志向：{{ambition}}
- 时代：{{era}}
```

### 2.3 其他 prompt 适配

- `npc_dialogue`：删除对固定 8 属性的引用，改为从上下文读取属性列表
- `event_generation`：`attributeEffects` 的 key 由 AI 自行决定，不再限定
- `ending_candidate`：无硬编码属性引用，无需改动
- `memory_summarizer`：无硬编码属性引用，无需改动

---

## 三、引擎代码重构

### 3.1 realm-constants.ts — 保留

14 境界的顺序常量保留，这是引擎骨架。

### 3.2 rules.ts — 大改

```typescript
// 删除
const REALM_ADVANCEMENT_THRESHOLDS = { ... };  // 硬编码 → 从 WorldBlueprint 读取

// RealmAdvancementChecker 改为接收 WorldBlueprint 参数
class RealmAdvancementChecker {
  checkRealmAdvancement(
    currentRealm: RealmName,
    attributes: Record<string, number>,  // 从 Attribute 类型变为动态 Record
    worldBlueprint: WorldBlueprint,      // 新增参数
  ): RuleCheckResult {
    const nextRealm = REALM_NAMES_ORDERED[realmOrder(currentRealm) + 1];
    const rule = worldBlueprint.advancementRules.find(r => r.realm === nextRealm);
    if (!rule) return { allowed: false, reason: `No rule for ${nextRealm}` };
    // 用 rule.requiredAttributes 检查，key 是 AI 定义的
    const failed: string[] = [];
    for (const [attrId, minVal] of Object.entries(rule.requiredAttributes)) {
      if ((attributes[attrId] ?? 0) < minVal) {
        failed.push(`${attrId}: ${attributes[attrId] ?? 0}/${minVal}`);
      }
    }
    if (failed.length > 0) return { allowed: false, reason: failed.join(', ') };
    return { allowed: true };
  }
}
```

### 3.3 reducers.ts — 大改

```typescript
// 删除所有硬编码常量
const ANNUAL_ATTRIBUTE_GROWTH = { ... };   // → 从 worldBlueprint.attributeDefs 读取
const BREAKTHROUGH_COST = { ... };         // → 从 worldBlueprint.advancementRules 读取
const LIFESPAN_EXTENSION = { ... };        // → 从 worldBlueprint.advancementRules 读取
const FAMILY_ATTRIBUTE_CAP = 30;           // → 从 worldBlueprint.attributeDefs[].cap 读取

// applyNextYearAction: 从 worldBlueprint.attributeDefs 读取增长值
for (const attrDef of worldBlueprint.attributeDefs) {
  const current = updatedAttributes[attrDef.id] ?? 0;
  const cap = attrDef.cap ?? attrDef.range[1];
  updatedAttributes[attrDef.id] = Math.min(cap, current + attrDef.growthPerYear);
}

// applyAttemptBreakthroughAction: 从 worldBlueprint.advancementRules 读取消耗和寿元
const rule = worldBlueprint.advancementRules.find(r => r.realm === nextRealm);
const consumptionAmount = rule.costAmount;
const lifespanExtension = rule.lifespanExtension;
const failurePenalty = rule.failurePenalty;
```

### 3.4 Attribute 类型变化

```typescript
// 旧: 固定类型
export type Attribute = {
  calculation: number;
  geometry: number;
  // ... 8 个固定字段
};

// 新: 动态类型
export type Attribute = Record<string, number>;
// key 由 WorldBlueprint.attributeDefs[].id 定义
```

所有引用 `Attribute` 的地方都需要适配：从 `attributes.calculation` 改为 `attributes[attrId]`。

### 3.5 generation.service.ts — 大改

```typescript
// 旧: 硬编码初始状态
const defaultPlayerState: PlayerState = {
  attributes: { calculation: 10, geometry: 5, ... },
  ...
};

// 新: 从 WorldBlueprint.startingState 读取
const defaultPlayerState: PlayerState = {
  name: '行者',
  age: 16,
  realm: '炼体',
  currentLocationId: data.startingState.startingLocationId,
  lifespan: data.startingState.lifespan,
  attributes: data.startingState.attributes,
  discoveredLocations: [data.startingState.startingLocationId],
  discoveredNpcs: [],
  discoveredClues: [],
  discoveredRumors: [],
  relationships: {},
  historySummary: data.startingState.historySummary,
};
```

---

## 四、前端重构

### 4.1 世界生成页面 (world-gen.tsx)

**删除**：
- 数学方向选择 (DIRECTIONS)
- 推演模式选择 (MODES)
- 随机种子输入

**替换为**：

```tsx
const BACKGROUNDS = ['寒门', '世家', '散修', '遗孤']
const AMBITIONS = ['长生', '求真', '权势', '逍遥']
const ERAS = ['盛世', '乱世', '末法']

// UI: 三个选择器，每个都是角色扮演语境
// "你的出身是..." / "你追求的是..." / "你身处..."
```

### 4.2 api.ts — toGenPref 替换

```typescript
// 旧
export function toGenPref(pref) {
  return {
    theme: pref.direction,
    scale: 'medium',
    tone: 'immersive',
    mode: 'complete',
    seed: pref.seed,
  };
}

// 新
export function toWorldPref(pref) {
  return {
    background: pref.background,
    ambition: pref.ambition,
    era: pref.era,
  };
}
```

### 4.3 属性面板组件

属性名不再固定，从 `worldBlueprint.attributeDefs` 读取显示名：

```tsx
// 旧: 硬编码属性名
<span>计算: {player.attributes.calculation}</span>

// 新: 从 blueprint 动态渲染
{blueprint.attributeDefs.map(def => (
  <span key={def.id}>{def.name}: {player.attributes[def.id]}</span>
))}
```

---

## 五、API 500 修复（不变，与 v1 相同）

### 5.1 紧急修复 (P0)

1. **AuditService 不再 re-throw** — 审计日志写入失败只记 logger.error
2. **WorldBlueprintSchema 放宽约束** — min 值调低
3. **attemptAutoRepair 增强** — 缺失数组填充空数组

### 5.2 结构修复 (P1)

4. **全局异常过滤器** — `AllExceptionsFilter`
5. **LlmService 错误降级** — 验证失败返回部分结果 + warnings

---

## 六、WorldBlueprint 完整 Schema（重构后）

```typescript
export const AttributeDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  range: z.tuple([z.number(), z.number()]),
  growthPerYear: z.number(),
  cap: z.number().optional(),
});

export const RealmAdvancementRuleSchema = z.object({
  realm: z.string(),
  requiredAttributes: z.record(z.string(), z.number()),
  costAttribute: z.string(),
  costAmount: z.number(),
  lifespanExtension: z.number(),
  failurePenalty: z.number(),
});

export const StartingStateSchema = z.object({
  attributes: z.record(z.string(), z.number()),
  lifespan: z.number(),
  startingLocationId: z.string(),
  historySummary: z.string(),
});

export const WorldBlueprintSchema = z.object({
  worldProfile: WorldProfileSchema,
  attributeDefs: z.array(AttributeDefSchema).min(5).max(8),
  advancementRules: z.array(RealmAdvancementRuleSchema).min(13).max(13),
  startingState: StartingStateSchema,
  factions: z.array(FactionSchema).min(2).max(5),
  locations: z.array(LocationSchema).min(3).max(7),
  npcs: z.array(NpcSeedSchema).min(3).max(7),
  clues: z.array(ClueSchema).min(2).max(15),
  rumors: z.array(RumorSchema).min(2).max(10),
  events: z.array(EventSeedSchema).min(2).max(8),
  endingCandidates: z.array(EndingCandidateSchema).min(2).max(5),
});
```

---

## 七、影响范围

### 需要修改的文件

| 文件 | 改动类型 | 优先级 |
|------|---------|--------|
| `packages/shared/src/schemas/world-blueprint.schema.ts` | 新增 AttributeDef/AdvancementRule/StartingState，删除 AttributeNameEnum | P0 |
| `packages/shared/src/schemas/game-state.schema.ts` | AttributeSchema 从固定对象变 z.record，删除 AttributeNameEnum 引用 | P0 |
| `packages/game-engine/src/constants/realm-constants.ts` | **不动** (14 境界顺序不变) | — |
| `packages/game-engine/src/rules/rules.ts` | 删除硬编码阈值，改为从 WorldBlueprint 读取 | P0 |
| `packages/game-engine/src/reducers/reducers.ts` | 删除硬编码增长/消耗/寿元，改为从 WorldBlueprint 读取 | P0 |
| `packages/ai/src/prompts/prompt-registry.ts` | 重写 world_generation + npc_dialogue + event_generation | P0 |
| `packages/shared/src/types/api.ts` | GenerationPreferences → WorldPreferences | P0 |
| `apps/api/src/dto/dto.ts` | GenerationPreferencesDto → WorldPreferencesDto | P0 |
| `apps/api/src/generation/generation.service.ts` | 参数适配 + 初始状态从 blueprint 读取 | P0 |
| `apps/api/src/game/game.service.ts` | Attribute 引用改为 Record 访问 | P1 |
| `apps/api/src/audit/audit.service.ts` | 移除 re-throw | P0 |
| `apps/web/src/routes/world-gen.tsx` | UI 重设计：出身/志向/时代 | P0 |
| `apps/web/src/lib/api.ts` | toGenPref → toWorldPref | P0 |
| `apps/web/src/components/` | 属性面板动态渲染 | P1 |

### 向后兼容性

**不兼容** — 破坏性重构。旧存档无法使用。清空数据库重新生成。

---

## 八、实施顺序

```
Phase 1 (P0, 紧急): API 500 修复
  ├─ 1.1 AuditService 移除 re-throw
  ├─ 1.2 WorldBlueprintSchema 放宽 min 约束
  └─ 1.3 全局异常过滤器

Phase 2 (核心): Schema + 引擎重构 — "无为"
  ├─ 2.1 world-blueprint.schema.ts 新增 AttributeDef/AdvancementRule/StartingState
  ├─ 2.2 game-state.schema.ts AttributeSchema 改为 z.record
  ├─ 2.3 rules.ts 删除硬编码阈值，从 WorldBlueprint 读取
  ├─ 2.4 reducers.ts 删除硬编码增长/消耗/寿元，从 WorldBlueprint 读取
  ├─ 2.5 GenerationPreferences → WorldPreferences
  └─ 2.6 generation.service.ts 初始状态从 blueprint.startingState 读取

Phase 3 (体验): Prompt + Frontend
  ├─ 3.1 world_generation prompt 重写（无为版）
  ├─ 3.2 npc_dialogue / event_generation prompt 适配
  ├─ 3.3 世界生成页面 UI：出身/志向/时代
  └─ 3.4 属性面板动态渲染
```

---

## 九、设计哲学对比

| 维度 | v1 (之前) | v2 (本方案) |
|------|-----------|------------|
| 境界 | 14 个，硬编码突破条件 | 14 个，**突破条件由 AI 定义** |
| 属性 | 8 个固定数学属性 | **5-8 个，AI 自行命名和定义** |
| 世界参数 | 技术 params (theme/scale/tone/mode/seed) | **角色扮演 params (background/ambition/era)** |
| 数学角色 | 喧宾夺主（属性名都是数学领域） | **世界观 DNA**（数学替代玄幻体系，但名称由 AI 决定） |
| 引擎职责 | 预设一切 | **只运转机制，不预设内容** |
| NPC 字段 | mathematicalStrength | **specialty**（修行方向，AI 决定怎么表达） |
| 门派字段 | mathematicalDoctrine | **philosophy**（门派理念，AI 决定内容） |
| 初始状态 | 硬编码 | **AI 根据 background 生成** |
| 突破消耗 | 硬编码每个境界 | **AI 在 advancementRules 中定义** |
| 年增长 | 硬编码 | **AI 在 attributeDefs.growthPerYear 中定义** |
