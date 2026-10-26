from __future__ import annotations

import json
from typing import Any

from match.constants import MATCH


def number_or_null(value: Any) -> int | float | None:
    if value is None or value == "":
        return None
    try:
        parsed = float(value) if isinstance(value, str) and "." in value else int(value) if isinstance(value, str) else value
        if isinstance(parsed, (int, float)) and (isinstance(parsed, bool) or True):
            if isinstance(parsed, float) and not (parsed == parsed):
                return None
            return parsed
    except (TypeError, ValueError):
        return None
    return None if not isinstance(value, (int, float)) else value


def as_float(value: Any) -> float | None:
    n = number_or_null(value)
    return float(n) if n is not None else None


def as_int(value: Any) -> int | None:
    n = number_or_null(value)
    return int(n) if n is not None else None


def bool_val(value: Any) -> bool:
    if value is True or value is False:
        return value
    return value in (True, "true", "True", 1, "1")


def json_or(value: Any, fallback: Any) -> Any:
    if value is None or value == "":
        return fallback
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return fallback


def team_side(code: str | None) -> str | None:
    if code == MATCH["home"]["code"]:
        return "home"
    if code == MATCH["away"]["code"]:
        return "away"
    return None


def team_for_person(person_id: str | None) -> str | None:
    if not person_id:
        return None
    home = MATCH["home"]["code"] + "-"
    away = MATCH["away"]["code"] + "-"
    if person_id.startswith(home):
        return MATCH["home"]["code"]
    if person_id.startswith(away):
        return MATCH["away"]["code"]
    return None


def player_name(people_by_id: dict[str, dict], person_id: str | None) -> str | None:
    if not person_id:
        return None
    return people_by_id.get(person_id, {}).get("name")


def normalize_event_type(row: dict) -> str:
    raw = row["event_type"]
    outcome = row.get("outcome") or ""
    restart = row.get("restart_type") or ""
    mapping = {
        "phase": "phase",
        "substitution": "sub",
        "var_review": "var",
        "foul_decision": "foul",
        "penalty_awarded": "penalty-awarded",
        "corner_awarded": "corner-awarded",
        "offside_decision": "offside",
        "misconduct_warning": "warning",
        "ball_out": "ball-out",
        "aerial_duel": "aerial-duel",
        "handball_contact": "handball",
    }
    if raw == "goal":
        if outcome == "disallowed":
            return "goal-disallowed"
        return "penalty-goal" if restart == "penalty" else "goal"
    if raw == "penalty_attempt":
        return "penalty-missed" if outcome == "saved" else "penalty-attempt"
    if raw == "card_shown":
        return "red" if outcome == "red" else "yellow"
    if raw == "restart_delivery":
        return "corner-delivery" if restart == "corner" else "free-kick-delivery"
    if raw == "restart_resolution":
        return "restart-resolution"
    return mapping.get(raw, raw)


def phase_label(phase: str) -> str:
    return {
        "kick_off": "Kick-off",
        "half_time": "Half-time",
        "second_half": "Second half",
        "full_time": "Full-time",
    }.get(phase, phase)


