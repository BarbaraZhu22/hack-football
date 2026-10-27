from __future__ import annotations

import json
import re
from contextvars import ContextVar, Token
from typing import Any

from chat.catalog import filter_precedents_by_incident_type

SMART_ANALYSIS_SCHEMA_VERSION = "football.smart-analysis.v1"
_REQUEST_PRECEDENT_TYPES: ContextVar[tuple[str, ...]] = ContextVar("request_precedent_types", default=())


def bind_precedent_types(precedent_types: list[str] | None) -> Token[tuple[str, ...]]:
    cleaned: list[str] = []
    for item in precedent_types or []:
        if isinstance(item, str) and item.strip() and item.strip() not in cleaned:
            cleaned.append(item.strip())
    return _REQUEST_PRECEDENT_TYPES.set(tuple(cleaned))


def reset_precedent_types(token: Token[tuple[str, ...]]) -> None:
    _REQUEST_PRECEDENT_TYPES.reset(token)


def _normalize_label(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def _outcome(value: str) -> str | None:
    text = _normalize_label(value)
    if not text:
        return None
    if "rescind" in text:
        return "red card rescinded"
    if "no card" in text or "without a card" in text:
        return "no card"
    if any(phrase in text for phrase in ("red card", "sending-off", "sending off", "sent off")):
        return "red card"
    if "yellow card" in text or "caution" in text:
        return "yellow card"
    return None


def _slug(value: str) -> str:
    return re.sub(r"[\s-]+", "_", value.strip().lower())


def _rows_for(incident_type: str) -> tuple[str, list[dict[str, Any]]]:
    requested = (incident_type or "").strip()
    candidates: list[str] = []
    for item in (requested, _slug(requested), *_REQUEST_PRECEDENT_TYPES.get()):
        if item and item not in candidates:
            candidates.append(item)
    for item in candidates:
        rows = filter_precedents_by_incident_type(item)
        if rows:
            return item, rows
    return requested, []


def _same_outcome(ruling: str, final_decision: str) -> bool:
    ruling_outcome = _outcome(ruling)
    decision_outcome = _outcome(str(final_decision))
    if ruling_outcome and decision_outcome:
        return ruling_outcome == decision_outcome
    ruling_key = _normalize_label(ruling)
    decision_key = _normalize_label(str(final_decision))
    return bool(ruling_key) and ruling_key == decision_key


def build_smart_analysis(incident_type: str, ruling: str, summary: str) -> dict[str, Any]:
    ruling_text = (ruling or "").strip()
    summary_text = (summary or "").strip()
    incident, rows = _rows_for(incident_type)
    total = len(rows)
    aligned = sum(1 for row in rows if _same_outcome(ruling_text, row.get("finalDecision") or row.get("final_decision") or ""))
    percent = round((aligned / total) * 100) if total else 0
    return {
        "schemaVersion": SMART_ANALYSIS_SCHEMA_VERSION,
        "incidentType": incident,
        "ruling": ruling_text,
        "summary": summary_text,
        "historical": {
            "aligned": aligned,
            "total": total,
            "percent": percent,
        },
    }


def smart_analysis_json(incident_type: str, ruling: str, summary: str) -> str:
    return json.dumps(build_smart_analysis(incident_type, ruling, summary), ensure_ascii=False)
