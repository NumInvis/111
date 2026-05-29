# 变分无限 — 游戏设计重构方案 v3

> 版本: v3.0 | 日期: 2026-05-29
> 核心原则: **无为** — AI 生成一切，引擎只运转机制
> 硬编码世界书: **14 境界 + 数学水平映射**
> 世界生成: **零参数** — 不需要玩家选择任何东西，AI 自行决定一切

---

## 零、设计哲学

### 三层架构

```
┌─────────────────────────────────────────────────┐
│  世界书（硬编码，开发者定义）                        │
│  ├─ 14 境界名称和顺序                              │
│  ├─ 每个境界对应的数学水平（教育阶段）               │
│  ├─ 天门 = 界壁（高考/大学入学），非境界             │
│  ├─ 积分 = 上下界真正门槛，下界人不知积分            │
│  └─ 无限 = 不可触及                                │
├─────────────────────────────────────────────────┤
│  AI 生成层（每次游戏不同）                           │
│  ├─ 属性体系（名称、范围、增长）                     │
│  ├─ 突破规则（阈值、消耗、寿元）                     │
│  ├─ 数学道路、功法、宗门、人物、事件                  │
│  ├─ 初始状态（属性值、出身、寿元）                    │
│  └─ 叙事内容（对话、事件文本、结局叙事）              │
├─────────────────────────────────────────────────┤
│  引擎层（机制，与内容无关）                          │
│  ├─ 回合推进（年循环）                              │
│  ├─ 属性运算（加减、clamp、阈值比较）                │
│  ├─ 事件路由（触发条件判定 → 选项 → 效果应用）       │
│  ├─ NPC 状态机（信任度、关系等级）                   │
│  ├─ 结局判定（证据检查 + 境界检查）                  │
│  └─ 状态持久化                                     │
└─────────────────────────────────────────────────┘
```

### 无为原则

> 世界生成不需要玩家选择任何参数。AI 自己决定出身、志向、时代——一切。

人生不能选择出身。你被抛入这个世界，开局就是随机的——这本身就是人生模拟器的核心体验。

### 数学替代玄幻——世界书

> 14 个境界映射到教育阶段。这不是"数学课"，是"人生的数学"——每个人从幼儿园出发，有人止步于小学，有人走到博士，极少数人触碰无限。

| 境界 | 对应数学水平 | 叙事地位提示 |
|------|-------------|-------------|
| 炼体 | 幼儿园 | 凡人起点，数数和基本数感 |
| 练气 | 小学1-2年级 | 入门修行，加减乘除 |
| 筑基 | 小学3-4年级 | 根基初成，分数与简单几何 |
| 本元 | 小学5-6年级 | 结构萌芽，方程与比例 |
| 通明 | 初一初二 | 洞察变化，代数与初等函数 |
| 化神 | 初三 | 小成，二次函数与概率 | 小 |
| 归一 | 高一高二 | 万法归一，解析几何与数列 |
| 渡劫 | 高三 | 天劫考验，高考数学的极限 |
| 天门 | 高考/大学入学 | **界壁，非境界** — 跨越即仙凡之别 |
| 仙境 | 大学低年级 | 仙境漫步，数学分析与线性代数 |
| 圣境 | 大学高年级 | 圣人境界，实分析与抽象代数 |
| 变分境 | 研究生 | 世界本源法则，变分法与泛函 |
| 天道境 | 数学系博士 | 万物之道，范畴论与前沿 |
| 无限 | 超越 | **不可触及** |

**关键规则**：

1. **积分是上下界的真正门槛**：渡劫之前的人不可能理解积分，天门之后的一切建立在积分之上。下界人不知积分的存在，正如凡人不知仙界的存在。
2. **天门是界壁**：不是第9个境界，而是从"下界"到"上界"的跨越。高考是凡人与仙人的分界线。
3. **无限不可触及**：即使天道境也只是在无限的门槛前张望，永远无法踏入。
4. **对话必须符合 NPC 境界**：炼体 NPC 不可能讨论方程，筑基 NPC 不可能讨论微积分。低阶 NPC 随意谈论高阶真理是严重的叙事违例。

