import asyncio
import json
from collections.abc import AsyncIterator

from match.clock import format_clock, parse_clock
from match.constants import MAJOR_EVENT_TYPES, MATCH
from match.dataset import load_full_dataset
from match.normalize import (
    create_mock_momentum,
    decision_from_event,
    derive_stats,
    score_at,
)
from match.snapshot import create_snapshot
from config import match_tick_ms
from db.connection import db_connection


def _parse_after(value: str) -> int:
    if value.isdigit():
        return int(value)
    return parse_clock(value)


async def match_event_stream(after_value: str) -> AsyncIterator[str]:
    after_seconds = _parse_after(after_value)
    tick_delay = match_tick_ms() / 1000.0

    with db_connection() as conn:
        dataset = load_full_dataset(conn)
        initial = create_snapshot(conn, after_seconds)

    final_seconds = max(
        max((f["clockSeconds"] for f in dataset["frames"]), default=0),
        max((e["clockSeconds"] for e in dataset["events"]), default=0),
        max((p["clockSeconds"] for p in dataset["phases"]), default=0),
    )
    all_events = sorted(
        [*dataset["events"], *dataset["phases"]],
        key=lambda item: (item["timeMilliseconds"], item["sequence"]),
    )
    frame_by_time = {f["clockSeconds"]: f for f in dataset["frames"]}
    ratings_by_second: dict[int, list] = {}
    for rating in dataset["ratings"]:
        ratings_by_second.setdefault(rating["matchSecond"], []).append(rating)

    yield f"event: ready\ndata: {json.dumps({'clock': initial['clock']})}\n\n"

    current_seconds = after_seconds
    while current_seconds < final_seconds:
        await asyncio.sleep(tick_delay)
        next_seconds = current_seconds + 1
        next_events = [
            e
            for e in all_events
            if current_seconds * 1000 < e["timeMilliseconds"] <= next_seconds * 1000
        ]
        known_events = [e for e in all_events if e["timeMilliseconds"] <= next_seconds * 1000]
        known_rows = [e for e in known_events if e["type"] != "phase"]
        known_frames = [f for f in dataset["frames"] if f["timeMilliseconds"] <= next_seconds * 1000]
        clock = format_clock(next_seconds)
        tick = {
            "clock": clock,
            "match": {**MATCH, "score": score_at(known_events)},
            "frame": frame_by_time.get(next_seconds),
            "ratings": ratings_by_second.get(next_seconds, []),
            "events": [e for e in next_events if e["type"] != "phase"],
            "phases": [e for e in next_events if e["type"] == "phase"],
            "timelineEvents": [
                e
                for e in next_events
                if e["type"] != "phase" and e.get("timelineEvent") and e["type"] in MAJOR_EVENT_TYPES
            ],
            "decisions": [
                decision_from_event(e) for e in next_events if e["type"] != "phase" and e.get("decision")
            ],
            "stats": derive_stats(known_rows, known_frames),
            "momentum": create_mock_momentum(known_frames),
        }
        yield f"id: {next_seconds}\nevent: tick\ndata: {json.dumps(tick)}\n\n"
        current_seconds = next_seconds
