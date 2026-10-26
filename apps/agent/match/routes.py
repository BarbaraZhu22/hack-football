import json

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from config import DEFAULT_LIVE_CLOCK
from db.connection import db_connection
from match.clock import parse_clock
from match.stream import match_event_stream
from match.snapshot import create_snapshot

router = APIRouter(tags=["match"])


@router.get("/api/match")
def get_match_snapshot(through: str = Query(DEFAULT_LIVE_CLOCK)):
    try:
        through_seconds = parse_clock(through)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    try:
        with db_connection() as conn:
            return create_snapshot(conn, through_seconds)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.get("/api/match/stream")
async def get_match_stream(after: str = Query(DEFAULT_LIVE_CLOCK)):
    try:
        if not after.isdigit():
            parse_clock(after)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    async def event_generator():
        try:
            async for chunk in match_event_stream(after):
                yield chunk
        except RuntimeError as error:
            yield f"event: error\ndata: {json.dumps({'detail': str(error)})}\n\n"
        except Exception as error:
            yield f"event: error\ndata: {json.dumps({'detail': str(error)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
