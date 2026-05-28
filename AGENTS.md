# AGENTS.md — 变分无限 (Variational Infinity)

AI-native math-xianxia life simulator. Player progresses year-by-year through 14 cultivation realms, grows 8 attributes, triggers endings. AI generates all world content; humans define schemas, safety boundaries, state rules, and engineering.

---

## Hard Constraints

- **NO mock/fallback anywhere**: `MockProvider`, fallback blueprint, fallback dialogue, `generate_mock_*` — all banned. LLM failures throw errors to the client. Both TS (`LlmService`) and Python (`agents/*.py`) enforce this — `ValueError`/`Error` if provider config missing.
- **Schema-first**: Zod (TS) in `packages/shared/src/schemas/` is single source of truth. AI output must `safeParse` before entering business logic. Python schemas in `apps/agent-service/app/schemas/models.py` mirror TS schemas via Pydantic v2.
- **Real API keys only on server**: Frontend never holds model keys. `VITE_*` env vars are for UI config only.
- **No comments in code**: Do not add any comments unless explicitly asked.
- **Do not modify `reference/open-source/`**: Only for architecture learning.

---

## Commands

```bash
pnpm install                    # install all deps
pnpm dev:web                    # React frontend (Vite, port 16543)
pnpm dev:api                    # NestJS API (nest watch, port 3000)
pnpm dev:agent                  # Python Agent Service (uvicorn, port 8000)
pnpm build                      # build all packages
pnpm typecheck                  # TypeScript check all packages
pnpm test                       # run all tests (currently none exist)
pnpm db:generate                # generate Prisma client
pnpm db:push                    # push Prisma schema to PostgreSQL
pnpm db:migrate                 # create + run migration
```

Prerequisites: PostgreSQL must be running at `DATABASE_URL` before `db:push`/`db:migrate`. No Docker Compose exists — start Postgres manually. The API crashes on startup if `AI_BASE_URL` is empty — `.env.local` must have real LLM provider config (no `mock` provider exists).

---

## Monorepo Structure

| Package | `package.json` name | Path alias | Has real code? |
|---------|---------------------|------------|---------------|
| `apps/api` | `@variational-infinity/api` | `@vi/shared`, `@vi/ai`, `@vi/game-engine`, `@vi/observability` | Yes — NestJS with 6 modules |
| `apps/web` | `@mythweaver/web` | `@/*` → `src/*` | Yes — React 19, Zustand, TanStack Router |
| `apps/agent-service` | (Python — `pyproject.toml`) | — | Yes — FastAPI, 5 Pydantic AI agents |
| `packages/shared` | `@variational-infinity/shared` | — | Yes — Zod schemas + API types |
| `packages/ai` | `@variational-infinity/ai` | — | Yes — ProviderRegistry, PromptRegistry, 5 safety pipelines |
| `packages/game-engine` | `@variational-infinity/game-engine` | — | Yes — state machine, 7 reducers, 4 rule checkers |
| `packages/observability` | `@variational-infinity/observability` | — | Yes — createTraceId, formatLatency, AuditContext |

---

## API (NestJS)

**Entry**: `apps/api/src/main.ts` — global prefix `/api`, port from `PORT` env (default 3000), bare CORS (`enableCors()` with no options).

**Modules** (registered in `AppModule`):
- `ConfigModule` (isGlobal), `PrismaModule`, `LlmModule`, `SafetyModule`, `AuditModule`, `GenerationModule`, `GameModule`

**Controllers and routes** (all under `/api/` prefix):

| Route | Method | Controller |
|-------|--------|------------|
| `/api/game/sessions` | POST | GameController — create session |
| `/api/game/sessions/:id` | GET | GameController — get session |
| `/api/game/sessions/:id/actions` | POST | GameController — apply action |
| `/api/game/sessions/:id/next-year` | POST | GameController — advance year |
| `/api/game/sessions/:id/state` | GET | GameController — get player state |
| `/api/game/sessions/:id/endings` | GET | GameController — check endings |
| `/api/game/sessions/:id/end` | POST | GameController — end session |
| `/api/game/sessions/:id/dialogue` | POST | GameController — start dialogue |
| `/api/generation/world/:sessionId` | POST | GenerationController — generate world |
| `/api/generation/world/:sessionId` | GET | GenerationController — get blueprint |
| `/api/llm/providers` | GET | LlmController — provider info |
| `/api/` | GET | AppController — root |
| `/api/health` | GET | AppController — health check |

**No `.js` import extensions**: API imports do NOT use `.js` extensions (e.g. `'./app.module'`, `'@nestjs/core'`). The `.js` convention was removed — `tsc` with `moduleResolution: "bundler"` does not resolve `.js` extensions in node_modules, and `nest build` uses the `swc` builder which ignores them anyway.

