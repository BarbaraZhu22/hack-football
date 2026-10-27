from __future__ import annotations

import json
from contextvars import ContextVar, Token
from typing import Any

_PITCH_CONTEXT: ContextVar[dict[str, Any]] = ContextVar("pitch_context", default={})
_SCENE_ACTIONS: ContextVar[list[dict[str, Any]]] = ContextVar("scene_actions", default=[])


def bind_pitch_context(pitch: dict[str, Any] | None) -> Token[dict[str, Any]]:
    return _PITCH_CONTEXT.set(dict(pitch) if isinstance(pitch, dict) else {})


def reset_pitch_context(token: Token[dict[str, Any]]) -> None:
    _PITCH_CONTEXT.reset(token)


def bind_scene_actions() -> Token[list[dict[str, Any]]]:
    return _SCENE_ACTIONS.set([])


def reset_scene_actions(token: Token[list[dict[str, Any]]]) -> None:
    _SCENE_ACTIONS.reset(token)


def append_scene_action(action: dict[str, Any]) -> None:
    if not isinstance(action, dict) or not action.get("type"):
        return
    current = list(_SCENE_ACTIONS.get())
    current.append(action)
    _SCENE_ACTIONS.set(current)


def take_scene_actions() -> list[dict[str, Any]]:
    return list(_SCENE_ACTIONS.get())


def pitch_snapshot_json() -> str:
    pitch = _PITCH_CONTEXT.get()
    if not pitch:
        return json.dumps({"available": False, "message": "No pitch reconstruction is bound to this chat request."})
    capture = {
        "available": True,
        "incidentId": pitch.get("incidentId"),
        "incidentLabel": pitch.get("incidentLabel"),
        "contact": pitch.get("contact") or {},
        "offside": pitch.get("offside") or {},
        "video": pitch.get("video") or {},
        "scene": pitch.get("scene") or {},
    }
    return json.dumps(capture, ensure_ascii=False)
