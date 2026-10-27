from __future__ import annotations

import json
import re
from contextvars import ContextVar, Token
from typing import Any

from chat.catalog import filter_precedents_by_incident_type
from chat.workflow import parse_reviews, reviews_to_adjudicator_maps, rule_criteria_counts

SMART_ANALYSIS_SCHEMA_VERSION = "football.smart-analysis.v1"
_REQUEST_PRECEDENT_TYPES: ContextVar[tuple[str, ...]] = ContextVar("request_precedent_types", default=())
_REQUEST_RULE_CRITERIA: ContextVar[list[dict[str, Any]]] = ContextVar("request_rule_criteria", default=())
_CATALOG_RULES: ContextVar[tuple[dict[str, Any], ...]] = ContextVar("catalog_rules", default=())
_CATALOG_PRECEDENTS: ContextVar[tuple[dict[str, Any], ...]] = ContextVar("catalog_precedents", default=())
_UI_ANALYSIS: ContextVar[dict[str, Any] | None] = ContextVar("ui_analysis", default=None)


def bind_precedent_types(precedent_types: list[str] | None) -> Token[tuple[str, ...]]:
    cleaned: list[str] = []
    for item in precedent_types or []:
        if isinstance(item, str) and item.strip() and item.strip() not in cleaned:
            cleaned.append(item.strip())
    return _REQUEST_PRECEDENT_TYPES.set(tuple(cleaned))


def reset_precedent_types(token: Token[tuple[str, ...]]) -> None:
    _REQUEST_PRECEDENT_TYPES.reset(token)


def bind_rule_criteria(rule_criteria: list[dict[str, Any]] | None) -> Token[tuple[dict[str, Any], ...]]:
    rows = tuple(row for row in (rule_criteria or []) if isinstance(row, dict))
    return _REQUEST_RULE_CRITERIA.set(rows)


def reset_rule_criteria(token: Token[tuple[dict[str, Any], ...]]) -> None:
    _REQUEST_RULE_CRITERIA.reset(token)


def bind_catalog(rules: list[dict[str, Any]], precedents: list[dict[str, Any]]) -> tuple[Token, Token]:
    rules_token = _CATALOG_RULES.set(tuple(rules))
    precedents_token = _CATALOG_PRECEDENTS.set(tuple(precedents))
    return rules_token, precedents_token


def reset_catalog(rules_token: Token, precedents_token: Token) -> None:
    _CATALOG_RULES.reset(rules_token)
    _CATALOG_PRECEDENTS.reset(precedents_token)


def take_ui_analysis() -> dict[str, Any] | None:
    return _UI_ANALYSIS.get()


def materialize_ui_analysis_from_payload(payload: dict[str, Any] | None) -> None:
    """Rebuild the card on this task.

    Sync tools run in a worker thread, so a ContextVar set inside show_analysis
    is invisible to the request that renders the chat stream.
    """
    if take_ui_analysis() or not isinstance(payload, dict):
        return
    reviews = payload.get("reviews", "[]")
    if isinstance(reviews, (list, dict)):
        reviews = json.dumps(reviews, ensure_ascii=False)
    elif not isinstance(reviews, str):
        reviews = "[]"
    show_analysis_json(
        str(payload.get("incident_type") or payload.get("incidentType") or ""),
        str(payload.get("ruling") or ""),
        str(payload.get("summary") or ""),
        reviews,
    )


def clear_ui_analysis() -> None:
    _UI_ANALYSIS.set(None)


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


def precedent_match_counts(incident_type: str, ruling: str) -> dict[str, int]:
    _, rows = _rows_for(incident_type)
    total = len(rows)
    aligned = sum(
        1
        for row in rows
        if _same_outcome(ruling, row.get("finalDecision") or row.get("final_decision") or "")
    )
    percent = round((aligned / total) * 100) if total else 0
    return {"aligned": aligned, "total": total, "percent": percent}


def build_catalog_lists(
    rule_criteria: list[dict[str, Any]] | None,
    catalog_rules: list[dict[str, Any]],
    catalog_precedents: list[dict[str, Any]],
) -> dict[str, Any]:
    criteria = [row for row in (rule_criteria or []) if isinstance(row, dict)]
    return {
        "criteria": [{**row, "review": None} for row in criteria],
        "rules": [
            {
                "id": row.get("ref") or "",
                "ref": row.get("ref") or "",
                "title": row.get("title") or "",
                "body": row.get("body") or "",
                "review": None,
            }
            for row in catalog_rules
            if isinstance(row, dict)
        ],
        "precedents": [{**row, "review": None} for row in catalog_precedents if isinstance(row, dict)],
    }


def build_ui_analysis(
    incident_type: str,
    ruling: str,
    summary: str,
    reviews: list[dict[str, Any]],
    rule_criteria: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    ruling_text = (ruling or "").strip()
    summary_text = (summary or "").strip()
    incident, rows = _rows_for(incident_type)
    criteria = list(rule_criteria if rule_criteria is not None else _REQUEST_RULE_CRITERIA.get())
    reviews_by_id = {review["id"]: review for review in reviews}
    catalog_rules = list(_CATALOG_RULES.get())
    catalog_precedents = list(_CATALOG_PRECEDENTS.get())
    criterion_ids = {str(row.get("id") or "") for row in criteria if row.get("id")}
    case_ids = {str(row.get("caseId") or row.get("id") or "") for row in rows if row.get("caseId") or row.get("id")}
    rule_evaluations, precedent_comparisons = reviews_to_adjudicator_maps(reviews, criterion_ids, case_ids)

    analysis = {
        "schemaVersion": SMART_ANALYSIS_SCHEMA_VERSION,
        "incidentType": incident,
        "ruling": ruling_text,
        "summary": summary_text,
        "ruleCriteria": rule_criteria_counts(criteria),
        "precedentMatch": precedent_match_counts(incident, ruling_text),
        "reviews": reviews,
        "ruleEvaluations": rule_evaluations,
        "precedentComparisons": precedent_comparisons,
        "lists": {
            "criteria": [
                {
                    **row,
                    "review": reviews_by_id.get(str(row.get("id") or "")),
                }
                for row in criteria
            ],
            "rules": [
                {
                    "id": row.get("ref") or "",
                    "ref": row.get("ref") or "",
                    "title": row.get("title") or "",
                    "body": row.get("body") or "",
                    "review": reviews_by_id.get(str(row.get("ref") or "")),
                }
                for row in catalog_rules
            ],
            "precedents": [
                {
                    **row,
                    "review": reviews_by_id.get(str(row.get("caseId") or "")),
                }
                for row in catalog_precedents
            ],
        },
    }
    _UI_ANALYSIS.set(analysis)
    return analysis


def show_analysis_ack(review_count: int, ruling: str) -> str:
    return json.dumps(
        {"ok": True, "reviewCount": review_count, "ruling": (ruling or "").strip()},
        ensure_ascii=False,
    )


def show_analysis_json(incident_type: str, ruling: str, summary: str, reviews: str = "[]") -> str:
    parsed_reviews = parse_reviews(reviews)
    build_ui_analysis(incident_type.strip(), ruling, summary, parsed_reviews)
    return show_analysis_ack(len(parsed_reviews), ruling)
