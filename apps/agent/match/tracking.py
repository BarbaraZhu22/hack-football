from psycopg import Connection

from match import queries
from match.constants import MATCH
from match.normalize import create_frame, normalize_people


def create_tracking_window(conn: Connection, from_ms: int, through_ms: int) -> dict:
    frame_rows = queries.load_frames_between(conn, from_ms, through_ms)
    return {
        "match": dict(MATCH),
        "frames": [create_frame(row) for row in frame_rows],
        "people": normalize_people(queries.load_people(conn)),
    }
