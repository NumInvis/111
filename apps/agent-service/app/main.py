from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import health, world, npc, event, ending, memory

app = FastAPI(title="Variational Infinity Agent Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/agent")
app.include_router(world.router, prefix="/api/agent/world")
app.include_router(npc.router, prefix="/api/agent/npc")
app.include_router(event.router, prefix="/api/agent/event")
app.include_router(ending.router, prefix="/api/agent/ending")
app.include_router(memory.router, prefix="/api/agent/memory")