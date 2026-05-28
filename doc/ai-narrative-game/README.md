# 变分无限：AI 原生开放世界游戏文档包

## 项目定位

**变分无限**是一个浏览器可访问、可独立运行的 AI 原生数学玄幻开放探索叙事游戏原型。玩家进入一个由 AI 生成的开放世界，在节点地图中探索、与具备独立人格和记忆的 AI NPC 自由对话，并通过选择、行动和对话自然形成涌现式故事。

参赛目标不是展示某个孤立功能、关卡或插件，而是交付一个有开始、有核心循环、有结束条件的完整游戏原型。

## 设计任务书约束

- 作品必须是完整游戏原型，不是现有游戏中的单一功能模块。
- 作品必须部署到浏览器环境，并提供可直接访问的在线链接。
- 游戏必须具备明确玩法目标、可交互核心机制、开始流程与结束流程。
- 世界观、剧情、NPC 对话、事件文本、结局文本和 IOA 安全体系均应体现 AI 创作能力。
- 本作品定位为纯文字游戏，不涉及视觉资产、音频资产、视频增强或配音交付。
- 鼓励使用 CodeBuddy、CodeBuddy Genie、EdgeOne 安全加速 Skill、HaS-Anonymizer 等工具链完成代码创作、安全和部署。

## 一句话体验

玩家从一个数学玄幻世界中的低阶修行者开始，通过 AI 生成的人生事件、地点探索和 NPC 对话，选择自己的修行道路，发现世界秘密，推动势力关系变化，最终抵达死亡、飞升、失败、成圣或突破无限等结局。

## 核心差异化

- **AI 共创世界**：世界观、势力、地点、NPC、事件、传闻、结局候选由 AI 生成。
- **数学修为体系**：数学理解深度对应玄幻境界，但玩家不需要解数学题，数学只作为叙事与能力表现的底层隐喻。
- **涌现式叙事**：故事不是预写线性剧本，而是从玩家行动、AI NPC 记忆、世界状态和事件生成中自然生长。
- **Agent 化 NPC**：NPC 拥有角色卡、目标、记忆、情绪、关系和可访问上下文，不是一次性聊天机器人。
- **安全可审计**：AI 输出不能直接改写核心状态，只能生成 candidate，由规则层裁决并记录审计日志。

## 文档结构

本目录整合为 7 份可维护文档：

- `01-game-design-brief.md`：游戏定位、玩法闭环、世界元规则、核心机制。
- `02-ai-agent-and-safety-spec.md`：AI 创作分层、Agent 架构、LLM Gateway、IOA 安全体系。
- `03-technical-architecture.md`：前后端、后端、Agent Service、数据库、配置和部署架构。
- `04-text-ux-guide.md`：纯文字游戏 UX、事件卡片、状态面板、对话块和旅记规范。
- `05-delivery-taskbook.md`：参赛交付任务书、阶段计划、任务拆分、优先级。
- `06-reference-and-quality-standard.md`：开源参考、质量标准、验收清单、风险控制。
- `README.md`：项目总览和阅读入口。

## 推荐阅读顺序

1. 先读 `01-game-design-brief.md`，确认做的是完整游戏原型。
2. 再读 `02-ai-agent-and-safety-spec.md`，明确 AI 生成边界和安全边界。
3. 读 `03-technical-architecture.md`，确认工程落地方式。
4. 读 `04-text-ux-guide.md`，统一纯文字交互体验。
5. 读 `05-delivery-taskbook.md`，按阶段开发。
6. 读 `06-reference-and-quality-standard.md`，做最终验收。

## 当前工程状态

- `apps/web`：React + Vite 前端，已有核心页面骨架，仍以 Mock 数据为主。
- `apps/api`：NestJS API，已有 LLM Gateway、世界生成、游戏状态、安全、审计和 Prisma Schema。
- `apps/agent-service`：尚未创建，Python Agent 微服务待实现。
- `packages/shared`：已有 Zod Schema 和共享类型。
- `packages/ai`：已有 Provider Registry 和 Prompt Registry 基础实现。
- `packages/game-engine`：空壳，状态机和规则引擎待实现。
- `packages/observability`：空目录，OpenTelemetry 辅助工具待实现。

## 最小可参赛闭环

1. 浏览器打开游戏首页。
2. 玩家配置世界偏好并生成 World Blueprint。
3. 玩家创建角色并进入节点地图。
4. 玩家点击探索或下一年，系统生成事件与选项。
5. 玩家与至少 1 个 AI NPC 自由对话，NPC 能引用上下文和记忆。
6. 玩家行动改变状态、旅记和关系。
7. 达成死亡、突破、失败或飞升等结局。
8. 结局页展示 AI 生成总结、关键证据、审计追踪和重开入口。
