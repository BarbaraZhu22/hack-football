from psycopg import Connection

from match.clock import format_clock
from match.constants import MAJOR_EVENT_TYPES, MATCH
from match.dataset import load_reference, load_timeline
from match.normalize import (
    create_mock_momentum,
    decision_from_event,
    derive_stats,
    score_at,
)


def create_snapshot(conn: Connection, through_seconds: int) -> dict:
    ref = load_reference(conn)
    timeline = load_timeline(conn, through_seconds, ref["peopleById"])
    events = timeline["events"]
    phases = timeline["phases"]
    frames = timeline["frames"]
    ratings = timeline["ratings"]

    def within(item: dict) -> bool:
        return item["timeMilliseconds"] <= through_seconds * 1000

    events = [e for e in events if within(e)]
    phases = [p for p in phases if within(p)]
    frames = [f for f in frames if within(f)]
    ratings = [r for r in ratings if r["timeMilliseconds"] <= through_seconds * 1000]

    all_events = sorted(
        [*events, *phases],
        key=lambda item: (item["timeMilliseconds"], item["sequence"]),
    )
    timeline_events = [e for e in events if e.get("timelineEvent") and e["type"] in MAJOR_EVENT_TYPES]
    decisions = [decision_from_event(e) for e in events if e.get("decision")]
    score = score_at(all_events)

    return {
        "match": {**ref["match"], "score": score},
        "stats": derive_stats(events, frames),
        "clock": format_clock(through_seconds),
        "cursor": through_seconds,
        "events": events,
        "timelineEvents": timeline_events,
        "decisions": decisions,
        "momentum": create_mock_momentum(frames),
        "phases": phases,
        "frames": frames,
        "ratings": ratings,
        "people": ref["people"],
        "officials": ref["officials"],
        "rules": ref["rules"],
        "precedents": ref["precedents"],
        "dataSource": {"ok": True, "backend": "postgresql"},
    }
