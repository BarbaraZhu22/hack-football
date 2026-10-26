from psycopg import Connection

from match import queries
from match.dataset import load_reference
from match.frame_picker import picker_index_from_row
from match.normalize import (
    create_event,
    create_player_rating,
    dedupe_frames_for_metrics,
    flatten_rating_rows,
    metrics_frame_from_row,
)


def load_stream_timeline(conn: Connection) -> dict:
    ref = load_reference(conn)
    people_by_id = ref["peopleById"]

    event_rows = queries.load_all_events(conn)
    mapped = [create_event(row, people_by_id) for row in event_rows]
    events = [event for event in mapped if event["type"] != "phase"]
    phases = [event for event in mapped if event["type"] == "phase"]

    metric_rows = queries.load_all_frame_metrics(conn)
    all_metric_frames = dedupe_frames_for_metrics(
        [metrics_frame_from_row(row) for row in metric_rows],
    )

    picker_rows = queries.load_all_frame_picker_index(conn)
    picker_frames = [picker_index_from_row(row) for row in picker_rows]

    ratings_by_second: dict[int, list] = {}
    for row in flatten_rating_rows(queries.load_all_ratings(conn)):
        rating = create_player_rating(row)
        ratings_by_second.setdefault(int(rating["matchSecond"]), []).append(rating)

    return {
        "match": ref["match"],
        "events": events,
        "phases": phases,
        "all_metric_frames": all_metric_frames,
        "picker_frames": picker_frames,
        "ratings_by_second": ratings_by_second,
    }
