from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from providers.microsoft import chat as microsoft_chat

app = FastAPI(title="football-agent")


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatContext(BaseModel):
    tab: Literal["pitch", "match", "tactics"] = "pitch"


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)
    context: ChatContext | None = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/match")
def match():
    return {
        "service": "football-agent",
        "status": "ok",
        "message": "Agent service is running.",
    }


@app.post("/api/chat")
async def chat_endpoint(body: ChatRequest):
    payload: dict[str, Any] = {
        "messages": [message.model_dump() for message in body.messages],
        "context": body.context.model_dump() if body.context else {},
    }
    try:
        return await microsoft_chat(payload["messages"], payload.get("context"))
    except (RuntimeError, ValueError) as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