def create_event(row: dict, people_by_id: dict[str, dict]) -> dict:
    raw_type = row["event_type"]
    event_type = normalize_event_type(row)
    match_ms = int(row["match_ms"])
    match_seconds = int(row["match_second"])
    player_id = row.get("player_id") or None
    related_player_id = row.get("related_player_id") or None
    awarded = row.get("awarded_team_code") or ""
    team_code = row.get("team_code") or ""
    if raw_type in ("foul_decision", "penalty_awarded", "offside_decision"):
        display_team = awarded or team_code
    elif raw_type == "corner_awarded" and awarded:
        display_team = awarded
    else:
        display_team = team_code
    detail = row.get("decision_detail") or row.get("detail") or ""
    label = row.get("decision_label") or ""
    if not label:
        labels = {
            "goal": f"{display_team} goal",
            "penalty-goal": f"{display_team} penalty goal",
            "goal-disallowed": f"{display_team} goal disallowed",
            "penalty-missed": f"{display_team} penalty saved",
            "sub": "Substitution",
            "var": "VAR review",
            "foul": "Free kick awarded",
            "penalty-awarded": "Penalty awarded",
            "corner-awarded": f"Corner to {display_team}",
            "offside": "Offside given",
            "warning": "Verbal warning",
        }
        if event_type in ("yellow", "red"):
            label = f"{player_name(people_by_id, player_id)} shown a {event_type} card"
        elif event_type == "phase":
            label = phase_label(row.get("phase") or "")
        elif event_type == "corner-delivery":
            label = f"{player_name(people_by_id, player_id)} takes the corner"
        elif event_type == "free-kick-delivery":
            label = f"{player_name(people_by_id, player_id)} takes the {(row.get('restart_type') or '').replace('_', ' ')}"
        elif event_type == "restart-resolution":
            label = f"{player_name(people_by_id, related_player_id)} clears the delivery"
        elif event_type == "aerial-duel":
            label = "Corner delivery contested"
        else:
            label = detail or (row.get("action") or "").replace("_", " ")

    decision_type = row.get("decision_type") or ""
    decision_kind = event_type
    if decision_type == "free_kick_awarded":
        decision_kind = "foul"
    elif decision_type == "penalty_awarded":
        decision_kind = "penalty-awarded"
    elif decision_type == "corner_awarded":
        decision_kind = "corner-awarded"
    elif decision_type == "offside":
        decision_kind = "offside"
    elif decision_type == "card":
        decision_kind = "red" if row.get("outcome") == "red" else "yellow"
    elif decision_type == "misconduct_warning":
        decision_kind = "warning"
    decision_label = row.get("decision_label") or label

    event = {
        "id": row["event_id"],
        "eventId": row["event_id"],
        "sequence": int(row["sequence"]),
        "chainId": row["chain_id"],
        "parentEventId": row.get("parent_event_id") or None,
        "type": event_type,
        "rawType": raw_type,
        "action": row["action"],
        "outcome": row.get("outcome") or "",
        "phase": row.get("phase") or None,
        "period": int(row["period"]),
        "periodMilliseconds": int(row["period_ms"]),
        "timeMilliseconds": match_ms,
        "timeSeconds": match_seconds,
        "clockSeconds": match_seconds,
        "clockLabel": row["clock_label"],
        "minute": match_seconds // 60,
        "minuteLabel": row.get("minute_label") or "",
        "second": match_seconds % 60,
        "team": team_side(display_team),
        "teamCode": display_team or None,
        "offenderTeamCode": team_code or None,
        "awardedTeamCode": awarded or None,
        "playerId": player_id,
        "player": player_name(people_by_id, player_id),
        "relatedPlayerId": related_player_id,
        "relatedPlayer": player_name(people_by_id, related_player_id),
        "targetPlayerId": row.get("target_player_id") or None,
        "goalkeeperId": row.get("goalkeeper_id") or None,
        "assist": player_name(people_by_id, related_player_id) if raw_type == "goal" else None,
        "replaced": player_name(people_by_id, related_player_id) if raw_type == "substitution" else None,
        "participantIds": json_or(row.get("participant_ids"), []),
        "decision": bool_val(row.get("decision")),
        "decisionType": decision_type,
        "decisionKind": decision_kind,
        "decisionLabel": decision_label,
        "decisionDetail": row.get("decision_detail") or "",
        "restartType": row.get("restart_type") or "",
        "score": (
            (row.get("score") or "")
            if (raw_type == "goal" and row.get("outcome") != "disallowed") or raw_type == "phase"
            else ""
        ),
        "scoreHome": as_int(row.get("score_home")) or 0,
        "scoreAway": as_int(row.get("score_away")) or 0,
        "scoreDelta": as_int(row.get("score_delta")) or 0,
        "isShot": bool_val(row.get("is_shot")),
        "countInStats": bool_val(row.get("count_in_stats")),
        "shotOnTarget": bool_val(row.get("shot_on_target")),
        "bigChance": bool_val(row.get("big_chance")),
        "xg": as_float(row.get("xg")),
        "passCompleted": None if row.get("pass_completed") in (None, "") else bool_val(row.get("pass_completed")),
        "duelWon": None if row.get("duel_won") in (None, "") else bool_val(row.get("duel_won")),
        "countsAsFoul": bool_val(row.get("counts_as_foul")),
        "countsAsSave": bool_val(row.get("counts_as_save")),
        "incidentId": row.get("incident_id") or "",
        "timelineEvent": bool_val(row.get("is_timeline_event")),
        "showInCommentary": bool_val(row.get("show_in_commentary")),
        "commentary": row.get("commentary") or "",
        "note": row.get("detail") or row.get("decision_detail") or "",
        "label": label,
        "frameId": row["frame_id"],
        "location": {
            "x": as_float(row.get("location_x")),
            "y": as_float(row.get("location_y")),
            "targetX": as_float(row.get("target_x")),
            "targetY": as_float(row.get("target_y")),
        },
    }
    if raw_type == "phase":
        event["label"] = phase_label(row.get("phase") or "")
    if event["decision"]:
        event["decisionLabel"] = decision_label
    return event


