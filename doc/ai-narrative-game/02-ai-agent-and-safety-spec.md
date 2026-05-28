# AI Agent 与安全规格

## 1. AI 创作边界

AI 在本项目中承担内容总设计师、NPC 表演者、叙事导演和安全分析助手的角色。

AI 负责生成：

- 世界观设定、背景故事、历史脉络、势力关系和规则体系。
- 地点、NPC、NPC 目标、秘密、关系和记忆种子。
- 探索事件、传闻、异象、候选后果和结局候选。
- 旅记摘要、人生总结、结局文本。
- IOA 安全策略候选，包括 Agent 行为安全、身份鉴权、数据校验和异常识别规则。

AI 不允许直接：

- 写入数据库核心状态。
- 绕过 Game Service 或规则引擎。
- 解锁未校验内容。
- 泄露 Prompt、Key、内部配置或调试信息。
- 生成恶意脚本、越权字段或可执行攻击指令。

## 2. AI 服务分层

| 层级 | 职责 | 输出 |
| --- | --- | --- |
| World Generator | 生成完整 World Blueprint | 结构化世界 JSON |
| Agent Generator | 生成 NPC 角色卡、目标、秘密、关系和记忆种子 | NPC seeds |
| Event Generator | 生成探索事件、年度事件、传闻和候选后果 | Event candidates |
| Dialogue Agent | 根据上下文生成 NPC 回复 | Dialogue response |
| Memory Summarizer | 压缩对话与事件，生成可检索记忆 | Memory entries |
| Ending Director | 生成结局候选文本 | Ending candidates |
| Safety Agent | 生成或评估 IOA 安全策略候选 | Safety policy candidates |

## 3. Agent 架构

```text
Web Client
  -> NestJS API Gateway
     -> Game Service
     -> LLM Gateway
     -> Safety Service
     -> Audit Service
     -> Agent Service (FastAPI)
        -> World Generator Agent (Pydantic AI)
        -> NPC Agent Crew (CrewAI)
        -> Event Agent Crew (CrewAI)
        -> Game Flow Graph (LangGraph-style)
        -> Memory Provider
        -> Tool Layer
```

Agent 工程原则：

- Agent 不是一个大模型调用，而是由 Schema、Tools、Memory、State Graph、Safety Pipeline 和 Audit Log 组合而成。
- World Generator 和 Ending Director 优先使用结构化输出。
- NPC 和 Event 适合使用 Crew 式协作与上下文传递。
- 游戏主循环适合使用状态图编排。
- 所有工具调用必须有参数 schema 和返回 schema。
- 需要影响关键状态的工具必须走裁决或 Human-in-the-Loop。

## 4. LLM Gateway

业务服务不得直接调用第三方模型 SDK，必须通过 LLM Gateway 统一模型接入。

支持 Provider：

- `mock`
- `openai-compatible`
- `custom`
- `future.tencent-cloud`

能力要求：

- Key 注入。
- 模型路由。
- 超时、重试、限流和熔断。
- JSON Mode 或结构化输出。
- token 统计。
- 日志脱敏。
- traceId 贯穿。
- 失败时降级到 Mock Provider。

Mock Provider 是硬性要求。无 Key、模型失败或输出不合格时，游戏仍必须能完整运行。

## 5. Schema First

所有 AI 输出进入业务前必须经过：

1. JSON parse。
2. Schema validation。
3. Safety scan。
4. Field allowlist。
5. Size limit。
6. Reference integrity check。
7. Persistence transaction。

不合格输出处理：

- 自动修复一次。
- 修复失败则丢弃。
- 记录 safety event。
- 回退 Mock Provider 或请求用户重试。

## 6. Prompt 管理

Prompt 必须版本化，不能散落在业务服务中。

每次 AI 调用必须记录：

- `promptVersion`
- `model`
- `provider`
- `seed`
- `temperature`
- `inputHash`
- `outputHash`
- `latencyMs`
- `tokenUsage`
- `safetyResult`
- `structuredOutputValid`
- `toolsCalled`
- `checkpointId`

## 7. Memory 系统

短期记忆存储在当前会话 GameState 中，长期记忆持久化到数据库。

记忆条目建议字段：

```json
{
  "id": "memory_001",
  "npcId": "npc_001",
  "content": "玩家曾在天门试炼中救过此 NPC。",
  "memoryType": "observation",
  "importance": 0.82,
  "source": "dialogue",
  "createdAt": "2026-05-27T00:00:00Z"
}
```

检索策略：向量相似度、重要性、时间衰减和权限过滤混合排序。NPC 只能读取自己被授权访问的记忆。

## 8. IOA 游戏安全体系

参赛要求中的游戏 IOA 安全体系在本项目中落为以下最小闭环。

### 8.1 Agent 行为安全

- NPC 只能基于授权上下文回复。
- AI 输出只能作为 candidate，不能直接修改状态。
- 关键状态变更由 Game Service 裁决。
- 结局必须有旅记证据链。

### 8.2 玩家身份鉴权

- 每个游戏会话绑定 sessionId。
- 后端校验 session 与 worldBlueprint 的归属关系。
- 管理调试接口与普通游戏接口分权。

### 8.3 数据交互校验

- 前端提交 action 时只允许白名单字段。
- 后端用 Zod 校验请求体。
- AI 输出字段必须通过 allowlist。
- 所有状态变更以 action/event 形式记录。

### 8.4 异常行为识别

- Prompt 注入检测：识别 `ignore previous`、`system prompt`、`admin mode`、`debug mode` 等模式。
- 敏感信息检测：识别 `api_key`、`secret`、`password`、`authorization`、`bearer`、`sk-` 等。
- 高频请求限流。
- 异常 action 记录 safety event。

### 8.5 信息脱敏

- 真实 Key 只在服务端环境变量中使用。
- 前端不得保存或展示真实 Key。
- 日志不得打印 Authorization header。
- 公开演示内容通过 HaS-Anonymizer 或等价流程脱敏。

## 9. Agent 验收标准

- AI 能生成完整 World Blueprint。
- AI NPC 能保持角色一致性并引用记忆。
- Prompt 注入不能导致规则泄露或状态越权。
- 模型失败时系统可降级。
- 每次模型调用可追踪、可审计、可回放。
- 至少一个安全事件能被检测、记录并在调试页查看。
