from __future__ import annotations

import json
import re
from typing import Optional

from pydantic import BaseModel, Field


class SafetyResult(BaseModel):
    safe: bool = Field(description="Whether the input/output passed all safety checks")
    injection_score: Optional[float] = Field(default=None, description="Prompt injection risk score (0-1)")
    toxicity_score: Optional[float] = Field(default=None, description="Content toxicity score (0-1)")
    errors: Optional[list[str]] = Field(default=None, description="List of safety check failure descriptions")


INJECTION_PATTERNS: list[tuple[re.Pattern, float]] = [
    (re.compile(r"ignore\s+previous", re.IGNORECASE), 0.3),
    (re.compile(r"system\s+prompt", re.IGNORECASE), 0.3),
    (re.compile(r"you\s+are\s+now", re.IGNORECASE), 0.2),
    (re.compile(r"forget\s+everything", re.IGNORECASE), 0.3),
    (re.compile(r"admin\s+mode", re.IGNORECASE), 0.2),
    (re.compile(r"debug\s+mode", re.IGNORECASE), 0.2),
    (re.compile(r"override\s+safety", re.IGNORECASE), 0.3),
    (re.compile(r"override\s+rules", re.IGNORECASE), 0.3),
    (re.compile(r"override\s+constraints", re.IGNORECASE), 0.3),
    (re.compile(r"bypass\s+filter", re.IGNORECASE), 0.2),
    (re.compile(r"pretend\s+you\s+are", re.IGNORECASE), 0.2),
    (re.compile(r"act\s+as\s+if", re.IGNORECASE), 0.15),
    (re.compile(r"disregard", re.IGNORECASE), 0.2),
]

SECRET_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"api[_-]?key\s*[=:]\s*\S+", re.IGNORECASE), "API key assignment"),
    (re.compile(r"secret\s*[=:]\s*\S+", re.IGNORECASE), "Secret assignment"),
    (re.compile(r"password\s*[=:]\s*\S+", re.IGNORECASE), "Password assignment"),
    (re.compile(r"authorization\s*:\s*Bearer\s+\S+", re.IGNORECASE), "Authorization header"),
    (re.compile(r"Bearer\s+[A-Za-z0-9\-._~+/]+=*", re.IGNORECASE), "Bearer token"),
    (re.compile(r"sk-[a-zA-Z0-9]{8,}", re.IGNORECASE), "Exposed API key (sk-*)"),
    (re.compile(r"token\s*[=:]\s*\S+", re.IGNORECASE), "Token assignment"),
]

OUTPUT_INJECTION_PATTERNS: list[re.Pattern] = [
    re.compile(r"<<", re.IGNORECASE),
    re.compile(r"\[system\]", re.IGNORECASE),
    re.compile(r"###\s+system", re.IGNORECASE),
]

INJECTION_THRESHOLD = 0.8

DEFAULT_SIZE_LIMIT_KB = 50


def check_input_safety(user_input: str) -> SafetyResult:
    score = 0.0
    matched_patterns: list[str] = []

    for pattern, weight in INJECTION_PATTERNS:
        if pattern.search(user_input):
            score += weight
            matched_patterns.append(pattern.pattern)

    score = min(score, 1.0)

    if score >= INJECTION_THRESHOLD:
        return SafetyResult(
            safe=False,
            injection_score=score,
            errors=[f"Prompt injection detected (score: {score:.2f}). Matched patterns: {', '.join(matched_patterns)}"],
        )

    return SafetyResult(safe=True, injection_score=score)


def check_output_safety(data: dict) -> SafetyResult:
    text = str(data)
    blocker_errors: list[str] = []
    warning_errors: list[str] = []
    injection_score = 0.0

    for pattern, label in SECRET_PATTERNS:
        if pattern.search(text):
            blocker_errors.append(f"Secret exposure detected: {label}")

    for pattern in OUTPUT_INJECTION_PATTERNS:
        if pattern.search(text):
            injection_score += 0.4
            warning_errors.append(f"Output injection pattern detected: {pattern.pattern}")

    injection_score = min(injection_score, 1.0)

    if blocker_errors:
        return SafetyResult(
            safe=False,
            injection_score=injection_score if injection_score > 0 else None,
            errors=blocker_errors,
        )

    if warning_errors:
        return SafetyResult(
            safe=True,
            injection_score=injection_score,
            errors=warning_errors,
        )

    return SafetyResult(safe=True)


def check_field_allowlist(data: dict, allowed_fields: set[str]) -> SafetyResult:
    extra_fields = set(data.keys()) - allowed_fields
    if extra_fields:
        return SafetyResult(
            safe=False,
            injection_score=None,
            errors=[f"Extra fields not in allowlist: {', '.join(sorted(extra_fields))}. Allowed: {', '.join(sorted(allowed_fields))}"],
        )
    return SafetyResult(safe=True, injection_score=None)


def check_reference_integrity(data: dict) -> SafetyResult:
    errors: list[str] = []

    all_ids: set[str] = set()
    referenced_ids: set[str] = set()

    valid_realm_ids = {
        "lianTi", "lianQi", "zhuJi", "benYuan", "tongMing", "huaShen",
        "guiYi", "duJie", "tianMen", "xianJing", "shengJing",
        "bianFenJing", "tianDaoJing", "wuXian",
    }

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
        if rumor.get("relatedLocation"):
            referenced_ids.add(rumor["relatedLocation"])
        if rumor.get("relatedNpc"):
            referenced_ids.add(rumor["relatedNpc"])
    for event in data.get("events", []):
        all_ids.add(event.get("id", ""))
        if event.get("locationId"):
            referenced_ids.add(event["locationId"])
        for npc_ref in event.get("relatedNpcIds", []):
            referenced_ids.add(npc_ref)
    for ending in data.get("endingCandidates", []):
        all_ids.add(ending.get("id", ""))
        if ending.get("requiredRealm") and ending["requiredRealm"] not in valid_realm_ids:
            errors.append(f"requiredRealm '{ending['requiredRealm']}' is not a valid realm ID")

    invalid_refs = referenced_ids - all_ids - {""}
    if invalid_refs:
        errors.append(f"Referenced IDs not found in world data: {', '.join(sorted(invalid_refs))}")

    if errors:
        return SafetyResult(safe=False, injection_score=None, errors=errors)

    return SafetyResult(safe=True, injection_score=None)


def check_size_limit(data: dict, max_size_kb: int = DEFAULT_SIZE_LIMIT_KB) -> SafetyResult:
    serialized = json.dumps(data)
    size_bytes = len(serialized.encode("utf-8"))
    max_bytes = max_size_kb * 1024

    if size_bytes > max_bytes:
        return SafetyResult(
            safe=False,
            injection_score=None,
            errors=[f"JSON output exceeds size limit: {size_bytes} bytes > {max_bytes} bytes ({max_size_kb}KB)"],
        )

    return SafetyResult(safe=True, injection_score=None)


def full_output_check(data: dict, allowed_fields: Optional[set[str]] = None) -> SafetyResult:
    output_result = check_output_safety(data)
    if not output_result.safe:
        return output_result

    if allowed_fields is not None:
        allowlist_result = check_field_allowlist(data, allowed_fields)
        if not allowlist_result.safe:
            return allowlist_result

    ref_result = check_reference_integrity(data)
    if not ref_result.safe:
        return ref_result

    size_result = check_size_limit(data)
    if not size_result.safe:
        return size_result

    return SafetyResult(safe=True)