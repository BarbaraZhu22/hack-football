from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

from chat.catalog import get_precedents, get_rules
from chat.routes import router as chat_router
from match.routes import router as match_router

load_dotenv(Path(__file__).resolve().parent / ".env")

app = FastAPI(title="football-agent")


@app.on_event("startup")
def warm_reference_catalog() -> None:
    try:
        get_rules()
        get_precedents()
    except RuntimeError:
        # DATABASE_URL may be unset in local smoke without Postgres; tools retry on first use.
        pass
app.include_router(match_router)
app.include_router(chat_router)


@app.get("/health")
def health():
    return {"status": "ok"}
