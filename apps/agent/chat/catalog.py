from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from chat.constants import INCIDENT_PRECEDENT_TYPES
from db.connection import db_connection
from match import queries
from match.normalize import normalize_precedents, normalize_rules


def _rule_lookup_types(incident_type: str) -> set[str]:
    lookup = {incident_type}
    for registry_id, precedent_types in INCIDENT_PRECEDENT_TYPES.items():
        if incident_type == registry_id or incident_type in precedent_types:
            lookup.add(registry_id)
            lookup.update(precedent_types)
    return lookup


@lru_cache(maxsize=1)
def _load_catalog() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    with db_connection() as conn:
        rules = normalize_rules(queries.load_rules(conn))
        precedents = normalize_precedents(queries.load_precedents(conn))
    return rules, precedents


def get_rules() -> list[dict[str, Any]]:
    return _load_catalog()[0]


def get_precedents() -> list[dict[str, Any]]:
    return _load_catalog()[1]


def filter_rules_by_incident_type(incident_type: str) -> list[dict[str, Any]]:
    if not incident_type:
        return []
    lookup = _rule_lookup_types(incident_type)
    return [
        row
        for row in get_rules()
        if lookup.intersection(row.get("incident_types") or [])
    ]


def filter_precedents_by_incident_type(incident_type: str) -> list[dict[str, Any]]:
    if not incident_type:
        return []
    return [
        row
        for row in get_precedents()
        if (row.get("incidentType") or row.get("incident_type")) == incident_type
    ]


def slim_rule(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "ref": row.get("ref") or "",
        "title": row.get("title") or "",
        "body": row.get("body") or row.get("text") or "",
        "incident_types": row.get("incident_types") or [],
    }


def slim_precedent(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "caseId": row.get("caseId") or row.get("id") or "",
        "incidentType": row.get("incidentType") or row.get("incident_type") or "",
        "facts": row.get("facts") or "",
        "onFieldDecision": row.get("onFieldDecision") or row.get("on_field_decision") or "",
        "varAction": row.get("varAction") or row.get("var_action") or "",
        "finalDecision": row.get("finalDecision") or row.get("final_decision") or "",
    }


def rules_json(incident_type: str) -> str:
    payload = [slim_rule(row) for row in filter_rules_by_incident_type(incident_type)]
    return json.dumps(payload, ensure_ascii=False)


def precedents_json(incident_type: str) -> str:
    payload = [slim_precedent(row) for row in filter_precedents_by_incident_type(incident_type)]
    return json.dumps(payload, ensure_ascii=False)
