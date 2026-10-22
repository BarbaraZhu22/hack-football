from fastapi import FastAPI

app = FastAPI(title="football-agent")


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
