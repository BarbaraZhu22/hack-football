from psycopg import Connection

from match import queries
from match.clock import format_clock
from match.constants import MAJOR_EVENT_TYPES
from match.dataset import load_reference
from match.frame_picker import frame_for_elapsed_second, picker_index_from_row
from match.normalize import (
    create_event,
    create_frame,
    create_mock_momentum,
    create_player_rating,
    dedupe_frames_for_metrics,
    decision_from_event,
    derive_stats,
    flatten_rating_rows,
    metrics_frame_from_row,
    score_at,
)


def create_snapshot(conn: Connection, through_seconds: int) -> dict:
    ref = load_reference(conn)
    people_by_id = ref["peopleById"]
    cursor_ms = through_seconds * 1000

    event_rows = queries.load_events_through(conn, through_seconds)
    mapped = [create_event(row, people_by_id) for row in event_rows]
    events = [event for event in mapped if event["type"] != "phase"]
    phases = [event for event in mapped if event["type"] == "phase"]

    metric_rows = queries.load_frame_metrics_through(conn, cursor_ms)
    metric_frames = dedupe_frames_for_metrics(
        [metrics_frame_from_row(row) for row in metric_rows],
    )

    picker_rows = queries.load_frame_picker_index_through(conn, cursor_ms)
    picker_frames = [picker_index_from_row(row) for row in picker_rows]
    picked = frame_for_elapsed_second(picker_frames, through_seconds)
    display_frame = None
    if picked:
        full_row = queries.load_frame_by_id(conn, picked["frameId"])
        if full_row:
            display_frame = create_frame(full_row)

    rating_rows = queries.load_ratings_at_second(conn, through_seconds)
    ratings = [
        create_player_rating(row)
        for row in flatten_rating_rows(rating_rows)
    ]

    all_events = sorted(
        [*events, *phases],
        key=lambda item: (item["timeMilliseconds"], item["sequence"]),
    )
    timeline_events = [
        event
        for event in events
        if event.get("timelineEvent") and event["type"] in MAJOR_EVENT_TYPES
    ]
    decisions = [decision_from_event(event) for event in events if event.get("decision")]
    score = score_at(all_events)

    return {
        "match": {**ref["match"], "score": score},
        "stats": derive_stats(events, metric_frames),
        "clock": format_clock(through_seconds),
        "cursor": through_seconds,
        "events": events,
        "timelineEvents": timeline_events,
        "decisions": decisions,
        "momentum": create_mock_momentum(metric_frames),
        "phases": phases,
        "frame": display_frame,
        "ratings": ratings,
        "people": ref["people"],
        "officials": ref["officials"],
        "rules": ref["rules"],
        "precedents": ref["precedents"],
        "dataSource": {"ok": True, "backend": "postgresql"},
    }
