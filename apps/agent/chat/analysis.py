from __future__ import annotations

import json
import re
from typing import Any

from chat.catalog import filter_precedents_by_incident_type

SMART_ANALYSIS_SCHEMA_VERSION = "football.smart-analysis.v1"


def _normalize_label(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def build_smart_analysis(incident_type: str, ruling: str, summary: str) -> dict[str, Any]:
    incident = incident_type.strip()
    ruling_text = (ruling or "").strip()
    summary_text = (summary or "").strip()
    rows = filter_precedents_by_incident_type(incident)
    total = len(rows)
    ruling_key = _normalize_label(ruling_text)
    aligned = 0
    for row in rows:
        final_decision = row.get("finalDecision") or row.get("final_decision") or ""
        if ruling_key and _normalize_label(str(final_decision)) == ruling_key:
            aligned += 1
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
