import re

from match.constants import FIRST_HALF_SECONDS, MATCH_SECONDS

DEFAULT_LIVE_CLOCK = "78:32"


def format_clock(total_seconds: int) -> dict:
    seconds = max(0, int(total_seconds))
    second = seconds % 60
    if seconds >= MATCH_SECONDS:
        label = "90+3:00"
    elif seconds > 45 * 60 and seconds < FIRST_HALF_SECONDS:
        label = f"45+1:{seconds - 45 * 60:02d}"
    elif seconds > FIRST_HALF_SECONDS + 45 * 60:
        added = (seconds - FIRST_HALF_SECONDS - 45 * 60 + 59) // 60
        label = f"90+{added}:{second:02d}"
    else:
        label = f"{seconds // 60}:{second:02d}"
    return {
        "seconds": seconds,
        "minute": seconds // 60,
        "second": second,
        "label": label,
        "finished": seconds >= MATCH_SECONDS,
    }


def parse_clock(value: str = DEFAULT_LIVE_CLOCK) -> int:
    added = re.match(r"^(\d+)\+(\d+):([0-5]\d)$", value)
    if added:
        base = int(added.group(1))
        extra = int(added.group(2))
        second = int(added.group(3))
        return (base + extra + (1 if base >= 90 else 0)) * 60 + second
    plain = re.match(r"^(\d+):([0-5]\d)$", value)
    if not plain:
        raise ValueError("Clock must use MM:SS or period-added-time format.")
    return int(plain.group(1)) * 60 + int(plain.group(2))
