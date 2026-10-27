from __future__ import annotations

import json
from typing import Any

from agent_framework import AgentResponse

from chat.analysis import SMART_ANALYSIS_SCHEMA_VERSION, take_ui_analysis


def parse_function_call(content: Any) -> dict[str, Any] | None:
    if getattr(content, "type", None) != "function_call":
        return None
    name = getattr(content, "name", None) or ""
    if not name:
        return None
    raw_args = getattr(content, "arguments", None)
    if raw_args is None:
        raw_args = getattr(content, "argument", None)
    if isinstance(raw_args, dict):
        parsed_input = raw_args
    elif isinstance(raw_args, str) and raw_args.strip():
        try:
            parsed_input = json.loads(raw_args)
        except json.JSONDecodeError:
            return None
    else:
        return None
    return {"name": name, "input": parsed_input}


def extract_analysis(result: AgentResponse) -> dict[str, Any] | None:
    ui_analysis = take_ui_analysis()
    if ui_analysis and ui_analysis.get("schemaVersion") == SMART_ANALYSIS_SCHEMA_VERSION:
        return ui_analysis

    call_names: dict[str, str] = {}
    for message in result.messages or []:
        for content in getattr(message, "contents", []) or []:
            if getattr(content, "type", None) == "function_call":
                call_id = getattr(content, "call_id", None) or ""
                name = getattr(content, "name", None) or ""
                if call_id and name:
                    call_names[call_id] = name
            if getattr(content, "type", None) != "function_result":
                continue
            call_id = getattr(content, "call_id", None) or ""
            if call_names.get(call_id) != "show_analysis":
                continue
            raw = getattr(content, "result", None) or ""
            if not isinstance(raw, str) or not raw.strip():
                continue
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if parsed.get("ok"):
                return take_ui_analysis()
    return take_ui_analysis()