---

## 一、架构重构

### 1.1 世界书——硬编码常量

```typescript
// packages/game-engine/src/constants/world-book.ts

export interface RealmMathLevel {
  realm: string;
  mathLevel: string;
  narrativeNote: string;
  isBoundaryWall: boolean;
  isUntouchable: boolean;
}

export const WORLD_BOOK_REALMS: RealmMathLevel[] = [
  { realm: '炼体',  mathLevel: '幼儿园',       narrativeNote: '凡人起点，数数和基本数感',          isBoundaryWall: false, isUntouchable: false },
  { realm: '练气',  mathLevel: '小学1-2年级',   narrativeNote: '入门修行，加减乘除',              isBoundaryWall: false, isUntouchable: false },
  { realm: '筑基',  mathLevel: '小学3-4年级',   narrativeNote: '根基初成，分数与简单几何',          isBoundaryWall: false, isUntouchable: false },
  { realm: '本元',  mathLevel: '小学5-6年级',   narrativeNote: '结构萌芽，方程与比例',             isBoundaryWall: false, isUntouchable: false },
  { realm: '通明',  mathLevel: '初一初二',       narrativeNote: '洞察变化，代数与初等函数',          isBoundaryWall: false, isUntouchable: false },
  { realm: '化神',  mathLevel: '初三',          narrativeNote: '小成，二次函数与概率',             isBoundaryWall: false, isUntouchable: false },
  { realm: '归一',  mathLevel: '高一高二',       narrativeNote: '万法归一，解析几何与数列',          isBoundaryWall: false, isUntouchable: false },
  { realm: '渡劫',  mathLevel: '高三',          narrativeNote: '天劫考验，高考数学的极限',          isBoundaryWall: false, isUntouchable: false },
  { realm: '天门',  mathLevel: '高考/大学入学',  narrativeNote: '界壁——跨越即仙凡之别',             isBoundaryWall: true,  isUntouchable: false },
  { realm: '仙境',  mathLevel: '大学低年级',     narrativeNote: '仙境漫步，数学分析与线性代数',      isBoundaryWall: false, isUntouchable: false },
  { realm: '圣境',  mathLevel: '大学高年级',     narrativeNote: '圣人境界，实分析与抽象代数',        isBoundaryWall: false, isUntouchable: false },
  { realm: '变分境', mathLevel: '研究生',        narrativeNote: '世界本源法则，变分法与泛函',        isBoundaryWall: false, isUntouchable: false },
  { realm: '天道境', mathLevel: '数学系博士',     narrativeNote: '万物之道，范畴论与前沿',           isBoundaryWall: false, isUntouchable: false },
  { realm: '无限',  mathLevel: '超越',          narrativeNote: '不可触及',                        isBoundaryWall: false, isUntouchable: true  },
];
```

导出给：
- **Prompt**：约束 AI 生成内容必须符合境界-数学映射
- **前端**：境界面板显示"筑基 · 小学3-4年级"
- **引擎**：`isBoundaryWall` 标记天门的特殊逻辑（可能有特殊的突破仪式）

### 1.2 属性体系：从硬编码到 AI 定义

**删除** `AttributeNameEnum`。属性名由 `WorldBlueprint.attributeDefs` 定义。

```typescript
export const AttributeDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  range: z.tuple([z.number(), z.number()]),
  growthPerYear: z.number(),
  cap: z.number().optional(),
});
```

AI 可能生成根骨/悟性/灵根/气运，也可能生成别的——开发者不预设。

### 1.3 突破规则：从硬编码到 AI 定义

**删除** `REALM_ADVANCEMENT_THRESHOLDS` / `BREAKTHROUGH_COST` / `LIFESPAN_EXTENSION`。

```typescript
export const RealmAdvancementRuleSchema = z.object({
  realm: z.string(),
  requiredAttributes: z.record(z.string(), z.number()),
  costAttribute: z.string(),
  costAmount: z.number(),
  lifespanExtension: z.number(),
  failurePenalty: z.number(),
});
```

但 AI 生成时必须参照世界书——筑基（小学3-4）的突破门槛不可能涉及微积分，天门（高考）的突破必须以积分为核心考验。