def create_frame(row: dict) -> dict:
    match_ms = int(float(row["match_ms"]))
    time_seconds = float(row["match_second"])
    period_ms = int(float(row["period_ms"]))
    actors_raw = json_or(row.get("actors"), [])
    actors = []
    for actor in actors_raw:
        actors.append(
            {
                **actor,
                "number": as_int(actor.get("no")),
                "x": float(actor["x"]),
                "y": float(actor["y"]),
                "z": float(actor.get("z") or 0),
            }
        )
    return {
        "id": row["frame_id"],
        "frameId": row["frame_id"],
        "period": int(float(row["period"])),
        "periodMilliseconds": period_ms,
        "timeMilliseconds": match_ms,
        "timeSeconds": time_seconds,
        "clockSeconds": time_seconds,
        "clockLabel": row["clock_label"],
        "ball": {
            "x": float(row["ball_x"]),
            "y": float(row["ball_y"]),
            "z": float(row["ball_z"]),
            "motion": row.get("ball_motion") or "",
            "interactionEventId": row.get("ball_interaction_event_id") or None,
            "fromPlayerId": row.get("ball_from_player_id") or None,
            "toPlayerId": row.get("ball_to_player_id") or None,
        },
        "possession": {
            "team": team_side(row.get("possession_team")),
            "teamCode": row.get("possession_team") or None,
            "playerId": row.get("possession_player_id") or None,
            "number": as_int(row.get("possession_no")),
        },
        "eventIds": json_or(row.get("event_ids"), []),
        "actors": actors,
    }


def flatten_rating_rows(rows: list[dict]) -> list[dict]:
    if not rows:
        return []
    if rows[0].get("ratings") is not None and rows[0].get("player_id") is None:
        flat: list[dict] = []
        for row in rows:
            for entry in json_or(row.get("ratings"), []):
                flat.append(
                    {
                        **entry,
                        "match_second": row["match_second"],
                        "period": row["period"],
                        "period_ms": row["period_ms"],
                        "clock_label": row["clock_label"],
                        "frame_id": row["frame_id"],
                    }
                )
        return flat
    return rows


def create_player_rating(row: dict) -> dict:
    match_second = float(row["match_second"])
    time_ms = int(round(match_second * 1000))
    return {
        "id": row["rating_id"],
        "frameId": row["frame_id"],
        "timeMilliseconds": time_ms,
        "timeSeconds": match_second,
        "matchSecond": match_second,
        "period": int(float(row["period"])),
        "periodMilliseconds": int(float(row["period_ms"])),
        "clockLabel": row["clock_label"],
        "playerId": row["player_id"],
        "teamCode": row["team_code"],
        "playerName": row["player_name"],
        "playerStatus": row["player_status"],
        "rating": as_float(row.get("rating")),
        "ratingDelta": as_float(row.get("rating_delta")) or 0,
        "eventIds": json_or(row.get("event_ids"), []),
        "changeReason": row.get("change_reason") or "",
        "source": row.get("source") or "",
    }


