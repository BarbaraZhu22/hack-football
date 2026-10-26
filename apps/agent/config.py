import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

DEFAULT_LIVE_CLOCK = "78:32"


def database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError("DATABASE_URL is not configured.")
    return url


def match_tick_ms() -> int:
    raw = os.environ.get("MATCH_TICK_MS", "1000")
    try:
        return max(50, int(raw))
    except ValueError:
        return 1000
