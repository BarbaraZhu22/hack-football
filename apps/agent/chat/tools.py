import json
import re

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
    """Return pitch metrics and, for offside, every 120 Hz frame plus the authoritative measured 3D pass-release assessment."""
    return pitch_snapshot_json()


SCENE_BUTTONS = {
    "camera.broadcast",
    "camera.touchline",
    "camera.tactical",
    "camera.referee",
    "camera.free",
    "overlay.skeleton",
    "overlay.trajectory",
    "overlay.forces",
    "overlay.labels",
    "marker.sprint",
    "marker.commit",
    "marker.contact",
    "marker.ball",
    "marker.ground",
    "marker.stop",
    "marker.whistle",
    "marker.rise",
    "marker.run",
    "marker.pass",
    "marker.release",
    "rate.0.25",
    "rate.0.5",
    "rate.1",
    "transport.play",
    "transport.pause",
    "transport.restart",
    "transport.step_back",
    "transport.step_forward",
}


_SCENE_COMMAND = re.compile(
    r"\b(change|switch|set|go|put|turn|pause|play|resume|restart|press|open|enable|stop)\b",
    re.IGNORECASE,
)
_SCENE_BUTTON_PATTERNS = (
    (re.compile(r"broadcast", re.IGNORECASE), "camera.broadcast"),
    (re.compile(r"touchline|touch line|sideline", re.IGNORECASE), "camera.touchline"),
    (re.compile(r"tactical", re.IGNORECASE), "camera.tactical"),
    (re.compile(r"referee\s+(view|cam|camera|angle)", re.IGNORECASE), "camera.referee"),
    (re.compile(r"free\s+(view|cam|camera|angle)", re.IGNORECASE), "camera.free"),
    (re.compile(r"skeleton", re.IGNORECASE), "overlay.skeleton"),
    (re.compile(r"trajectory|trail", re.IGNORECASE), "overlay.trajectory"),
    (re.compile(r"\bforces?\b", re.IGNORECASE), "overlay.forces"),
    (re.compile(r"labels?", re.IGNORECASE), "overlay.labels"),
    (re.compile(r"\bpause\b|\bstop\b", re.IGNORECASE), "transport.pause"),
    (re.compile(r"\bplay\b|\bresume\b", re.IGNORECASE), "transport.play"),
    (re.compile(r"restart", re.IGNORECASE), "transport.restart"),
    (re.compile(r"step\s*back|frame back", re.IGNORECASE), "transport.step_back"),
    (re.compile(r"step\s*forward|frame forward", re.IGNORECASE), "transport.step_forward"),
    (re.compile(r"\b0\.25\b|quarter speed|slow", re.IGNORECASE), "rate.0.25"),
    (re.compile(r"\b0\.5\b|half speed", re.IGNORECASE), "rate.0.5"),
    (re.compile(r"full speed|normal speed", re.IGNORECASE), "rate.1"),
)
_VAGUE_VIEW = re.compile(
    r"better (angle|view|look)|different (angle|view)|another angle|closer look",
    re.IGNORECASE,
)
_ASK_USER_TO_PRESS = re.compile(
    r"want me to|would you like|shall i|you can press|press the|switch to a different|which angle|let me know",
    re.IGNORECASE,
)
_SCENE_CONFIRMATION = {
    "camera.broadcast": "Broadcast view.",
    "camera.touchline": "Touchline view.",
    "camera.tactical": "Tactical view.",
    "camera.referee": "Referee view.",
    "camera.free": "Free camera.",
    "transport.pause": "Replay paused.",
    "transport.play": "Replay playing.",
    "transport.restart": "Replay restarted.",
    "transport.step_back": "Stepped back one frame.",
    "transport.step_forward": "Stepped forward one frame.",
    "rate.0.25": "Quarter speed.",
    "rate.0.5": "Half speed.",
    "rate.1": "Full speed.",
}


def scene_buttons_for_utterance(text: str) -> list[str]:
    """Map a user request to incident buttons. Empty when this is not a scene command."""
    if not text or not (_SCENE_COMMAND.search(text) or _VAGUE_VIEW.search(text)):
        return []
    found: list[str] = []
    for pattern, button in _SCENE_BUTTON_PATTERNS:
        if pattern.search(text) and button not in found:
            found.append(button)
    if not found and _VAGUE_VIEW.search(text):
        found.append("camera.touchline")
    return found


def scene_confirmation(buttons: list[str]) -> str:
    lines = [_SCENE_CONFIRMATION.get(button, f"Pressed {button}.") for button in buttons]
    return " ".join(lines)


def ensure_scene_control(user_text: str, reply: str, tool_calls: list[dict]) -> tuple[str, list[dict]]:
    """If the user asked for a scene change, make sure control_scene ran and do not hand the press back."""
    requested = scene_buttons_for_utterance(user_text or "")
    if not requested:
        return reply, tool_calls
    called: list[str] = []
    for call in tool_calls:
        if call.get("name") != "control_scene":
            continue
        button = str((call.get("input") or {}).get("button") or "").strip().lower()
        if button:
            called.append(button)
    extra: list[dict] = []
    for button in requested:
        if button in called:
            continue
        control_scene(button)
        extra.append({"name": "control_scene", "input": {"button": button}, "status": "called"})
    text = reply
    if extra or _ASK_USER_TO_PRESS.search(reply or ""):
        text = scene_confirmation(requested)
    return text, [*tool_calls, *extra]


@tool
def control_scene(button: str) -> str:
    """Change the incident view yourself. Call this instead of asking the user to press a button. button: camera.broadcast|camera.touchline|camera.tactical|camera.referee|camera.free, overlay.skeleton|overlay.trajectory|overlay.forces|overlay.labels, marker.sprint|marker.commit|marker.contact|marker.ball|marker.ground|marker.stop|marker.whistle|marker.rise, rate.0.25|rate.0.5|rate.1, transport.play|transport.pause|transport.restart|transport.step_back|transport.step_forward."""
    name = (button or "").strip().lower()
    if name not in SCENE_BUTTONS:
        return json.dumps(
            {
                "ok": False,
                "message": "Unknown button. Press one of the incident controls already on screen.",
                "buttons": sorted(SCENE_BUTTONS),
            },
            ensure_ascii=False,
        )

    action = {"type": "ui.press", "button": name}
    append_scene_action(action)
    return json.dumps({"ok": True, "actions": [action], "queued": len(take_scene_actions())}, ensure_ascii=False)


def materialize_control_scene_calls(result) -> None:
    if take_scene_actions():
        return
    from chat.tool_trace import extract_tool_calls

    for call in extract_tool_calls(result):
        if call.get("name") != "control_scene":
            continue
        payload = call.get("input") or {}
        control_scene(str(payload.get("button") or ""))


PITCH_DESK_TOOLS = [get_incident_capture, control_scene]
REFERENCE_TOOLS = [search_precedents, search_rules]
DESK_TOOLS = [*PITCH_DESK_TOOLS, *REFERENCE_TOOLS, show_analysis]
ADJUDICATION_TOOLS = [show_analysis]
