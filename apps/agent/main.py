from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

from chat.routes import router as chat_router
from match.routes import router as match_router

load_dotenv(Path(__file__).resolve().parent / ".env")

app = FastAPI(title="football-agent")
app.include_router(match_router)
app.include_router(chat_router)


@app.get("/health")
def health():
    return {"status": "ok"}