### 1.4 世界生成：零参数

**无玩家输入**。API 只需 sessionId。

```typescript
// 旧: POST /api/generation/world/:sessionId  Body: { theme, scale, tone, mode, seed }
// v2: POST /api/generation/world/:sessionId  Body: { background, ambition, era }
// v3: POST /api/generation/world/:sessionId  Body: {}
```

### 1.5 Schema 字段清理

| Schema | 旧字段 | 新字段 | 理由 |
|--------|--------|--------|------|
| `NpcSeed` | `mathematicalStrength` | `specialty` | NPC 修行方向 |
| `Faction` | `mathematicalDoctrine` | `philosophy` | 门派理念 |
| `LegendaryFigure` | `mathematicalContribution` | `legacy` | 传奇遗产 |
| `AttributeNameEnum` | 8 个固定枚举 | **删除** | AI 定义 |
| `AttributeSchema` | 固定 8 字段 | `z.record` | 动态映射 |
| `GenerationPreferences` | 整个接口 | **删除** | 零参数 |
| `EventOption.attributeEffects` | `Record<AttributeNameEnum, number>` | `Record<string, number>` | AI 定义 key |

### 1.6 初始玩家状态

从 `WorldBlueprint.startingState` 读取，AI 自由决定出身和初始属性。

---

## 二、Prompt 重构

### 2.1 world_generation prompt

```
你是变分无限的造物主——一个以数学替代传统修仙的玄幻大世界。

## 世界书（硬编码，不可更改）

| 境界 | 对应数学水平 | 叙事地位提示 |
|------|-------------|-------------|
| 炼体 | 幼儿园 | 凡人起点，数数和基本数感 |
| 练气 | 小学1-2年级 | 入门修行，加减乘除 |
| 筑基 | 小学3-4年级 | 根基初成，分数与简单几何 |
| 本元 | 小学5-6年级 | 结构萌芽，方程与比例 |
| 通明 | 初一初二 | 洞察变化，代数与初等函数 |
| 化神 | 初三 | 小成，二次函数与概率 |
| 归一 | 高一高二 | 万法归一，解析几何与数列 |
| 渡劫 | 高三 | 天劫考验，高考数学的极限 |
| 天门 | 高考/大学入学 | 界壁——跨越即仙凡之别 |
| 仙境 | 大学低年级 | 仙境漫步，数学分析与线性代数 |
| 圣境 | 大学高年级 | 圣人境界，实分析与抽象代数 |
| 变分境 | 研究生 | 世界本源法则，变分法与泛函 |
| 天道境 | 数学系博士 | 万物之道，范畴论与前沿 |
| 无限 | 超越 | 不可触及 |

关键规则：
1. 积分是上下界的真正门槛。渡劫之前的人不可能理解积分；天门之后的一切建立在积分之上。下界人不知积分的存在。
2. 天门是界壁而非境界——跨越天门就是从"下界"到"上界"，如同从凡人成为仙人。
3. 无限不可触及——即使天道境也只是在无限门前张望。
4. 对话必须符合 NPC 境界。炼体 NPC 不可能讨论方程，筑基 NPC 不可能讨论微积分。

## 你需要生成

1. **属性体系** (5-8个)：定义这个世界的修行资质维度
   - 属性名和含义由你决定
   - 属性在这个世界里以数学概念来诠释，但属性名本身不一定要包含数学术语
   - 这是修仙世界，数学是内在法则，不是外在标签
   - 例如：你可以定义"根骨"属性，它在修仙世界衡量先天资质，在数学世界对应"算术直觉"

2. **突破规则** (13条)：对应练气→无限
   - 突破条件必须与该境界的数学水平呼应
   - 筑基（小学3-4）的突破条件不可能涉及微积分
   - 天门（高考）的突破必须以积分相关能力为核心考验
   - 定义突破消耗属性、消耗量、寿元增加、失败惩罚

3. **初始玩家状态**：
   - 你决定这个角色的出身
   - 初始属性分布体现出身特征

4. **世界内容**：门派、地点、NPC、事件、线索、传闻、结局候选
   - NPC 的 specialty 应与其境界对应的数学水平匹配
   - 门派的 philosophy 应以数学语言表达，但使用该门派平均境界的数学水平
   - 渡劫及以下的门派/人物不可能理解积分

5. **叙事基调**：你来决定这个世界是黑暗残酷还是轻松诙谐

无玩家输入参数——你来创造一切。
输出 WorldBlueprint JSON。
```