def normalize_people(rows: list[dict]) -> list[dict]:
    result = []
    for row in rows:
        person_id = row.get("person_id") or ""
        if not person_id and row.get("team") and row.get("no"):
            person_id = f"{row['team']}-{row['no']}"
        elif not person_id and row.get("role") == "head_coach":
            person_id = f"{row['team']}-coach"
        result.append(
            {
                "personId": person_id or None,
                "team": team_side(row.get("team")),
                "teamCode": row.get("team"),
                "number": as_int(row.get("no")),
                "name": row.get("name"),
                "position": row.get("pos") or "",
                "squadRole": row.get("xi") or "",
                "role": row.get("role") or "",
            }
        )
    return result


def normalize_officials(rows: list[dict]) -> list[dict]:
    return [
        {
            "officialId": row.get("official_id") or f"OFFICIAL-{row['role']}",
            "role": row["role"],
            "name": row["name"],
            "history": json_or(row.get("history"), []),
        }
        for row in rows
    ]


def normalize_rules(rows: list[dict]) -> list[dict]:
    return [{**row, "incident_types": json_or(row.get("incident_types"), [])} for row in rows]


def normalize_precedents(rows: list[dict]) -> list[dict]:
    result = []
    for row in rows:
        clean = {key: value for key, value in row.items() if key not in {"similarity", "match_incident_id"}}
        law_refs = json_or(row.get("law_refs"), [])
        tags = json_or(row.get("tags"), [])
        matchweek = as_int(row.get("matchweek"))
        result.append(
            {
                **clean,
                "matchweek": matchweek,
                "law_refs": law_refs,
                "tags": tags,
                "caseId": row.get("id") or "",
                "incidentType": row.get("incident_type") or "",
                "incidentSubtype": row.get("incident_subtype") or "",
                "lawEdition": row.get("law_edition") or "",
                "lawRefs": law_refs,
                "onFieldDecision": row.get("on_field_decision") or "",
                "varAction": row.get("var_action") or "",
                "finalDecision": row.get("final_decision") or "",
                "assessment": {
                    "status": row.get("assessment_status") or "not_stated",
                    "authority": row.get("assessment_authority") or "",
                    "summary": row.get("assessment_text") or "",
                },
                "source": {
                    "title": row.get("source_title") or "",
                    "url": row.get("source_url") or "",
                },
            }
        )
    return result


def decision_from_event(event: dict) -> dict:
    team_code = event.get("awardedTeamCode") or event.get("teamCode")
    law_reference = {
        "free_kick_awarded": "Law 12",
        "penalty_awarded": "Law 14",
        "corner_awarded": "Law 17",
        "offside": "Law 11",
        "card": "Law 12",
        "misconduct_warning": "Law 12",
    }.get(event.get("decisionType") or "", "")
    incident_type = {
        "offside": "questionable",
        "handball": "questionable",
        "tackle": "controversial",
        "conflict": "controversial",
    }.get(event.get("incidentId") or "", "correct")
    return {
        "id": f"decision-{event['id']}",
        "eventId": event["id"],
        "minute": event["minute"],
        "minuteLabel": event.get("minuteLabel"),
        "second": event["second"],
        "type": incident_type,
        "decisionKind": event.get("decisionKind"),
        "label": event.get("decisionLabel") or event.get("label"),
        "detail": event.get("decisionDetail") or event.get("note"),
        "team": team_side(team_code),
        "teamCode": team_code,
        "player": event.get("player"),
        "playerId": event.get("playerId"),
        "relatedPlayer": event.get("relatedPlayer"),
        "incidentId": event.get("incidentId"),
        "meta": law_reference,
    }


def score_at(events: list[dict]) -> list[int]:
    if not events:
        return [0, 0]
    latest = events[-1]
    return [latest.get("scoreHome", 0), latest.get("scoreAway", 0)]


