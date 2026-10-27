import os
from functools import lru_cache

from agent_framework.foundry import FoundryChatClient
from agent_framework.openai import OpenAIChatClient
from azure.identity import DefaultAzureCredential


@lru_cache(maxsize=1)
def _credential() -> DefaultAzureCredential:
    return DefaultAzureCredential()


def foundry_openai_base_url(project_endpoint: str) -> str:
    return project_endpoint.rstrip("/") + "/openai/v1"


def build_chat_client():
    endpoint = os.environ.get("FOUNDRY_PROJECT_ENDPOINT", "").strip()
    model = os.environ.get("FOUNDRY_MODEL", "").strip()
    api_key = os.environ.get("FOUNDRY_API_KEY", "").strip()
    if not endpoint or not model:
        raise RuntimeError(
            "Missing FOUNDRY_PROJECT_ENDPOINT or FOUNDRY_MODEL. "
            "Copy apps/agent/.env.example to apps/agent/.env and fill in your Foundry project."
        )

    if api_key:
        return OpenAIChatClient(
            model=model,
            api_key=api_key,
            base_url=foundry_openai_base_url(endpoint),
        )
    return FoundryChatClient(
        project_endpoint=endpoint,
        model=model,
        credential=_credential(),
    )