**`nest build` uses swc**: Configured in `nest-cli.json` with `"builder": "swc"` and `"tsConfigPath": "tsconfig.json"` (not `tsconfig.build.json`). The `swc` builder compiles successfully; `tsc --noEmit` works for type checking with `moduleResolution: "bundler"` since it skips resolution validation. Do not switch back to `tsc` builder or add `.js` extensions. **SWC on Windows requires `baseUrl: "."` in tsconfig** — without it, SWC panics with "failed to canonicalize jsc.baseUrl" UNC path error.

**tsconfig path aliases** resolve to `../../packages/*/src/index.ts` — these are TypeScript path mappings, not bundler aliases. Runtime resolution relies on pnpm workspace links.

**No Pino logger**: `nestjs-pino` is NOT installed. The API uses NestJS default `Logger`. Do not add Pino unless explicitly requested.

**Redis/BullMQ**: Listed in `package.json` dependencies but NOT registered in any module or used in any code. Do not assume Redis is operational.

**LlmService** (`apps/api/src/llm/llm.service.ts`):
- Uses a local `ProviderRegistryWrapper` (not directly `@vi/ai`'s `ProviderRegistry`)
- `onModuleInit()` throws if `AI_BASE_URL` is missing — no mock provider registered
- `generateWithSchema()`: calls provider → `safeParse` → single `attemptAutoRepair` → throws on failure
- Only provider file: `apps/api/src/llm/providers/openai-compatible.provider.ts` (NestJS `@Injectable()` wrapper around `@vi/ai`'s `OpenaiCompatibleProvider`)
- Real implementation: `packages/ai/src/providers/openai-compatible.ts` — fetch-based, 30s/60s timeout, SSE streaming, API key redaction

**SafetyService** (`apps/api/src/safety/safety.service.ts`):
- Delegates to 5 pipelines from `@vi/ai`: `InputSafety`, `OutputSafety`, `FieldAllowlist`, `ReferenceIntegrity`, `SizeLimit`
- `fullOutputCheck()` runs output + allowlist + reference integrity + size limit in sequence
- 13 injection patterns, 7 secret patterns, output injection patterns (`<<`, `[system]`, `### system`)

**GenerationService** (`apps/api/src/generation/generation.service.ts`):
- Throws `Error` on safety check failure — NO fallback blueprint. Do not add one.

**GameService** (`apps/api/src/game/game.service.ts`):
- Imports and uses `GameStateMachine`, `ActionValidator`, `EndingArbitrator`, `RealmAdvancementChecker`, and all reducers from `@vi/game-engine`
- Valid actions: `move`, `talk`, `next_year`, `discover`, `investigate`, `rest`, `trade`
- Initial player state: name='行者', age=16, realm='炼体', 8 attributes

---

## Game Engine (`packages/game-engine`)

- **GameStateMachine**: 7 phases (`initializing`, `exploring`, `dialoguing`, `event`, `ending_check`, `ended`, `death`), 10 transitions with conditions
- **14 realms**: 炼体→练气→筑基→本元→通明→化神→归一→渡劫→天门→仙境→圣境→变分境→天道境→无限
- **8 attributes**: 计算/几何/抽象/证明/直觉/专注/体魄/家世 (0–100)
- **7 reducers**: `move`, `talk`, `nextYear`, `discover`, `investigate`, `eventChoice`, `realmAdvancement` — each produces `JournalEntry` + `GameEvent`
- **4 rule checkers**: `EndingArbitrator` (requiredEvidence + requiredRealm), `ActionValidator`, `StateBoundsChecker`, `RealmAdvancementChecker` (attribute thresholds per realm)

---

## Agent Service (Python FastAPI)

**Entry**: `apps/agent-service/app/main.py` — all routes under `/api/agent/` prefix.

**Routes**: `/api/agent/` (health), `/api/agent/world`, `/api/agent/npc`, `/api/agent/event`, `/api/agent/ending`, `/api/agent/memory`

**5 Pydantic AI agents**: `world_generator`, `npc_agent`, `event_agent`, `ending_director`, `memory_agent` — each raises `ValueError` if no LLM provider configured. No CrewAI or LangGraph — only `pydantic-ai`.

**Env vars**: `AGENT_LLM_PROVIDER`, `AGENT_LLM_BASE_URL`, `AGENT_LLM_MODEL`, `AGENT_LLM_API_KEY` (separate from NestJS's `AI_*` vars). Also `AGENT_NESTJS_API_URL` for calling back to NestJS.

**Run with**: `cd apps/agent-service && uv run uvicorn app.main:app --reload --port 8000`

**Safety pipeline** (`app/safety/pipeline.py`): mirrors TS safety — injection/secret/output patterns + reference integrity + field allowlist.

---

## Frontend (React)

**Dev server**: port **16543** (not default 5173). Proxy `/api` → `http://localhost:3000`.

**Routing**: TanStack Router file-based — auto-generates `routeTree.gen.ts`. Routes: `/` (index), `/world-gen`, `/explore`, `/dialogue`, `/journal`, `/ending`.

**State**: Zustand store at `stores/gameStore.ts` — uses `immer` `produce` for immutable updates. Fields: `sessionId`, `preference`, `worldBlueprint`, `player`, `currentYear`, `journal`, `messages` (Record<string, DialogueMessage[]>), `activeEvent` (EventSeed), `availableEndings` (EndingCandidate[]), `phase` (GamePhase enum), `error`, `loading`.

**API client**: `lib/api.ts` — real endpoints, no mock. Unwraps `ApiResponse<T>` wrapper (throws if `success` is false). Functions: `createSession`, `getSession`, `getGameState`, `applyAction`, `generateWorld`, `getWorldBlueprint`, `nextYear`, `startDialogue`, `checkEndings`, `endSession`, `getProviders`, `toGenPref` (converts UI mode names to GenerationScale/GenerationMode enums).

**Types**: `types/index.ts` — defines `REALMS` (14 names), `ATTRIBUTE_LABELS` (8 attribute key→Chinese name map), `WorldPreference`, `WorldBlueprint` (with `events`, `endingCandidates`, full `NpcSeed`/`EventSeed`/`EventOption`), `PlayerState` (8 attributes via `Attribute` interface, `currentLocationId`, `discoveredLocations/Npcs/Clues/Rumors`, `relationships`, `historySummary`), `JournalEntry` (with `category`, `evidenceTag`, `locationId`, `action`, `result`), `DialogueMessage`, `EndingCandidate`, `StateUpdate`, `ApiResponse<T>`, `GenerationPreferences`, `GenerationScale`, `GenerationMode`.

**UI components**: Neo Brutalism — `Button`, `Card`, `EventCard`, `NPCProfile`, `Panel`, `ProgressBar`, `StatusPanel`, `Tag`. Style: thick black borders (`border-3`), hard shadows (`4px 4px 0px #000`), gold/玄黑/赤/青/绿/紫 palette, `Space Mono` + `Noto Sans SC` fonts, zero rounded corners.

---

## Shared Schemas (`packages/shared`)

- `world-blueprint.schema.ts`: `RealmIdEnum`, `RealmNameEnum`, `CultivationPathSchema`, `CultivationTierSchema`, `NpcSeedSchema` (with `mathematicalStrength`), `EventSeedSchema`, `EndingCandidateSchema`, `LegendaryFigureSchema`, `PowerSystemSchema`
- `game-state.schema.ts`: `PlayerStateSchema` (8 attributes), `GameActionSchema`, `GameEventSchema`, `DialogueMessageSchema`, `JournalEntrySchema`, `EventTypeEnum`, `JournalCategoryEnum`
- `agent.schema.ts`: `MemoryEntrySchema`, `AgentCallLogSchema`, `SafetyEventSchema`
- `types/api.ts`: `ApiResponse`, `GenerationPreferences`, `GenerationMode` enum, `LlmProviderInfo`

---

## Prisma Schema

12 models: `User`, `GameSession`, `WorldBlueprint`, `GameState`, `DialogueMessage`, `WorldEvent`, `JournalEntry`, `AgentMemory`, `LlmCall`, `SafetyEvent`, `PromptVersion`, `ProviderConfig`. Database: `variational_infinity` on PostgreSQL.

---

## Prompt Registry

`packages/ai/src/prompts/prompt-registry.ts` — 5 built-in prompts with `{{var}}` template syntax:
- `world_generation`, `npc_dialogue`, `event_generation`, `ending_candidate`, `memory_summarizer`

All AI calls must use `PromptRegistry.render()`, never build prompts manually in services.

---

## Safety Pipeline (TS)

`packages/ai/src/safety/safety-pipeline.ts` — 5 pipeline classes:
- `InputSafetyPipeline` — 13 injection patterns, threshold 0.8
- `OutputSafetyPipeline` — 7 secret patterns + output injection patterns
- `FieldAllowlistPipeline` — extra field detection
- `ReferenceIntegrityPipeline` — validates locationId/npcId/factionId/requiredRealm against known IDs
- `SizeLimitPipeline` — default 50KB JSON limit

All AI output must pass `fullOutputCheck()` before entering business logic.

---

## pnpm Workspace Gotchas

- `pnpm-workspace.yaml` `allowBuilds` has placeholder strings `"set this to true or false"` for several packages — these are not boolean values and will cause `pnpm approve-builds` to prompt interactively. Run `pnpm approve-builds` manually after `pnpm install`.
- `onlyBuiltDependencies` in root `package.json` only lists `esbuild`. After adding new native deps, you may need to add them here or approve builds.
- API `@nestjs/config` is **v4** (not v11) — different major version from `@nestjs/common`/`@nestjs/core` v11.

---

## What Doesn't Exist Yet

- No tests (Vitest/Jest configured but zero test files)
- No Docker Compose (start PostgreSQL manually)
- No CI/CD
- No Pino logger integration
- No Redis/BullMQ usage in code
- No Playwright E2E tests
- No OpenTelemetry (observability package has basic trace/audit helpers only)