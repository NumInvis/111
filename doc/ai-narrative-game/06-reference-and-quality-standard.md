# 参考资料与质量标准

## 1. 使用原则

参考项目只用于学习架构、模块划分、交互组织和工程实践。禁止直接复制代码、角色设定、地图结构和受版权限制的文本内容。

## 2. 开源参考结论

| 参考 | 学习点 | 本项目采用方式 |
| --- | --- | --- |
| ai-town | AI 角色在共享世界中社交和活动 | NPC 需要地点、目标、关系和记忆 |
| generative_agents | 记忆流、反思、计划、时间步模拟 | NPC 采用观察、记忆、反思、回应的简化模式 |
| BrowserQuest | 浏览器 RPG 世界、实体、服务端分层 | 采用 World、Location、NPC、Action 世界模型 |
| rot.js | 地图生成、视野、随机探索 | 首版采用节点地图和随机传闻 |
| inkjs | 交互叙事状态、选择、变量 | 关键节点和结局由确定性状态控制 |
| phaser-template-vite | Web 游戏工程结构和资源加载 | 如后续引入 Phaser，可复用工程思路 |
| zustand | action 驱动状态管理 | 前端 GameState 用轻量 store 管理 |
| Pydantic AI | 类型安全 Agent、结构化输出 | World Generator 和 Ending Director 优先采用 |
| CrewAI | 多 Agent 协作、Flows、Memory | NPC 和 Event Agent 可采用 Crew 编排 |
| LangGraph | 状态图、checkpoint、HITL | 游戏主循环和 Agent durable execution 参考 |
| Hermes Function Calling | Pydantic Schema 驱动工具调用 | 所有工具调用必须结构化 |
| AutoGen | AgentTool、MCP、A2A 思路 | 后续用于 Agent 互操作，不照搬旧架构 |

## 3. 不建议照搬

- 不照搬 generative_agents 的完整研究原型结构，首版做简化可运行版本。
- 不照搬 BrowserQuest 的多人架构，当前不做多人。
- 不照搬 AI Town 的 Convex 依赖，除非后续确定云状态平台。
- 不照搬已有角色设定、地名、剧情桥段或受版权保护的文本内容。
- 不照搬 AutoGen 旧架构，仅学习 AgentTool 和 A2A 思想。

## 4. 工程质量标准

### 4.1 Schema First

- 所有共享数据结构先写 schema，再写业务代码。
- TypeScript 端 Zod 是共享 schema 单一真相源。
- Python 端 Pydantic schema 必须与 JSON Schema 保持一致。
- AI 返回结果必须先 parse，再进入业务逻辑。

### 4.2 状态治理

- 状态变更必须以 action/event 形式记录。
- AI 输出只能生成 candidate。
- Game Service 负责裁决 candidate 是否生效。
- 任何生成内容必须有 generationId、promptVersion、model、seed、traceId。

### 4.3 安全治理

- 真实 Key 只在后端使用。
- 前端不得持有真实模型 Key。
- 日志必须脱敏 Authorization header。
- Prompt 注入和敏感信息输出必须被检测。
- Safety event 必须可追踪。

### 4.4 可观测性

- 每次模型调用有 traceId。
- 每次关键状态变更有事件记录。
- 每次结局触发有证据链。
- 错误信息可定位到 session、generation 或 llm call。

## 5. 测试标准

最低测试要求：

- Schema 单元测试：World Blueprint、Game State、Dialogue、Ending。
- API 测试：世界生成、创建 session、提交 action、对话。
- 前端冒烟测试：首页、世界生成页、探索页、对话页、结局页能渲染。
- 安全测试：Prompt 注入输入不会泄露 Prompt 或 Key。
- Mock 测试：无 Key 环境能完整跑通。

推荐 E2E：

1. 打开首页。
2. 点击生成世界。
3. 进入探索页。
4. 执行一次探索 action。
5. 与 NPC 对话。
6. 打开旅记。
7. 触发或模拟结局。

## 6. 参赛验收清单

### 游戏完整性

- 有开始页。
- 有世界生成或加载流程。
- 有玩家可交互行动。
- 有 NPC 对话。
- 有状态变化。
- 有旅记或日志。
- 有结局页。
- 有重开入口。

### AI 创作体现

- AI 生成世界观与剧情基础。
- AI 生成 NPC 或对话。
- AI 生成事件或结局候选。
- AI 生成旅记摘要或人生总结。
- AI 生成文本安全策略候选或评估结果。
- AI 参与安全体系设计或评估。

### 技术要求

- 浏览器可访问。
- 前端不保存真实 Key。
- 后端代理模型调用。
- Mock Provider 可离线演示。
- 数据结构有 schema 校验。
- 部署说明清晰。

### 安全要求

- Agent 行为受限。
- 玩家身份或 session 有校验。
- 数据交互有 schema 校验。
- 异常输入能被记录。
- 敏感信息不出现在公开日志或前端。

## 7. 主要风险与应对

| 风险 | 表现 | 应对 |
| --- | --- | --- |
| 只像聊天应用 | 评审看不到游戏闭环 | 强制实现探索、状态、结局和重开 |
| AI 输出不稳定 | JSON 无法解析或内容越权 | Schema、auto repair、Mock 降级 |
| 工程范围过大 | Agent Service、记忆、部署都做不完 | P0 先在 NestJS 内跑通，P2 再拆服务 |
| Key 泄露 | 前端或日志出现密钥 | 后端代理、日志脱敏、环境变量注入 |
| 文本版权风险 | 套用已有小说角色、地名或桥段 | 只生成原创世界内容，禁止指向具体受版权作品 |
| 数学题门槛过高 | 玩家不会玩 | 玩家不解题，数学只作为叙事隐喻 |

## 8. 最终评审叙事

对外讲解时使用以下主线：

`变分无限`不是把 AI 接到游戏里的聊天功能，而是让 AI 参与世界构建、角色表演、事件生成、旅记总结、结局生成和安全分析。玩家每次进入的世界都不同，NPC 会根据记忆和状态回应，故事从文字交互中涌现。规则层负责裁决状态和结局，保证 AI 有创造力但不越权。
