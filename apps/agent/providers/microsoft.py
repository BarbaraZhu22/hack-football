from typing import Any


def chat(messages: list[dict[str, Any]], context: dict[str, Any] | None = None) -> dict[str, Any]:
    """Microsoft agent adapter placeholder.

    Wire the official Microsoft agent SDK here. The web app only talks to
    FastAPI via /api/chat and never imports this module.
    """
    tab = (context or {}).get("tab", "pitch")
    last_user = next(
        (message.get("content", "") for message in reversed(messages) if message.get("role") == "user"),
        "",
    )

    reply = (
        f"Microsoft agent placeholder on {tab} tab. "
        f'I received: "{last_user}". '
        "Connect providers.microsoft.chat to your agent when ready."
    )

    actions: list[dict[str, Any]] = []
    if tab == "tactics" and last_user:
        actions.append(
            {
                "type": "arrow.add",
                "id": "agent-demo",
                "from": [-2, 0.2, 2],
                "to": [4, 0.2, -2],
            }
        )

    return {
        "message": {"role": "assistant", "content": reply},
        "actions": actions,
    }
