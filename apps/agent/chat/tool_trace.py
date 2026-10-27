from __future__ import annotations

import json
from typing import Any

from agent_framework import AgentResponse


def extract_tool_calls(result: AgentResponse) -> list[dict[str, Any]]:
    calls: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for message in result.messages or []:
        for content in getattr(message, "contents", []) or []:
            if getattr(content, "type", None) != "function_call":
                continue
            name = getattr(content, "name", None) or ""
            raw_args = getattr(content, "arguments", None)
            if raw_args is None:
                raw_args = getattr(content, "argument", None)
            if isinstance(raw_args, dict):
                parsed_input = raw_args
            elif isinstance(raw_args, str) and raw_args.strip():
                try:
                    parsed_input = json.loads(raw_args)
                except json.JSONDecodeError:
                    parsed_input = {"raw": raw_args}
            else:
                parsed_input = {}
            key = (name, json.dumps(parsed_input, sort_keys=True))
            if key in seen:
                continue
            seen.add(key)
            calls.append({"name": name, "input": parsed_input})
    return calls
