from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from chat.service import generate_adjudication, generate_commentary
from providers.microsoft import chat as microsoft_chat

router = APIRouter(tags=["chat"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatContext(BaseModel):
    tab: Literal["pitch", "match", "tactics", "overview"] = "pitch"
    incident: dict[str, Any] | None = None
    minuteContext: dict[str, Any] | None = None


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)
    context: ChatContext | None = None


class CommentaryRequest(BaseModel):
    eventId: str
    facts: dict[str, Any] = Field(default_factory=dict)


class AdjudicateRequest(BaseModel):
    incidentId: str | None = None
    incidentRegistryId: str | None = None
    precedentTypes: list[str] = Field(default_factory=list)
    precedentCaseIds: list[str] = Field(default_factory=list)
    ruleCriteria: list[dict[str, Any]] = Field(default_factory=list)
    decision: dict[str, Any] | None = None
    eventFacts: dict[str, Any] | None = None
    recordedDecision: dict[str, Any] | None = None


@router.post("/api/chat")
async def chat_endpoint(body: ChatRequest):
    payload: dict[str, Any] = {
        "messages": [message.model_dump() for message in body.messages],
        "context": body.context.model_dump() if body.context else {},
    }
    try:
        return await microsoft_chat(payload["messages"], payload.get("context"))
    except (RuntimeError, ValueError) as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.post("/api/commentary")
async def commentary_endpoint(body: CommentaryRequest):
    try:
        line = await generate_commentary(body.facts)
        return {"eventId": body.eventId, "text": line}
    except Exception as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.post("/api/adjudicate")
async def adjudicate_endpoint(body: AdjudicateRequest):
    try:
        return await generate_adjudication(body.model_dump())
    except Exception as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
