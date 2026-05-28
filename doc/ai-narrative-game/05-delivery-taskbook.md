# 交付任务书

## 1. 交付目标

交付一个浏览器可访问、可独立运行的 AI 原生开放世界游戏原型。作品必须包含完整游戏体验闭环，而不是功能展示页。

最终交付物：

- 在线可访问游戏链接。
- 可运行源码。
- 环境变量模板。
- 演示说明。
- AI 创作说明。
- 安全体系说明。

## 2. 参赛闭环定义

必须能被评审独立体验：

1. 打开游戏。
2. 生成或加载一个 AI 世界。
3. 创建角色或进入默认角色。
4. 执行探索行动。
5. 与 AI NPC 对话。
6. 产生状态变化和旅记。
7. 触发至少一个结局。
8. 查看总结并重开。

## 3. 阶段计划

### 阶段一：工程底座

产出：pnpm monorepo、React Web、NestJS API、shared schema、Prisma、基础 UI、Mock Provider。

完成标准：前后端可启动，健康检查可用，无 Key 可跑通 mock 世界生成。

### 阶段二：世界生成与游戏会话

产出：World Blueprint schema、Generation Service、世界生成页、世界概览页、session 创建。

完成标准：AI 或 Mock 能生成结构化世界，前端能展示地点、NPC、势力和事件。

### 阶段三：探索与人生事件

产出：Game State schema、Action/Event 模型、探索页、下一年事件、状态更新、旅记。

完成标准：玩家行动能改变状态并留下日志。

### 阶段四：AI NPC 与记忆

产出：对话页、Dialogue Agent、对话记录、Memory Summarizer、SSE 流式输出。

完成标准：至少一个 NPC 能自由对话并引用过去事件。

### 阶段五：结局与重开

产出：Ending Candidate、结局裁决、结局页、人生总结、重开入口。

完成标准：至少一条规则可触发结局，结局展示证据链。

### 阶段六：文本体验打磨

产出：事件文本模板、NPC 对话质量规则、旅记文本格式、结局总结格式、空状态与错误提示文案。

完成标准：无视觉、音频、视频资产依赖时，玩家仍能通过文字完成一局游戏并理解状态变化。

### 阶段七：安全、测试与部署

产出：Prompt 注入检测、字段 allowlist、审计日志、基础测试、浏览器部署链接。

完成标准：公开链接可访问，核心路径可演示，安全事件可追踪。

## 4. 任务拆分

### EPIC-001 工程底座

- TASK-001 检查并修复 monorepo 启动脚本。
- TASK-002 完成前端路由与页面骨架。
- TASK-003 完成 API 健康检查和 CORS。
- TASK-004 确认 shared schema 可被前后端引用。
- TASK-005 补齐 `.env.example` 和 provider 配置示例。

### EPIC-002 AI 世界生成

- TASK-006 固化 World Blueprint schema。
- TASK-007 完成世界生成 prompt 版本管理。
- TASK-008 完成 Generation API 与前端联调。
- TASK-009 完成 Mock Provider 兜底展示。
- TASK-010 将生成结果持久化并创建 session。

### EPIC-003 游戏运行时

- TASK-011 定义 Game Action、Event、State schema。
- TASK-012 实现探索 action 裁决。
- TASK-013 实现下一年事件生成。
- TASK-014 实现状态更新 reducer。
- TASK-015 实现旅记记录。

### EPIC-004 AI NPC

- TASK-016 定义 NPC 对话输入输出 schema。
- TASK-017 实现对话 API。
- TASK-018 实现 SSE 流式回复。
- TASK-019 实现记忆摘要和读取。
- TASK-020 在 UI 中展示记忆引用。

### EPIC-005 结局系统

- TASK-021 定义 Ending Candidate schema。
- TASK-022 实现结局触发条件。
- TASK-023 实现结局裁决和证据链。
- TASK-024 实现结局页。
- TASK-025 实现重开。

### EPIC-006 安全与审计

- TASK-026 强化 Prompt 注入检测。
- TASK-027 实现输出字段 allowlist。
- TASK-028 实现 Key 和 Authorization 日志脱敏。
- TASK-029 实现 safety event 展示。
- TASK-030 实现 LLM call 审计查询。

### EPIC-007 文本打磨与部署

- TASK-031 打磨事件文本模板。
- TASK-032 打磨 NPC 对话质量规则。
- TASK-033 打磨旅记、结局和错误提示文案。
- TASK-034 创建 Docker Compose 或简化部署脚本。
- TASK-035 部署 Web 与 API。

## 5. P0 任务

P0 是参赛必须完成项：

- 世界生成可用。
- 探索可用。
- NPC 对话可用。
- 旅记可用。
- 结局可用。
- Mock Provider 可用。
- 浏览器在线链接可用。

## 6. P1 任务

P1 是增强评审观感项：

- SSE 流式对话。
- 长期记忆。
- 调试审计页。
- 文本质量评估与坏输出重试。
- 安全事件可视化。
- 多局重开继承。

## 7. P2 任务

P2 是赛后扩展项：

- 完整 Python Agent Service。
- CrewAI 多 Agent 编排。
- LangGraph checkpoint。
- pgvector 记忆检索。
- MCP / A2A。
- Docker Compose 全栈一键启动。
- Playwright 完整 E2E。

## 8. Definition of Done

每个功能完成必须满足：

- 有 schema。
- 有 API 或明确前端入口。
- 有错误处理。
- 有 Mock 兜底。
- 有安全检查。
- 有状态记录或审计记录。
- 能被评审在浏览器中看到效果。
