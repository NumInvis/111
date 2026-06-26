# AGENTS.md — 变分无限 (Variational Infinity)

AI-native math-xianxia life simulator. The LLM IS the game engine — it generates the world, narrates each year, offers choices, manages state, and drives endings. Code is the plumbing: call LLM, persist state, render UI.

---

## Architecture

| Layer | Tech | Purpose |
|-------|------|---------|
| Frontend | React 19 + Vite + Tailwind v4 | 1-page game UI on `:16543` |
| API | NestJS 11 + Prisma 6 | 3 endpoints on `:3000/api` |
| Database | PostgreSQL | 2 tables: Session + Message |
| LLM | OpenAI-compatible API | The game master — generates everything |

### Data flow

```
Browser (:16543)
  → POST /api/game/sessions          → LLM generates world + initial state → persist
  → POST /api/game/sessions/:id/action → LLM generates narrative + options + new state → persist
  → GET  /api/game/sessions/:id        → return state + message history
```

### What the LLM does (not code)

- Generates the world (locations, NPCs, clues, attributes, realm rules)
- Narrates each year's situation
- Offers 2-4 choices with real trade-offs
- Manages game state (attributes, age, realm, discoveries, relationships)
- Decides realm breakthrough, death, and endings
- Enforces rules (attribute bounds 0-100, age vs lifespan, realm hierarchy) through the prompt

### What code does (not LLM)

- Calls the LLM with the game master system prompt + current state
- Parses the LLM's JSON response (Zod shape validation, no business rules)
- Persists state to PostgreSQL
- Renders the UI

---

## Monorepo Structure

```
apps/
  api/           — NestJS backend (1 service, 1 controller, 5 files)
    src/
      main.ts            — bootstrap (CORS, prefix, listen)
      app.module.ts      — root module (ConfigModule + Prisma + GameController)
      game.service.ts    — the one service (inline schema + prompt + LLM fetch)
      game.controller.ts — 3 endpoints (create / get / action)
      prisma.service.ts  — Prisma client lifecycle
    prisma/
      schema.prisma      — 2 models (Session, Message)
  web/           — React frontend (1 page)
    src/
      main.tsx    — React entry
      App.tsx     — the one game page (state + narrative + options)
      index.css   — Tailwind v4 + Neo-Brutalist theme
```

### No packages

All shared packages (`@variational-infinity/shared`, `@variational-infinity/ai`, `@variational-infinity/game-engine`, `@variational-infinity/observability`) have been deleted. Everything is inlined into `apps/api/src/game.service.ts`.

---

## Build and Test Commands

### Setup

```bash
pnpm install
docker compose up -d
cp .env.example .env.local          # set AI_BASE_URL, AI_MODEL, AI_API_KEY, DATABASE_URL
pnpm db:push                        # push Prisma schema to Postgres
```

### Development

```bash
pnpm dev:api     # NestJS API on http://localhost:3000
pnpm dev:web     # React frontend on http://localhost:16543
```

### Other

```bash
pnpm typecheck   # TypeScript check
pnpm build       # build all
pnpm db:generate # regenerate Prisma client
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `AI_BASE_URL` | LLM provider base URL (e.g. `https://wincode.winning.com.cn/ai/v1`) |
| `AI_MODEL` | LLM model name (e.g. `deepseek-v4-flash`) |
| `AI_API_KEY` | LLM API key |
| `AI_TIMEOUT_MS` | LLM call timeout in ms (default 60000) |
| `DATABASE_URL` | PostgreSQL connection string |
| `VITE_API_BASE_URL` | Frontend API base URL (default `/api`) |

---

## Game Master Prompt

The system prompt in `game.service.ts` contains:
- The 14-realm world book (math levels from kindergarten to PhD)
- Rules for attribute bounds, age/lifespan, realm breakthrough, death, endings
- Instructions: generate narrative + options + full state each turn
- Output format: JSON with `narrative`, `options`, `state`, `status`

The LLM returns the FULL game state each turn (not a delta). Code stores it as-is. This is the core of "AI+Game" — the LLM is the sole state manager.

---

## Hard Constraints

- **NO mock/fallback**: LLM failures throw errors to the client. No MockProvider, no fallback blueprints.
- **Real API keys only on server**: The frontend never holds model keys.
- **No comments in code**: Do not add comments unless explicitly asked.
- **Do not modify `reference/`**: That directory is for architecture learning only.

---

## UI Style

Neo-Brutalist: thick black borders, hard shadows, zero rounded corners, `font-mono`, red/dark/cyan/green/purple palette. See `index.css` for Tailwind v4 theme tokens.

---

## What Doesn't Exist (by design)

- No shared packages — everything inlined
- No safety pipeline — the LLM is trusted as game master
- No audit/trace logging — game doesn't need enterprise observability
- No action reducers or state machine — the LLM manages state transitions
- No prompt registry — one system prompt, inline in the service
- No provider registry — one LLM endpoint, one `fetch()` call
- No CI/CD, no Dockerfiles, no production deployment
- No tests (yet)