def _side_aggregate(events: list[dict], frames: list[dict], side: str) -> dict:
    code = MATCH["home"]["code"] if side == "home" else MATCH["away"]["code"]

    def on_side(event: dict) -> bool:
        return event.get("offenderTeamCode") == code or event.get("teamCode") == code

    shots = [e for e in events if e.get("isShot") and e.get("countInStats") and on_side(e)]
    passes = [e for e in events if e.get("rawType") == "pass" and e.get("teamCode") == code]
    completed = [e for e in passes if e.get("passCompleted")]
    duels = [e for e in events if e.get("rawType") == "duel" and e.get("duelWon") and e.get("teamCode") == code]
    frames_with = [f for f in frames if f.get("possession", {}).get("teamCode")]
    possession_count = sum(1 for f in frames_with if f["possession"]["teamCode"] == code)
    possession_total = len(frames_with) or 1
    fouls = [
        e
        for e in events
        if e.get("countsAsFoul")
        and (team_for_person(e.get("playerId")) == code or e.get("offenderTeamCode") == code)
    ]
    saves = [e for e in events if e.get("countsAsSave") and e.get("teamCode") == code]
    cards = [
        e
        for e in events
        if e.get("rawType") == "card_shown" and e.get("teamCode") == code and e.get("outcome") == "yellow"
    ]
    return {
        "possession": round(possession_count / possession_total * 100),
        "shots": len(shots),
        "shotsOnTarget": sum(1 for e in shots if e.get("shotOnTarget")),
        "bigChances": sum(1 for e in shots if e.get("bigChance")),
        "expectedGoals": round(sum((e.get("xg") or 0) for e in shots), 2),
        "passes": len(passes),
        "passAccuracy": round(len(completed) / len(passes) * 100) if passes else 0,
        "duelsWon": len(duels),
        "corners": sum(1 for e in events if e.get("rawType") == "corner_awarded" and e.get("teamCode") == code),
        "offsides": sum(
            1 for e in events if e.get("rawType") == "offside_decision" and e.get("offenderTeamCode") == code
        ),
        "saves": len(saves),
        "fouls": len(fouls),
        "yellowCards": len(cards),
    }


def derive_stats(events: list[dict], frames: list[dict]) -> list[dict]:
    home = _side_aggregate(events, frames, "home")
    away = _side_aggregate(events, frames, "away")
    return [
        {"label": "Possession", "home": home["possession"], "away": away["possession"], "unit": "%"},
        {"label": "Shots", "home": home["shots"], "away": away["shots"]},
        {"label": "Shots on target", "home": home["shotsOnTarget"], "away": away["shotsOnTarget"]},
        {"label": "Big chances", "home": home["bigChances"], "away": away["bigChances"]},
        {"label": "Expected goals", "home": home["expectedGoals"], "away": away["expectedGoals"]},
        {"label": "Passes", "home": home["passes"], "away": away["passes"]},
        {"label": "Pass accuracy", "home": home["passAccuracy"], "away": away["passAccuracy"], "unit": "%"},
        {"label": "Duels won", "home": home["duelsWon"], "away": away["duelsWon"]},
        {"label": "Corners", "home": home["corners"], "away": away["corners"]},
        {"label": "Offsides", "home": home["offsides"], "away": away["offsides"]},
        {"label": "Saves", "home": home["saves"], "away": away["saves"]},
        {"label": "Fouls", "home": home["fouls"], "away": away["fouls"]},
        {"label": "Yellow cards", "home": home["yellowCards"], "away": away["yellowCards"]},
    ]


def create_mock_momentum(frames: list[dict]) -> list[float]:
    last_second = int(frames[-1]["timeSeconds"]) if frames else 0
    buckets = max(1, (last_second + 1 + 119) // 120)
    sums = [{"possession": 0, "territorial": 0, "count": 0} for _ in range(buckets)]
    home_code = MATCH["home"]["code"]
    for frame in frames:
        team_code = frame.get("possession", {}).get("teamCode")
        if not team_code:
            continue
        bucket = int(frame["timeSeconds"]) // 120
        if bucket >= len(sums):
            continue
        s = sums[bucket]
        s["possession"] += 1 if team_code == home_code else -1
        home_attacks_positive_x = frame["period"] == 1
        home_progress = (frame["ball"]["x"] if home_attacks_positive_x else -frame["ball"]["x"]) / 52.5
        s["territorial"] += max(-1, min(1, home_progress))
        s["count"] += 1
    result = []
    for s in sums:
        if not s["count"]:
            result.append(0)
            continue
        value = (s["possession"] / s["count"]) * 0.7 + (s["territorial"] / s["count"]) * 0.3
        result.append(round(max(-1, min(1, value)), 2))
    return result


def build_people_by_id(people: list[dict]) -> dict[str, dict]:
    return {p["personId"]: p for p in people if p.get("personId")}
