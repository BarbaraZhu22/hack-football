from psycopg import Connection

from match import queries
from match.constants import MATCH
from match.normalize import (
    build_people_by_id,
    create_event,
    create_frame,
    create_player_rating,
    flatten_rating_rows,
    normalize_officials,
    normalize_people,
    normalize_precedents,
    normalize_rules,
)


def load_reference(conn: Connection) -> dict:
    people = normalize_people(queries.load_people(conn))
    people_by_id = build_people_by_id(people)
    return {
        "match": dict(MATCH),
        "people": people,
        "peopleById": people_by_id,
        "officials": normalize_officials(queries.load_officials(conn)),
        "rules": normalize_rules(queries.load_rules(conn)),
        "precedents": normalize_precedents(queries.load_precedents(conn)),
    }


def load_timeline(conn: Connection, through_second: int | None, people_by_id: dict) -> dict:
    if through_second is None:
        event_rows = queries.load_all_events(conn)
        frame_rows = queries.load_all_frames(conn)
        rating_rows = queries.load_all_ratings(conn)
    else:
        event_rows = queries.load_events_through(conn, through_second)
        frame_rows = queries.load_frames_through(conn, through_second)
        rating_rows = queries.load_ratings_through(conn, through_second)

    mapped = [create_event(row, people_by_id) for row in event_rows]
    return {
        "events": [e for e in mapped if e["type"] != "phase"],
        "phases": [e for e in mapped if e["type"] == "phase"],
        "frames": [create_frame(row) for row in frame_rows],
        "ratings": [create_player_rating(row) for row in flatten_rating_rows(rating_rows)],
    }


def load_full_dataset(conn: Connection) -> dict:
    ref = load_reference(conn)
    timeline = load_timeline(conn, None, ref["peopleById"])
    return {**ref, **timeline, "peopleById": ref["peopleById"]}
