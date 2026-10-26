FIRST_HALF_SECONDS = 46 * 60
SECOND_HALF_SECONDS = 48 * 60
MATCH_SECONDS = FIRST_HALF_SECONDS + SECOND_HALF_SECONDS

MATCH = {
    "competition": "Premier League",
    "round": "Matchweek 29",
    "home": {
        "code": "MCI",
        "name": "Manchester City",
        "shortName": "City",
        "color": "#6CABDD",
        "text": "#0b2132",
    },
    "away": {
        "code": "ARS",
        "name": "Arsenal",
        "shortName": "Arsenal",
        "color": "#EF0107",
        "text": "#ffffff",
    },
    "score": [0, 0],
    "clock": "78:32",
    "stadium": "Etihad Stadium",
    "attendance": "54,118",
    "incidentId": "MCI-ARS-7829-04",
}

MAJOR_EVENT_TYPES = frozenset(
    {"goal", "penalty-goal", "penalty-missed", "yellow", "red", "sub", "var"}
)
