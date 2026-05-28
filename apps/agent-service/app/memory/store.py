from __future__ import annotations

from app.schemas.models import MemoryEntry


class MemoryStore:
    def __init__(self) -> None:
        self._short_term: list[MemoryEntry] = []
        self._long_term: list[MemoryEntry] = []

    def add_short_term(self, entry: MemoryEntry) -> None:
        self._short_term.append(entry)

    def add_long_term(self, entry: MemoryEntry) -> None:
        self._long_term.append(entry)

    def get_short_term(self, npc_id: str, limit: int = 10) -> list[MemoryEntry]:
        entries = [e for e in self._short_term if e.npc_id == npc_id]
        entries.sort(key=lambda e: e.importance, reverse=True)
        return entries[:limit]

    def get_long_term(self, npc_id: str, limit: int = 20) -> list[MemoryEntry]:
        entries = [e for e in self._long_term if e.npc_id == npc_id]
        entries.sort(key=lambda e: e.importance, reverse=True)
        return entries[:limit]

    def search(self, npc_id: str, keyword: str, limit: int = 10) -> list[MemoryEntry]:
        all_entries = self._short_term + self._long_term
        scored: list[tuple[MemoryEntry, float]] = []
        for entry in all_entries:
            if entry.npc_id != npc_id:
                continue
            if keyword.lower() in entry.content.lower():
                scored.append((entry, entry.importance))
        scored.sort(key=lambda t: t[1], reverse=True)
        return [e for e, _ in scored[:limit]]