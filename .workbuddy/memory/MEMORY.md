# Project Memory — 变分无限 (Variational Infinity)

## Architecture
- Monorepo: pnpm workspace, 3 apps + 4 packages
- **API**: NestJS 11, SWC build, Prisma 6 + PostgreSQL 16, port 3000, prefix `/api`
- **Web**: React 19, Vite 6, TanStack Router, Zustand + Immer, Tailwind v4, port 16543
- **Agent Service**: Python FastAPI, pydantic-ai, port 8000, prefix `/api/agent`
- **Packages**: shared (Zod schemas), ai (providers + safety), game-engine (state machine + reducers + rules), observability

## Key Conventions
- No comments in code unless asked
- No mock/fallback — LLM failures throw errors
- Schema-first: Zod TS schemas in `packages/shared/src/schemas/` are source of truth; Python Pydantic in `apps/agent-service/app/schemas/models.py` mirrors them
- SWC builder for NestJS, `baseUrl: "."` required in tsconfig for Windows
- No `.js` import extensions in API
- No Pino logger — uses NestJS default Logger
- Redis/BullMQ in deps but NOT used in code
- `USE_AGENT_BRIDGE=true` (default) delegates NPC dialogue and ending eval to Python Agent Service

## Game Mechanics
- 14 realms: 炼体→练气→筑基→本元→通明→化神→归一→渡劫→天门→仙境→圣境→变分境→天道境→无限
- World Book: each realm maps to math level (幼儿园/小学1-2/小学3-4/小学5-6/初一初二/初三/高一高二/高三/高考/大学低/大学高/研究生/博士/超越)
- 天门 = 界壁 (boundary wall), not a realm. 积分 = upper/lower boundary threshold. 无限 = untouchable.
- All other content (attrs, breakthrough, events, NPCs) → AI-generated, zero player params
- **REDESIGN v3**: 14 realms KEPT + math level hardcoded as "world book" (幼儿园→小学→初中→高中→大学→研究生→博士→超越). Integration = upper/lower boundary threshold. 天门 = boundary wall (界壁), not realm. 无限 = untouchable.
- **无为原则**: Engine = mechanism only. AI = ALL content (attrs, breakthrough rules, growth rates, events, NPC, world). Zero player params for world gen.
- **World Book** (hardcoded): Realm→MathLevel mapping constrains NPC dialogue and world gen. Low-realm NPCs cannot discuss high-realm math.
- **Zero-param world gen**: No GenerationPreferences/WorldPreferences. Just click "开天辟地" and AI generates everything.
- Schema: AttributeNameEnum DELETED → attributeDefs array; AttributeSchema → z.record; advancementRules/startingState added to WorldBlueprint
- 9 action types: move, talk, next_year, discover, investigate, event_choice, end_dialogue, resolve_event, attempt_breakthrough
- Breakthrough: consume primary attribute, extend lifespan; failure: lose 2 years lifespan
- Annual: attributes grow naturally, events trigger by conditions
- Endings: evidence-based, must discover required clues + meet realm thresholds
- State machine phases: initializing→exploring↔dialoguing↔event↔ending_check→ended/death
- **Design philosophy**: Math = world-building flavor, NOT game mechanic. Life sim is core.

## Safety
- 5 pipelines: InputSafety, OutputSafety, FieldAllowlist, ReferenceIntegrity, SizeLimit
- 13 injection patterns (CN+EN), 7 secret patterns, output injection patterns
- Threshold: injection score ≥ 0.8 = blocker
- **FIXED**: FieldAllowlistPipeline, ReferenceIntegrityPipeline, SizeLimitPipeline now return `safe: false, severity: 'blocker'` on violations (was `safe: true, severity: 'warning'`)
- **FIXED**: Python pipeline.py same fix applied

## Audit History (4 rounds)
- R1: 112 findings (8 CRIT/27 HIGH/48 MED/29 LOW). Blockers: API key exposed, no max_tokens, client-trusted attributeEffects, lifespan<0, Python safety bypassed, Python memory no persist, TS↔Python schema mismatch, prompt template injection
- R2: 3-party joint review. 6 Blockers: {{mode}} template missing, autoRepair dead code, clue chain broken, Python Agent zero integration, NPC list always empty, cross-schema inconsistency. 12 debates → 13 verdicts (single AI path, single schema source, YAML prompts, safety 3-tier, schema validation single-point, data writes transactional, gameplay loop first)
- R3: 20/27 R1 issues fixed, 7/8 gameplay loop closed. 10 verdicts (body→physique, breakthrough cost mapping, nestjs-zod pipe, Python keep no integrate, trust persist, family growth+cap, lifespan extension, Chinese journal templates, tsc skip, NPC filter fix)
- R4: Strict final. **9 deceptive implementations** exposed (SSE dead code, ZodPipe empty, audit null-write, OTel shell, Redis dead dep, memoryRefs decorative, Python Agent 100% dead, Safety allowlist skipped, StateMachine not driving). Design doc vs implementation: 2 fatal/16 gaps/4 deceptive. Key: MockProvider contractually required but code bans mock. role=z.enum(['npc']) silently blocks dialogue. Python clues missing.

