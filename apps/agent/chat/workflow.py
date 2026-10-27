from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from chat.catalog import precedents_json, rules_json


@dataclass(frozen=True)
class CatalogToolCall:
    name: str
    input: dict[str, Any]
    output: str


def run_catalog_lookups(precedent_types: list[str]) -> list[CatalogToolCall]:
    calls: list[CatalogToolCall] = []
    for incident_type in precedent_types:
        if not isinstance(incident_type, str) or not incident_type.strip():
            continue
        cleaned = incident_type.strip()
        calls.append(
            CatalogToolCall(
                name="search_rules",
                input={"incident_type": cleaned},
                output=rules_json(cleaned),
            )
        )
        calls.append(
            CatalogToolCall(
                name="search_precedents",
                input={"incident_type": cleaned},
                output=precedents_json(cleaned),
            )
        )
    return calls


def catalog_tool_events(calls: list[CatalogToolCall]) -> list[dict[str, Any]]:
    return [{"name": call.name, "input": call.input, "status": "called"} for call in calls]


def aggregate_catalog(calls: list[CatalogToolCall]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    rules: list[dict[str, Any]] = []
    precedents: list[dict[str, Any]] = []
    seen_rules: set[str] = set()
    seen_cases: set[str] = set()
    for call in calls:
        try:
            rows = json.loads(call.output)
        except json.JSONDecodeError:
            continue
        if not isinstance(rows, list):
            continue
        if call.name == "search_rules":
            for row in rows:
                if not isinstance(row, dict):
                    continue
                key = str(row.get("ref") or row.get("title") or "")
                if not key or key in seen_rules:
                    continue
                seen_rules.add(key)
                rules.append(row)
        elif call.name == "search_precedents":
            for row in rows:
                if not isinstance(row, dict):
                    continue
                key = str(row.get("caseId") or "")
                if not key or key in seen_cases:
                    continue
                seen_cases.add(key)
                precedents.append(row)
    return rules, precedents


def catalog_context_message(calls: list[CatalogToolCall]) -> str:
    blocks: list[str] = []
    for call in calls:
        blocks.append(f"{call.name}({json.dumps(call.input, ensure_ascii=False)}) returned:\n{call.output}")
    return (
        "The following catalog lookups were already executed. Do not request search_rules or search_precedents. "
        "Use these results, then call show_analysis once with your ruling, summary, and per-item reviews.\n\n"
        + "\n\n".join(blocks)
    )


def rule_criteria_counts(rule_criteria: list[dict[str, Any]] | None) -> dict[str, int]:
    criteria = rule_criteria or []
    assessed = [row for row in criteria if row.get("status") != "not-assessed"]
    met = sum(1 for row in assessed if row.get("status") == "met")
    return {"met": met, "assessed": len(assessed)}


def parse_reviews(raw: str | list[Any] | None) -> list[dict[str, Any]]:
    if raw is None:
        return []
    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return []
        items = parsed if isinstance(parsed, list) else []
    else:
        return []

    cleaned: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        item_id = str(item.get("id") or "").strip()
        if not item_id:
            continue
        reasonable = item.get("reasonable")
        if isinstance(reasonable, str):
            reasonable = reasonable.strip().lower() in {"true", "yes", "1"}
        elif reasonable is not None:
            reasonable = bool(reasonable)
        cleaned.append(
            {
                "id": item_id,
                "match": item.get("match"),
                "reasonable": reasonable,
                "rationale": str(item.get("rationale") or "").strip(),
            }
        )
    return cleaned


def reviews_to_adjudicator_maps(
    reviews: list[dict[str, Any]],
    criterion_ids: set[str],
    case_ids: set[str],
) -> tuple[dict[str, Any], dict[str, Any]]:
    rule_evaluations: dict[str, Any] = {}
    precedent_comparisons: dict[str, Any] = {}
    for review in reviews:
        item_id = review["id"]
        reasonable = review.get("reasonable")
        rationale = review.get("rationale") or None
        if item_id in criterion_ids:
            correctness = None
            if reasonable is True:
                correctness = "correct"
            elif reasonable is False:
                correctness = "incorrect"
            rule_evaluations[item_id] = {"correctness": correctness, "rationale": rationale}
        elif item_id in case_ids:
            consistency = None
            if reasonable is True:
                consistency = "consistent"
            elif reasonable is False:
                consistency = "inconsistent"
            precedent_comparisons[item_id] = {"consistency": consistency, "rationale": rationale}
    return rule_evaluations, precedent_comparisons
