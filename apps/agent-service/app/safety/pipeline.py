from __future__ import annotations

import re
from typing import Optional

from pydantic import BaseModel, Field


class SafetyResult(BaseModel):
    safe: bool = Field(description="Whether the input/output passed all safety checks")
    injection_score: Optional[float] = Field(default=None, description="Prompt injection risk score (0-1)")
    errors: Optional[list[str]] = Field(default=None, description="List of safety check failure descriptions")


INJECTION_PATTERNS = [
    re.compile(r"ignore\s+previous", re.IGNORECASE),
    re.compile(r"system\s+prompt", re.IGNORECASE),
    re.compile(r"you\s+are\s+now", re.IGNORECASE),
    re.compile(r"forget\s+everything", re.IGNORECASE),
    re.compile(r"admin\s+mode", re.IGNORECASE),
    re.compile(r"debug\s+mode", re.IGNORECASE),
    re.compile(r"override\s+instructions", re.IGNORECASE),
    re.compile(r"act\s+as\s+if", re.IGNORECASE),
    re.compile(r"pretend\s+you\s+are", re.IGNORECASE),
    re.compile(r"reveal\s+your\s+instructions", re.IGNORECASE),
]

SECRET_PATTERNS = [
    re.compile(r"api[_-]?key", re.IGNORECASE),
    re.compile(r"secret", re.IGNORECASE),
    re.compile(r"password", re.IGNORECASE),
    re.compile(r"authorization", re.IGNORECASE),
    re.compile(r"bearer\s+", re.IGNORECASE),
    re.compile(r"sk-[a-zA-Z0-9]{20,}", re.IGNORECASE),
]

OUTPUT_INJECTION_PATTERNS = [
    re.compile(r"<\|system\|>", re.IGNORECASE),
    re.compile(r"\[system\]", re.IGNORECASE),
    re.compile(r"###\s+system", re.IGNORECASE),
]

THRESHOLD = 0.8


def check_input_safety(user_input: str) -> SafetyResult:
    matches = 0
    errors: list[str] = []

    for pattern in INJECTION_PATTERNS:
        if pattern.search(user_input):
            matches += 1
            errors.append(f"Potential prompt injection detected: matched pattern '{pattern.pattern}'")

    score = min(matches / max(len(INJECTION_PATTERNS), 1), 1.0)

    if score >= THRESHOLD:
        return SafetyResult(safe=False, injection_score=score, errors=errors)

    return SafetyResult(safe=True, injection_score=score, errors=None)


def check_output_safety(data: dict) -> SafetyResult:
    text = str(data)
    errors: list[str] = []

    for pattern in SECRET_PATTERNS:
        if pattern.search(text):
            errors.append(f"Potential secret/key leakage detected: matched pattern '{pattern.pattern}'")

    for pattern in OUTPUT_INJECTION_PATTERNS:
        if pattern.search(text):
            errors.append(f"Potential output injection detected: matched pattern '{pattern.pattern}'")

    if errors:
        return SafetyResult(safe=False, injection_score=None, errors=errors)

    return SafetyResult(safe=True, injection_score=None, errors=None)


def check_field_allowlist(data: dict, allowed_fields: set[str]) -> SafetyResult:
    extra_fields = set(data.keys()) - allowed_fields
    if extra_fields:
        return SafetyResult(
            safe=False,
            injection_score=None,
            errors=[f"Extra fields not in allowlist: {', '.join(sorted(extra_fields))}"],
        )
    return SafetyResult(safe=True, injection_score=None, errors=None)


def check_reference_integrity(data: dict) -> SafetyResult:
    errors: list[str] = []

    all_ids: set[str] = set()
    referenced_ids: set[str] = set()

    for faction in data.get("factions", []):
        all_ids.add(faction.get("id", ""))
    for location in data.get("locations", []):
        all_ids.add(location.get("id", ""))
        for conn in location.get("connections", []):
            referenced_ids.add(conn)
    for npc in data.get("npcs", []):
        all_ids.add(npc.get("id", ""))
        if npc.get("faction"):
            referenced_ids.add(npc["faction"])
    for rumor in data.get("rumors", []):
        if rumor.get("related_location"):
            referenced_ids.add(rumor["related_location"])
        if rumor.get("related_npc"):
            referenced_ids.add(rumor["related_npc"])
    for event in data.get("events", []):
        all_ids.add(event.get("id", ""))
        referenced_ids.add(event.get("location_id", ""))
        for npc_ref in event.get("related_npc_ids", []):
            referenced_ids.add(npc_ref)
    for ending in data.get("ending_candidates", []):
        all_ids.add(ending.get("id", ""))

    invalid_refs = referenced_ids - all_ids - {""}
    if invalid_refs:
        errors.append(f"Referenced IDs not found in world data: {', '.join(sorted(invalid_refs))}")

    if errors:
        return SafetyResult(safe=False, injection_score=None, errors=errors)

    return SafetyResult(safe=True, injection_score=None, errors=None)