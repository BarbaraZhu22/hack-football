def frame_for_elapsed_second(frames: list[dict], second: int) -> dict | None:
    second_ms = second * 1000
    candidates = [
        frame
        for frame in frames
        if frame["timeMilliseconds"] <= second_ms
        and (second == 0 or frame["timeMilliseconds"] > (second - 1) * 1000)
    ]
    if not candidates:
        candidates = [frame for frame in frames if int(frame["timeSeconds"]) == second]
    if not candidates:
        return None
    return max(candidates, key=lambda frame: frame["timeMilliseconds"])


def picker_index_from_row(row: dict) -> dict:
    match_ms = int(float(row["match_ms"]))
    time_seconds = float(row["match_second"])
    return {
        "frameId": row["frame_id"],
        "timeMilliseconds": match_ms,
        "timeSeconds": time_seconds,
    }