### 2.2 npc_dialogue prompt

关键新增：注入世界书的境界-数学映射，约束 NPC 言谈。

```
...
## 境界-数学映射（必须严格遵守）
[世界书表格]

规则：
- 炼体 NPC 只能谈论数数和日常，不可能讨论方程
- 筑基 NPC 可以讨论分数和简单几何，不可能讨论函数
- 渡劫 NPC 在高考的极限中挣扎，可以讨论高中数学，不知积分
- 天门之后才能讨论微积分和线性代数
- 让低境界 NPC 随意谈论高阶真理是严重的叙事违例
...
```

### 2.3 event_generation prompt

`attributeEffects` 的 key 由 AI 决定，不再限定为固定 8 个属性名。

### 2.4 ending_candidate / memory_summarizer

无硬编码属性引用，无需改动。

---

## 三、引擎代码重构

### 3.1 新增 world-book.ts

```typescript
// packages/game-engine/src/constants/world-book.ts
// 见 1.1 节完整代码
```

### 3.2 realm-constants.ts — 保留

14 境界顺序常量不变。

### 3.3 rules.ts — 大改

- 删除 `REALM_ADVANCEMENT_THRESHOLDS`
- `RealmAdvancementChecker` 接收 `WorldBlueprint` 参数
- 从 `worldBlueprint.advancementRules` 读取突破阈值

### 3.4 reducers.ts — 大改

- 删除 `ANNUAL_ATTRIBUTE_GROWTH` / `BREAKTHROUGH_COST` / `LIFESPAN_EXTENSION` / `FAMILY_ATTRIBUTE_CAP`
- 年增长从 `worldBlueprint.attributeDefs` 读取
- 突破消耗/寿元从 `worldBlueprint.advancementRules` 读取

### 3.5 Attribute 类型

```typescript
// 旧: 固定类型
export type Attribute = { calculation: number; geometry: number; ... };
// 新: 动态类型
export type Attribute = Record<string, number>;
```

### 3.6 generation.service.ts — 大改

```typescript
// 旧: generateWorld(sessionId, preferences)
// 新: generateWorld(sessionId) — 无 preferences

async generateWorld(sessionId: string): Promise<WorldBlueprint> {
  const worldBookStr = WORLD_BOOK_REALMS.map(
    r => `${r.realm}|${r.mathLevel}|${r.narrativeNote}`
  ).join('\n');

  const prompt = this.promptRegistry.render('world_generation', {
    worldBook: worldBookStr,
  });
  // ... LLM 调用 ...

  // 初始状态从 blueprint.startingState 读取
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
}
```

---

## 四、前端重构

### 4.1 世界生成页面

**一个按钮**：

```tsx
function WorldGenPage() {
  const handleGenerate = async () => {
    setLoading(true);
    const session = await createSession();
    setSessionId(session.id);
    const blueprint = await generateWorld(session.id);  // 无参数
    setWorldBlueprint(blueprint);
    const playerState = await getGameState(session.id);
    setPlayer(playerState);
    navigate({ to: '/explore' });
  };

  return (
    <div className="text-center py-20">
      <h2>开天辟地</h2>
      <p>AI 将为你创造一个独一无二的修行世界</p>
      <Button onClick={handleGenerate}>踏入灵墟</Button>
    </div>
  );
}
```

### 4.2 境界面板

```tsx
const realmInfo = WORLD_BOOK_REALMS.find(r => r.realm === player.realm);
<span>{player.realm} · {realmInfo?.mathLevel}</span>
```

显示效果："筑基 · 小学3-4年级"

### 4.3 属性面板

```tsx
{blueprint.attributeDefs.map(def => (
  <div key={def.id}>
    <span>{def.name}: {player.attributes[def.id]}</span>
  </div>
))}
```

