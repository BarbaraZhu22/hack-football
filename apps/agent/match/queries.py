from psycopg import Connection


def load_people(conn: Connection) -> list[dict]:
    return conn.execute("SELECT * FROM people ORDER BY person_id").fetchall()


def load_officials(conn: Connection) -> list[dict]:
    return conn.execute("SELECT * FROM officials ORDER BY official_id").fetchall()


def load_rules(conn: Connection) -> list[dict]:
    return conn.execute("SELECT * FROM rules ORDER BY ref").fetchall()


def load_precedents(conn: Connection) -> list[dict]:
    return conn.execute("SELECT * FROM precedents ORDER BY id").fetchall()


def _through_ms(through_second: int) -> int:
    return through_second * 1000


def load_events_through(conn: Connection, through_second: int) -> list[dict]:
    return conn.execute(
        """
        SELECT * FROM events
        WHERE match_ms::numeric <= %s
        ORDER BY match_ms, sequence
        """,
        (_through_ms(through_second),),
    ).fetchall()


def load_frames_through(conn: Connection, through_second: int) -> list[dict]:
    return conn.execute(
        """
        SELECT * FROM frames
        WHERE match_ms::numeric <= %s
        ORDER BY match_ms
        """,
        (_through_ms(through_second),),
    ).fetchall()


def load_ratings_through(conn: Connection, through_second: int) -> list[dict]:
    return conn.execute(
        """
        SELECT match_second, period, period_ms, clock_label, frame_id, ratings
        FROM player_ratings
        WHERE (match_second::numeric * 1000) <= %s
        ORDER BY match_second::numeric
        """,
        (_through_ms(through_second),),
    ).fetchall()


def load_precedents_by_types(conn: Connection, incident_types: list[str]) -> list[dict]:
    return conn.execute(
        """
        SELECT * FROM precedents
        WHERE incident_type = ANY(%s)
        ORDER BY season DESC, fixture ASC
        """,
        (incident_types,),
    ).fetchall()


def load_frames_between(conn: Connection, from_ms: int, through_ms: int) -> list[dict]:
    return conn.execute(
        """
        SELECT * FROM frames
        WHERE match_ms::numeric >= %s AND match_ms::numeric <= %s
        ORDER BY match_ms
        """,
        (from_ms, through_ms),
    ).fetchall()


def load_all_events(conn: Connection) -> list[dict]:
    return conn.execute("SELECT * FROM events ORDER BY match_ms, sequence").fetchall()


def load_all_frames(conn: Connection) -> list[dict]:
    return conn.execute("SELECT * FROM frames ORDER BY match_ms").fetchall()


def load_all_ratings(conn: Connection) -> list[dict]:
    return conn.execute(
        "SELECT match_second, period, period_ms, clock_label, frame_id, ratings FROM player_ratings ORDER BY match_second::numeric"
    ).fetchall()
