import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from agent_framework import Agent, Message
from agent_framework.foundry import FoundryChatClient
from agent_framework.openai import OpenAIChatClient
from azure.identity import DefaultAzureCredential
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

INSTRUCTIONS = (
    "You are the Football Desk assistant for a football-themed workspace with "
    "Pitch (3D), Match, and Tactics tabs. Answer in clear, conversational English. "
    "Keep replies concise unless the user asks for detail. "
    "You cannot control the 3D scene in this build; do not promise overlays or camera moves."
)


@lru_cache(maxsize=1)
def _credential() -> DefaultAzureCredential:
    return DefaultAzureCredential()


def _foundry_openai_base_url(project_endpoint: str) -> str:
    return project_endpoint.rstrip("/") + "/openai/v1"


@lru_cache(maxsize=1)
def _agent() -> Agent:
    endpoint = os.environ.get("FOUNDRY_PROJECT_ENDPOINT", "").strip()
    model = os.environ.get("FOUNDRY_MODEL", "").strip()
    api_key = os.environ.get("FOUNDRY_API_KEY", "").strip()
    if not endpoint or not model:
        raise RuntimeError(
            "Missing FOUNDRY_PROJECT_ENDPOINT or FOUNDRY_MODEL. "
            "Copy apps/agent/.env.example to apps/agent/.env and fill in your Foundry project."
        )

    if api_key:
        # Same Project endpoint + API key shown on the Foundry project / deployment pages.
        client = OpenAIChatClient(
            model=model,
            api_key=api_key,
            base_url=_foundry_openai_base_url(endpoint),
        )
    else:
        client = FoundryChatClient(
            project_endpoint=endpoint,
            model=model,
            credential=_credential(),
        )

    return Agent(
        client=client,
        name="FootballDeskAgent",
        instructions=INSTRUCTIONS,
    )


def _to_framework_messages(messages: list[dict[str, Any]]) -> list[Message]:
    framework_messages: list[Message] = []
    for message in messages:
        role = message.get("role", "user")
        content = message.get("content", "")
        if not isinstance(content, str) or not content.strip():
            continue
        framework_messages.append(Message(role=role, contents=content))
    return framework_messages


async def chat(
    messages: list[dict[str, Any]], context: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Call Microsoft Foundry via Agent Framework and return the wire-format chat payload."""
    tab = (context or {}).get("tab", "pitch")
    framework_messages = _to_framework_messages(messages)
    if not framework_messages:
        raise ValueError("No messages to send to the agent.")

    tab_note = Message(role="system", contents=f"The user is currently on the {tab} tab.")
    result = await _agent().run([*framework_messages, tab_note])
    text = (result.text or "").strip()
    if not text:
        raise RuntimeError("Foundry returned an empty response.")

    return {
        "message": {"role": "assistant", "content": text},
        "actions": [],
    }
