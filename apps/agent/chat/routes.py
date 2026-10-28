from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from chat.service import adjudication_event_stream, generate_adjudication, generate_commentary
from providers.microsoft import chat_stream as microsoft_chat_stream

router = APIRouter(tags=["chat"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatContext(BaseModel):
    tab: Literal["pitch", "match", "tactics", "game", "overview"] = "pitch"
    incident: dict[str, Any] | None = None
    minuteContext: dict[str, Any] | None = None
    pitch: dict[str, Any] | None = None


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)
    context: ChatContext | None = None
    adjudicate: bool = False


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
    offside: dict[str, Any] | None = None


@router.post("/api/chat")
async def chat_endpoint(body: ChatRequest):
    payload: dict[str, Any] = {
        "messages": [message.model_dump() for message in body.messages],
        "context": body.context.model_dump() if body.context else {},
        "adjudicate": body.adjudicate,
    }

    async def event_stream():
        async for chunk in microsoft_chat_stream(
            payload["messages"],
            payload.get("context"),
            adjudicate=bool(payload.get("adjudicate")),
        ):
            yield chunk

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.post("/api/commentary")
async def commentary_endpoint(body: CommentaryRequest):
    try:
        line = await generate_commentary(body.facts)
        return {"eventId": body.eventId, "text": line}
    except Exception as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.post("/api/adjudicate/stream")
async def adjudicate_stream_endpoint(body: AdjudicateRequest):
    async def event_stream():
        async for chunk in adjudication_event_stream(body.model_dump()):
            yield chunk

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.post("/api/adjudicate")
async def adjudicate_endpoint(body: AdjudicateRequest):
    try:
        return await generate_adjudication(body.model_dump())
    except Exception as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
