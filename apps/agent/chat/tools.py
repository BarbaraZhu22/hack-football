import json

from agent_framework import tool

from chat.analysis import show_analysis_json
from chat.catalog import precedents_json, rules_json
from chat.pitch_context import append_scene_action, pitch_snapshot_json, take_scene_actions


@tool
def search_precedents(incident_type: str) -> str:
    """Search simulated league precedent cases by incident_type (e.g. serious_foul_play, offside)."""
    return precedents_json(incident_type.strip())


@tool
def search_rules(incident_type: str) -> str:
    """Search IFAB / protocol rule rows whose incident_types include the given type."""
    return rules_json(incident_type.strip())


@tool
def show_analysis(incident_type: str, ruling: str, summary: str, reviews: str = "[]") -> str:
    """Confirm the ruling card after catalog lookup. incident_type is a precedent id such as serious_foul_play."""
    return show_analysis_json(incident_type.strip(), ruling, summary, reviews)


@tool
def get_incident_capture() -> str:
    """Return contact reconstruction metrics, video feed metadata, and current viewport scene state for the pitch incident."""
    return pitch_snapshot_json()


@tool
def control_scene(
    command: str,
    camera_preset: str = "",
    time_seconds: float = -1,
    overlay_key: str = "",
    overlay_enabled: bool = True,
    highlight_target: str = "",
    highlight_id: str = "",
) -> str:
    """Control the 3D pitch viewport. command: camera | seek | overlay | highlight | reset | clear_arrows."""
    cmd = (command or "").strip().lower()
    actions: list[dict] = []

    if cmd == "camera" and camera_preset.strip():
        actions.append({"type": "camera.set", "preset": camera_preset.strip()})
    elif cmd == "seek" and time_seconds >= 0:
        actions.append({"type": "incident.seek", "time": float(time_seconds)})
    elif cmd == "overlay" and overlay_key.strip():
        key = overlay_key.strip()
        if key in {"skeleton", "labels", "trajectory", "forces", "dual"}:
            actions.append({"type": "pitch.overlay.set", "key": key, "enabled": bool(overlay_enabled)})
    elif cmd == "highlight" and highlight_id.strip():
        actions.append(
            {
                "type": "highlight",
                "target": highlight_target.strip() or "player",
                "id": highlight_id.strip(),
            }
        )
    elif cmd == "reset":
        actions.append({"type": "reset"})
    elif cmd == "clear_arrows":
        actions.append({"type": "arrow.clear"})
    else:
        return json.dumps(
            {
                "ok": False,
                "message": "Unknown command or missing parameters. Use camera, seek, overlay, highlight, reset, or clear_arrows.",
            },
            ensure_ascii=False,
        )

    for action in actions:
        append_scene_action(action)
    return json.dumps({"ok": True, "actions": actions, "queued": len(take_scene_actions())}, ensure_ascii=False)


def materialize_control_scene_calls(result) -> None:
    if take_scene_actions():
        return
    from chat.tool_trace import extract_tool_calls

    for call in extract_tool_calls(result):
        if call.get("name") != "control_scene":
            continue
        payload = call.get("input") or {}
        control_scene(
            str(payload.get("command") or ""),
            str(payload.get("camera_preset") or ""),
            float(payload.get("time_seconds") if payload.get("time_seconds") is not None else -1),
            str(payload.get("overlay_key") or ""),
            bool(payload.get("overlay_enabled", True)),
            str(payload.get("highlight_target") or ""),
            str(payload.get("highlight_id") or ""),
        )


PITCH_DESK_TOOLS = [get_incident_capture, control_scene]
REFERENCE_TOOLS = [search_precedents, search_rules]
DESK_TOOLS = [*PITCH_DESK_TOOLS, *REFERENCE_TOOLS, show_analysis]
ADJUDICATION_TOOLS = [show_analysis]
