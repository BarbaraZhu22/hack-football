from contextlib import contextmanager
from typing import Iterator

import psycopg
from psycopg import Connection
from psycopg.rows import dict_row

from config import database_url


@contextmanager
def db_connection() -> Iterator[Connection]:
    with psycopg.connect(database_url(), row_factory=dict_row) as conn:
        yield conn
