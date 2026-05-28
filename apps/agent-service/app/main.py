from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import health, world, npc, event, ending, memory
from app.dependencies import Settings

settings = Settings()

app = FastAPI(title="Variational Infinity Agent Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:16543", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if not settings.llm_provider or not settings.llm_base_url:
    raise ValueError("AGENT_LLM_PROVIDER and AGENT_LLM_BASE_URL must be configured. No mock/fallback provider is available.")

if not settings.llm_api_key:
    raise ValueError("AGENT_LLM_API_KEY must be configured. No mock/fallback provider is available.")

app.include_router(health.router, prefix="/api/agent")
app.include_router(world.router, prefix="/api/agent/world")
app.include_router(npc.router, prefix="/api/agent/npc")
app.include_router(event.router, prefix="/api/agent/event")
app.include_router(ending.router, prefix="/api/agent/ending")
app.include_router(memory.router, prefix="/api/agent/memory")