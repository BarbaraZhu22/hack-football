import json

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from config import DEFAULT_LIVE_CLOCK
from db.connection import db_connection
from match.clock import parse_clock, parse_clock_to_milliseconds
from match.normalize import normalize_precedents
from match import queries
from match.stream import match_event_stream, parse_after_seconds
from match.snapshot import create_snapshot
from match.tracking import create_tracking_window

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
        after_seconds = parse_after_seconds(after)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    try:
        with db_connection() as conn:
            create_snapshot(conn, after_seconds)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

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


@router.get("/api/match/precedents")
def get_match_precedents(type: list[str] = Query(default=[])):
    incident_types = [value for value in type if value]
    if not incident_types:
        raise HTTPException(status_code=400, detail="At least one incident type is required.")
    try:
        with db_connection() as conn:
            rows = queries.load_precedents_by_types(conn, incident_types)
            precedents = normalize_precedents(rows)
        return {"precedents": precedents}
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.get("/api/match/tracking")
def get_match_tracking(
    from_clock: str = Query(..., alias="from"),
    through_clock: str = Query(..., alias="through"),
):
    if not from_clock or not through_clock:
        raise HTTPException(status_code=400, detail="Both from and through clocks are required.")
    try:
        from_ms = parse_clock_to_milliseconds(from_clock)
        through_ms = parse_clock_to_milliseconds(through_clock)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if through_ms < from_ms:
        raise HTTPException(
            status_code=400,
            detail="The through clock must be at or after the from clock.",
        )
    try:
        with db_connection() as conn:
            return create_tracking_window(conn, from_ms, through_ms)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
