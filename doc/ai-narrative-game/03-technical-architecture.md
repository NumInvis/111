# 技术架构规格

## 1. 架构目标

本项目采用浏览器 Web + NestJS Game Service + Python Agent Service 的双语言架构。目标是在参赛阶段交付可独立运行的游戏原型，同时保留企业级工程边界，避免把 AI 调用、状态变更和安全审核写成不可维护的脚本。

## 2. 总体架构

```text
Web Client (React + Vite)
  -> API Gateway / BFF (NestJS, /api)
     -> Generation Service
     -> Game Service
     -> LLM Gateway
     -> Safety Service
     -> Audit Service
     -> Prisma / PostgreSQL
     -> Redis / BullMQ (queue/cache)
     -> Agent Service (FastAPI, planned)
        -> Pydantic AI / CrewAI / LangGraph
```

## 3. 前端技术栈

- React 19。
- Vite 6。
- TypeScript strict mode。
- TanStack Router 文件路由。
- TanStack Query v5。
- Zustand。
- Tailwind CSS v4。
- Radix UI。
- Framer Motion。
- React Hook Form + Zod。
- Vitest + React Testing Library。

前端职责：

- 世界生成交互。
- 探索、对话、旅记和结局 UI。
- 流式 AI 输出展示。
- 本地临时状态和错误提示。
- 不保存生产真实 Key。
- 只调用业务 API，不直接调用模型厂商 SDK。

## 4. 后端技术栈

- Node.js 22 LTS。
- NestJS v11。
- TypeScript strict mode。
- Prisma v6。
- PostgreSQL。
- Redis + BullMQ。
- SSE 流式输出。
- Zod validation。
- Pino structured logging。
- OpenTelemetry 预留。

后端职责：

- API Key 管理。
- LLM Provider 调用。
- 世界生成。
- 游戏状态持久化。
- action 裁决。
- schema 校验。
- 内容安全。
- 审计和回放。
- 限流和熔断。

## 5. Agent Service 技术栈

Agent Service 尚未创建，规划使用：

- Python 3.12+。
- FastAPI + uvicorn。
- Pydantic v2。
- Pydantic AI。
- CrewAI。
- LangGraph。
- httpx。
- asyncpg 或 SQLAlchemy。
- OpenTelemetry。

职责：

- World Generator Agent。
- NPC Agent Crew。
- Event Agent Crew。
- Ending Director Agent。
- Memory Provider。
- Durable Execution checkpoint。
- Agent 级 Safety Pipeline。
- 与 NestJS 通过 REST/SSE 通信。

## 6. Monorepo 结构

```text
apps/
  web/                  # React 前端
  api/                  # NestJS API Gateway + Game Service
  agent-service/        # Python Agent 微服务，待创建
packages/
  shared/               # Zod schema 与共享类型
  ai/                   # TS provider、prompt、安全工具
  game-engine/          # 状态机、规则引擎、reducers，待实现
  observability/        # OpenTelemetry helpers，待实现
config/
  ai-providers.example.json
doc/
  ai-narrative-game/
```

## 7. 核心服务

### 7.1 Generation Service

根据玩家偏好和 seed 调用 LLM，生成 World Blueprint。

职责：prompt 组装、模型调用、schema 校验、自动修复、版本入库、失败回退 Mock Provider。

### 7.2 Game Service

负责游戏状态机和裁决。

职责：创建 session、应用 action、校验合法性、生成状态变更事件、触发探索事件、裁决结局候选。

### 7.3 LLM Gateway

统一接入 mock、openai-compatible、custom 和 future.tencent-cloud provider，提供超时、重试、降级、token 统计和日志脱敏。

### 7.4 Safety Service

负责输入安全、Prompt 注入检测、输出安全、字段 allowlist、敏感信息脱敏和 safety event 记录。

### 7.5 Audit Service

记录 LLM 调用、状态变更、安全事件、traceId、模型信息、token 使用和 structured output 校验结果。

## 8. 数据库模型

核心模型：

- `User`：玩家。
- `GameSession`：游戏会话。
- `WorldBlueprint`：AI 生成世界蓝图。
- `GameState`：每回合状态快照。
- `DialogueMessage`：NPC 对话记录。
- `WorldEvent`：世界事件。
- `AgentMemory`：NPC 记忆。
- `LlmCall`：模型调用审计。
- `SafetyEvent`：安全事件。
- `PromptVersion`：Prompt 版本。
- `ProviderConfig`：Provider 配置。

## 9. 配置与 Key

配置入口：

- `.env.example`
- `.env.local`，本地私有，不提交。
- `config/ai-providers.example.json`

服务端变量：

- `AI_PROVIDER`
- `AI_BASE_URL`
- `AI_MODEL`
- `AI_API_KEY`
- `DATABASE_URL`
- `REDIS_URL`
- `SESSION_SECRET`

前端变量只允许控制 UI 行为：

- `VITE_API_BASE_URL`
- `VITE_AI_PROVIDER_LABEL`

原则：真实 Key 只在后端使用，禁止提交仓库，禁止进入前端构建产物。

## 10. AI 输出入库流程

1. 前端提交生成偏好。
2. API 创建 generation job。
3. LLM Gateway 调用模型。
4. Safety Service 做输入输出检查。
5. Generation Service 做 schema 校验。
6. 自动修复一次不合格 JSON。
7. 仍失败则回退 Mock Provider。
8. World Blueprint 入库。
9. Game Service 创建 session。
10. 前端展示可探索世界。

## 11. 部署形态

参赛推荐：

- Web：静态构建后部署到可公开访问环境。
- API：容器或云函数式服务。
- DB：PostgreSQL 托管或比赛环境内置服务。
- Redis：如时间不足可先不作为硬依赖。
- Agent Service：首版可由 NestJS 内置 Agent 调用路径替代，后续拆分 FastAPI。

上线要求：

- 浏览器能直接访问。
- 无 Key 时使用 Mock Provider 完整演示。
- 有 Key 时由后端代理调用真实模型。
- 日志脱敏。
- API 健康检查可用。