### 4.4 api.ts

```typescript
export async function generateWorld(sessionId: string): Promise<WorldBlueprint> {
  const res = await fetch(`${API_BASE}/api/generation/world/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),  // 空 body
  });
  return res.json();
}
```

---

## 五、API 500 修复

1. AuditService 移除 re-throw
2. WorldBlueprintSchema 放宽 min 约束
3. 全局异常过滤器
4. LlmService 错误降级

---

## 六、WorldBlueprint 完整 Schema（v3）

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

| 文件 | 改动类型 | 优先级 |
|------|---------|--------|
| `packages/game-engine/src/constants/world-book.ts` | **新增** | P0 |
| `packages/shared/src/schemas/world-blueprint.schema.ts` | 大改 | P0 |
| `packages/shared/src/schemas/game-state.schema.ts` | 大改 | P0 |
| `packages/game-engine/src/rules/rules.ts` | 大改 | P0 |
| `packages/game-engine/src/reducers/reducers.ts` | 大改 | P0 |
| `packages/ai/src/prompts/prompt-registry.ts` | 重写 | P0 |
| `packages/shared/src/types/api.ts` | 删除 GenerationPreferences | P0 |
| `apps/api/src/dto/dto.ts` | 删除 GenerationPreferencesDto | P0 |
| `apps/api/src/generation/generation.controller.ts` | Body 可空 | P0 |
| `apps/api/src/generation/generation.service.ts` | 零参数 + startingState | P0 |
| `apps/api/src/game/game.service.ts` | Attribute→Record | P1 |
| `apps/api/src/audit/audit.service.ts` | 移除 re-throw | P0 |
| `apps/web/src/routes/world-gen.tsx` | 一个按钮 | P0 |
| `apps/web/src/lib/api.ts` | generateWorld 无参 | P0 |
| `apps/web/src/components/` | 动态属性面板 | P1 |

---

## 八、实施顺序

```
Phase 1 (P0, 紧急): API 500 修复
  ├─ 1.1 AuditService 移除 re-throw
  ├─ 1.2 WorldBlueprintSchema 放宽 min 约束
  └─ 1.3 全局异常过滤器

Phase 2 (核心): Schema + 引擎重构 — "无为"
  ├─ 2.1 新增 world-book.ts 世界书常量
  ├─ 2.2 world-blueprint.schema.ts 新增 AttributeDef/AdvancementRule/StartingState，删除 AttributeNameEnum
  ├─ 2.3 game-state.schema.ts AttributeSchema 改为 z.record
  ├─ 2.4 rules.ts 删除硬编码阈值，从 WorldBlueprint 读取
  ├─ 2.5 reducers.ts 删除硬编码增长/消耗/寿元，从 WorldBlueprint 读取
  ├─ 2.6 删除 GenerationPreferences，generation 接口零参数
  └─ 2.7 generation.service.ts 初始状态从 startingState 读取

Phase 3 (体验): Prompt + Frontend
  ├─ 3.1 world_generation prompt 重写（零参数+世界书版）
  ├─ 3.2 npc_dialogue prompt 加入境界-数学映射约束
  ├─ 3.3 event_generation prompt 适配动态属性
  ├─ 3.4 世界生成页面：一个按钮
  └─ 3.5 境界/属性面板动态渲染
```

---

## 九、关键设计决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 境界名 | 硬编码 | 用户要求 |
| 境界数学水平 | 硬编码（教育阶段映射） | 世界观基因，NPC 对话的约束基础 |
| 积分门槛 | 硬编码（渡劫前不知积分） | 上下界的核心叙事分界 |
| 天门定位 | 界壁非境界 | 高考=仙凡分界 |
| 无限 | 不可触及 | 终极追求，永远到不了 |
| 属性名 | AI 生成 | 无为——开发者不预设 |
| 突破规则 | AI 生成 | 无为——引擎不预设 |
| 世界参数 | 无（零参数） | 无为——人生不能选择出身 |
| 功法/宗门/事件 | AI 生成 | 无为——开发者不预设 |
