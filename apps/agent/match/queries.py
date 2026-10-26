from psycopg import Connection


def load_people(conn: Connection) -> list[dict]:
    return conn.execute("SELECT * FROM people ORDER BY person_id").fetchall()


def load_officials(conn: Connection) -> list[dict]:
    return conn.execute("SELECT * FROM officials ORDER BY official_id").fetchall()


def load_rules(conn: Connection) -> list[dict]:
    return conn.execute("SELECT * FROM rules ORDER BY ref").fetchall()


def load_precedents(conn: Connection) -> list[dict]:
    return conn.execute("SELECT * FROM precedents ORDER BY id").fetchall()


def load_events_through(conn: Connection, through_second: int) -> list[dict]:
    return conn.execute(
        """
        SELECT * FROM events
        WHERE match_second::int <= %s
        ORDER BY match_ms, sequence
        """,
        (through_second,),
    ).fetchall()


def load_frames_through(conn: Connection, through_second: int) -> list[dict]:
    return conn.execute(
        """
        SELECT * FROM frames
        WHERE match_second::int <= %s
        ORDER BY match_second
        """,
        (through_second,),
    ).fetchall()


def load_ratings_through(conn: Connection, through_second: int) -> list[dict]:
    return conn.execute(
        """
        SELECT match_second, period, period_ms, clock_label, frame_id, ratings
        FROM player_ratings
        WHERE match_second::int <= %s
        ORDER BY match_second::int
        """,
        (through_second,),
    ).fetchall()


def load_all_events(conn: Connection) -> list[dict]:
    return conn.execute("SELECT * FROM events ORDER BY match_ms, sequence").fetchall()


def load_all_frames(conn: Connection) -> list[dict]:
    return conn.execute("SELECT * FROM frames ORDER BY match_second").fetchall()


def load_all_ratings(conn: Connection) -> list[dict]:
    return conn.execute(
        "SELECT match_second, period, period_ms, clock_label, frame_id, ratings FROM player_ratings ORDER BY match_second::int"
    ).fetchall()
