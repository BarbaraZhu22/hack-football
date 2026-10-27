from agent_framework import tool

from chat.analysis import smart_analysis_json
from chat.catalog import precedents_json, rules_json


@tool
def search_precedents(incident_type: str) -> str:
    """Search simulated league precedent cases by incident_type (e.g. serious_foul_play, offside)."""
    return precedents_json(incident_type.strip())


@tool
def search_rules(incident_type: str) -> str:
    """Search IFAB / protocol rule rows whose incident_types include the given type."""
    return rules_json(incident_type.strip())


@tool
def show_analysis(incident_type: str, ruling: str, summary: str) -> str:
    """Publish the ruling card. incident_type is a precedent id such as serious_foul_play, not the ruling text."""
    return smart_analysis_json(incident_type.strip(), ruling, summary)


REFERENCE_TOOLS = [search_precedents, search_rules]
DESK_TOOLS = [*REFERENCE_TOOLS, show_analysis]
