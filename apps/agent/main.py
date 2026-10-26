import os
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from psycopg.rows import dict_row

from providers.microsoft import chat as microsoft_chat

load_dotenv(Path(__file__).resolve().parent / ".env")

app = FastAPI(title="football-agent")

TABLES = ("frames", "events", "people", "officials", "rules", "precedents")


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatContext(BaseModel):
    tab: Literal["pitch", "match", "tactics"] = "pitch"


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)
    context: ChatContext | None = None


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise HTTPException(status_code=503, detail="DATABASE_URL is not configured.")
    return url


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/match")
def match(
    half: int = Query(1, ge=1, le=2),
    t_ms: int = Query(0, ge=0),
    limit: int = Query(1, ge=1, le=5),
):
    import psycopg

    base = {
        "service": "football-agent",
        "status": "ok",
        "message": "Agent service is running.",
    }
    try:
        with psycopg.connect(_database_url(), row_factory=dict_row) as conn:
            counts: dict[str, int] = {}
            for table in TABLES:
                row = conn.execute(f"SELECT count(*) AS n FROM {table}").fetchone()
                counts[table] = int(row["n"])

            frame_rows = conn.execute(
                """
                SELECT half, t_ms, ball_x, ball_y, ball_z,
                       possession_team, possession_no,
                       jsonb_array_length(actors) AS actor_count
                FROM frames
                WHERE half = %s AND t_ms >= %s
                ORDER BY t_ms
                LIMIT %s
                """,
                (half, t_ms, limit),
            ).fetchall()

            frames = [
                {
                    "half": row["half"],
                    "t_ms": row["t_ms"],
                    "ball_x": row["ball_x"],
                    "ball_y": row["ball_y"],
                    "ball_z": row["ball_z"],
                    "possession_team": row["possession_team"],
                    "possession_no": row["possession_no"],
                    "actor_count": row["actor_count"],
                }
                for row in frame_rows
            ]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    return {**base, "counts": counts, "frames": frames}


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
