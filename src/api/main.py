"""FastAPI backend. Run: uv run uvicorn api.main:app --reload"""

import logging
from functools import lru_cache
from typing import Annotated, Literal

from fastapi import Depends, FastAPI
from pydantic import BaseModel, Field

from companion.config import get_settings, require_provider_keys
from companion.graph import CompanionAgent, build_graph, make_classifier, make_llm
from companion.rag import KnowledgeBase
from companion.tools.mood import MoodEntry, log_mood, read_moods

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("companion.api")
app = FastAPI(title="CompanionAI")


class TurnIn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    session_id: str
    message: str = Field(min_length=1, max_length=4000)
    history: list[TurnIn] = []


class SourceOut(BaseModel):
    title: str
    url: str


class ChatResponse(BaseModel):
    reply: str
    route: str
    label: str
    sources: list[SourceOut]
    escalated: bool


class MoodRequest(BaseModel):
    user_id: str
    score: int = Field(ge=1, le=10)
    note: str = ""


@lru_cache
def get_agent() -> CompanionAgent:
    settings = get_settings()
    require_provider_keys(settings)
    llm = make_llm(settings.llm_provider, settings.llm_model)
    classifier = make_classifier(settings.llm_provider, settings.llm_model)
    return CompanionAgent(build_graph(llm, KnowledgeBase.from_settings(settings),
                                      settings.data_dir, classifier))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, agent: Annotated[CompanionAgent, Depends(get_agent)]) -> ChatResponse:
    state = agent.respond(req.session_id, req.message, [t.model_dump() for t in req.history])
    # Log only routing metadata, never message content.
    logger.info("chat session=%s label=%s route=%s", req.session_id, state["label"], state["route"])
    unique = {s["url"]: s for s in state.get("sources", [])}.values()
    return ChatResponse(
        reply=state["reply"],
        route=state["route"].value,
        label=state["label"].value,
        sources=[SourceOut(title=s["title"], url=s["url"]) for s in unique],
        escalated=state.get("ticket_id") is not None,
    )


@app.post("/mood", response_model=MoodEntry)
def add_mood(req: MoodRequest) -> MoodEntry:
    return log_mood(get_settings().data_dir, req.user_id, req.score, req.note)


@app.get("/mood/{user_id}", response_model=list[MoodEntry])
def list_moods(user_id: str) -> list[MoodEntry]:
    return read_moods(get_settings().data_dir, user_id)
