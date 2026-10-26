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


def _fraction_from_group(value: str | None) -> float:
    if not value:
        return 0.0
    return int(value.ljust(3, "0")) / 1000.0


def parse_clock_to_seconds(value: str = DEFAULT_LIVE_CLOCK) -> float:
    added = re.match(r"^(\d+)\+(\d+):([0-5]\d)(?:\.(\d{1,3}))?$", value)
    if added:
        base = int(added.group(1))
        extra = int(added.group(2))
        second = int(added.group(3))
        fraction = _fraction_from_group(added.group(4))
        return (base + extra + (1 if base >= 90 else 0)) * 60 + second + fraction
    plain = re.match(r"^(\d+):([0-5]\d)(?:\.(\d{1,3}))?$", value)
    if not plain:
        raise ValueError("Clock must use MM:SS or period-added-time format.")
    fraction = _fraction_from_group(plain.group(3))
    return int(plain.group(1)) * 60 + int(plain.group(2)) + fraction


def parse_clock_to_milliseconds(value: str) -> int:
    return int(round(parse_clock_to_seconds(value) * 1000))


def parse_clock(value: str = DEFAULT_LIVE_CLOCK) -> int:
    return int(parse_clock_to_seconds(value))
