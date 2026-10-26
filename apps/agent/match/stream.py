import asyncio
import json
from collections.abc import AsyncIterator

from match.clock import format_clock, parse_clock
from match.constants import MAJOR_EVENT_TYPES, MATCH
from match.frame_picker import frame_for_elapsed_second
from match.normalize import (
    create_frame,
    decision_from_event,
    derive_momentum,
    derive_stats,
    score_at,
)
from match import queries
from match.stream_loader import load_stream_timeline
from config import match_tick_ms
from db.connection import db_connection


def parse_after_seconds(value: str) -> int:
    if value.isdigit():
        return int(value)
    return parse_clock(value)


async def match_event_stream(after_value: str) -> AsyncIterator[str]:
    after_seconds = parse_after_seconds(after_value)
    tick_delay = match_tick_ms() / 1000.0

    with db_connection() as conn:
        timeline = load_stream_timeline(conn)

    all_events = sorted(
        [*timeline["events"], *timeline["phases"]],
        key=lambda item: (item["timeMilliseconds"], item["sequence"]),
    )
    final_seconds = int(
        max(
            max((frame["timeSeconds"] for frame in timeline["all_metric_frames"]), default=0),
            max((event["timeSeconds"] for event in all_events), default=0),
        )
    )
    picker_frames = timeline["picker_frames"]
    all_metric_frames = timeline["all_metric_frames"]
    ratings_by_second = timeline["ratings_by_second"]

    yield f"event: ready\ndata: {json.dumps({'clock': format_clock(after_seconds)})}\n\n"

    current_seconds = after_seconds
    cached_frame_second: int | None = None
    cached_display_frame = None

    while current_seconds < final_seconds:
        await asyncio.sleep(tick_delay)
        next_seconds = current_seconds + 1
        next_ms = next_seconds * 1000
        next_events = [
            event
            for event in all_events
            if current_seconds * 1000 < event["timeMilliseconds"] <= next_ms
        ]
        known_events = [event for event in all_events if event["timeMilliseconds"] <= next_ms]
        known_rows = [event for event in known_events if event["type"] != "phase"]
        known_metric = [
            frame for frame in all_metric_frames if frame["timeMilliseconds"] <= next_ms
        ]

        picked = frame_for_elapsed_second(picker_frames, next_seconds)
        display_frame = cached_display_frame
        if picked and picked.get("frameId"):
            if cached_frame_second != next_seconds:
                with db_connection() as conn:
                    full_row = queries.load_frame_by_id(conn, picked["frameId"])
                display_frame = create_frame(full_row) if full_row else None
                cached_display_frame = display_frame
                cached_frame_second = next_seconds

        clock = format_clock(next_seconds)
        tick = {
            "clock": clock,
            "match": {**MATCH, "score": score_at(known_events)},
            "frame": display_frame,
            "ratings": ratings_by_second.get(next_seconds, []),
            "events": [event for event in next_events if event["type"] != "phase"],
            "phases": [event for event in next_events if event["type"] == "phase"],
            "timelineEvents": [
                event
                for event in next_events
                if event["type"] != "phase"
                and event.get("timelineEvent")
                and event["type"] in MAJOR_EVENT_TYPES
            ],
            "decisions": [
                decision_from_event(event)
                for event in next_events
                if event["type"] != "phase" and event.get("decision")
            ],
            "stats": derive_stats(known_rows, known_metric),
            "momentum": derive_momentum(known_rows, known_metric),
        }
        yield f"id: {next_seconds}\nevent: tick\ndata: {json.dumps(tick)}\n\n"
        current_seconds = next_seconds