## Critical Issues Status (updated from R4)
- ✅ C1: NpcDialogueOutputSchema.role z.enum(['npc']) → z.string() FIXED
- C2: MockProvider must be implemented (design doc hard requirement, no-key=no-game)
- ✅ C3: Python WorldBlueprint already has clues field
- C4: StatusPanel shows locationId not location name
- ✅ D-type: FieldAllowlistPipeline/ReferenceIntegrityPipeline always safe:true → FIXED now blocker
- ✅ D-type: persistStateUpdate missing field merges → FIXED all arrays + relationships
- ✅ D-type: StateMachine not driving → FIXED phase persisted, StateMachine drives transitions
- D-type: SSE/stream marked @internal
- D-type: ZodValidationPipe no per-route schema
- D-type: audit 5 fields null-write
- D-type: memoryRefs never filled
- D-type: Python Agent 100% dead code
- ✅ Safety allowlist skipped → FIXED FieldAllowlistPipeline now blocks
- docker-compose password vs Python config conflict

## Phase Persistence (NEW)
- Prisma GameState has `phase String @default("initializing")` field
- GameService.loadPlayerState returns `{ playerState, phase }`
- applyAction/nextYear use GameStateMachine for validation + phase transition
- startDialogue loads phase from DB instead of hardcoding
- Controller getState returns phase alongside playerState
- **NOTE**: Must run `npx prisma generate` (DLL lock issue — stop running processes first)

## Schema Migration (v3 Redesign — COMPLETED)
- AttributeNameEnum DELETED → AttributeDefSchema (3-12 dynamic attrs)
- AttributeSchema → z.record(z.string(), z.number()) — dynamic key-value
- REALM_ADVANCEMENT_THRESHOLDS DELETED → RealmAdvancementRuleSchema (AI-generated per world)
- ANNUAL_ATTRIBUTE_GROWTH/BREAKTHROUGH_COST/LIFESPAN_EXTENSION DELETED → from WorldBlueprint.attributeDefs + advancementRules
- GenerationPreferences/GenerationScaleEnum/GenerationModeEnum DELETED → zero-param world gen
- WorldBlueprint: added attributeDefs, advancementRules, startingState; removed stateModel
- Field renames: mathematicalStrength→specialty, mathematicalDoctrine→philosophy, mathematicalContribution→legacy
- EventOptionSchema.attributeEffects: from z.record(AttributeNameEnum) → z.record(z.string())
- RealmAdvancementChecker: now takes advancementRules[] in constructor (not hardcoded thresholds)
- World Book: created as packages/game-engine/src/constants/world-book.ts with 14 realm→mathLevel mappings
- Python schemas (models.py): synced all above changes, added AttributeDef/RealmAdvancementRule/StartingState
- Frontend: ATTRIBUTE_KEYS/ATTRIBUTE_LABELS DELETED → dynamic from WorldBlueprint.attributeDefs
- World gen page: removed direction/mode/seed selectors → single "开天辟地" button
- gameStore: removed preference/setPreference
- All prompts rewritten: world_generation v3 (zero-param + world book), npc_dialogue v3 (realm-math constraints), event_generation v3 (dynamic attr names)
- Build: all packages + apps pass typecheck and build

## API 500 Issues (diagnosed 2026-05-29)
- Root cause: LLM JSON fails WorldBlueprintSchema strict validation + AuditService re-throw + no global exception filter
- Fix plan: AuditService remove re-throw, Schema relaxation (min counts), AllExceptionsFilter, LLM error degradation
- See: doc/REDESIGN_PROPOSAL_v3.md Phase 1

## LLM
- OpenAI-compatible provider only, `response_format: json_object`
- Auto-repair: type coercion, min/max clamping, default filling
- Retry: 3x with exponential backoff on 429/502/503/network errors
- 5 built-in prompts: world_generation, npc_dialogue, event_generation, ending_candidate, memory_summarizer
- Prompt attribute names: use "physique" not "body" (was a CRITICAL mismatch)
