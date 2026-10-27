"""Shared incident → precedent table type mapping (matches web IncidentAgentPanel)."""

INCIDENT_PRECEDENT_TYPES: dict[str, list[str]] = {
    "tackle": ["serious_foul_play"],
    "offside": ["offside", "offside_and_red_card"],
    "handball": ["handball"],
    "conflict": ["violent_conduct"],
}
