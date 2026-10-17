"""FastAPI backend. Run: uv run uvicorn api.main:app --reload"""

import json
import logging
import threading
import time
from collections import deque
from collections.abc import AsyncIterator, Iterator
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field

from api.auth import User, admin_user, current_user, signed_in_user
from api.warmup import Warmup
from companion.config import get_settings, require_provider_keys
from companion.db.factory import get_store
from companion.db.models import ContactMessage, Conversation, Escalation, Message, MoodEntry
from companion.db.store import Store
from companion.graph import (
    CompanionAgent,
    CompanionState,
    build_graph,
    make_ack,
    make_classifier,
    make_llm,
)
from companion.guardrails.policy import RESPONSES, Route, route_for
from companion.guardrails.redaction import redact
from companion.guardrails.scope import classify_scope
from companion.rag import KnowledgeBase
from companion.streaming import StreamResult, stream_reply

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("companion.api")

SUMMARY_PATH = Path(__file__).resolve().parents[2] / "evals" / "results" / "summary.json"
HISTORY_TURNS = 12
TITLE_CHARS = 60


_kb_lock = threading.Lock()


@lru_cache
def _load_kb() -> KnowledgeBase:
    settings = get_settings()
    kb = KnowledgeBase.from_settings(settings)
    # Only new or edited chunks are embedded; a fresh container fills from the shipped snapshot.
    added = kb.ingest(settings.kb_dir)
    logger.info("knowledge base ready: %d chunks (%d newly indexed)", kb.size(), added)
    return kb


def get_kb() -> KnowledgeBase:
    with _kb_lock:  # the warm-up thread and the first chat may race
        return _load_kb()


def escalate_with(store: Store) -> Any:
    def escalate(state: CompanionState, reason: str, summary: str) -> str:
        return store.create_escalation(state.get("user_id"), state["session_id"], reason,
                                       summary).id
    return escalate


@lru_cache
def get_agent() -> CompanionAgent:
    settings = get_settings()
    require_provider_keys(settings)
    llm = make_llm(settings.llm_provider, settings.llm_model)
    classifier = make_classifier(settings.llm_provider, settings.llm_model)
    ack = make_ack(settings.llm_provider, settings.llm_model)
    return CompanionAgent(build_graph(llm, get_kb(), escalate_with(get_store()), classifier, ack))


def ping_provider() -> None:
    """Confirm the key works with a free metadata call (no tokens), so a bad key shows on /health."""
    settings = get_settings()
    if settings.llm_provider == "openai":
        from openai import OpenAI

        OpenAI(max_retries=2, timeout=10).models.retrieve(settings.llm_model)


def check_llm() -> None:
    get_agent()
    ping_provider()


# Late-bound lambdas so tests can swap the checks. A failing check never stops the app.
warmup = Warmup({"knowledge_base": lambda: get_kb(), "llm": lambda: check_llm()})


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    warmup.start()
    yield
    warmup.stop()


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(title="CompanionAI API", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins,
        allow_origin_regex=settings.cors_origin_regex or None,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )
    return application


app = create_app()
StoreDep = Annotated[Store, Depends(get_store)]


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None


class MoodRequest(BaseModel):
    score: int = Field(ge=1, le=10)
    note: str = Field("", max_length=1000)


class ContactRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    topic: Literal["general", "pro", "clinic", "privacy", "safety"] = "general"
    message: str = Field(min_length=10, max_length=4000)
    website: str = ""  # honeypot: real people leave it empty


class MeResponse(BaseModel):
    id: str
    email: str | None
    is_anonymous: bool
    is_admin: bool
    remaining_messages: int
    limit: int


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


def _public_sources(sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep retrieval order and duplicates: citation [n] refers to sources[n-1]."""
    return [{"title": s["title"], "url": s["url"], "snippet": s["snippet"][:280]} for s in sources]


@app.get("/health")
def health() -> dict[str, Any]:
    """Always 200 so the platform keeps the instance up; "degraded" means a check is failing."""
    return {"status": warmup.status, "checks": dict(warmup.checks)}


@app.get("/me", response_model=MeResponse)
def me(user: Annotated[User, Depends(current_user)], store: StoreDep) -> MeResponse:
    limits = get_settings().rate_limits
    return MeResponse(id=user.id, email=user.email, is_anonymous=user.is_anonymous,
                      is_admin=user.is_admin,
                      remaining_messages=store.remaining_quota(user.id, user.is_anonymous, limits),
                      limit=limits.demo_total if user.is_anonymous else limits.user_per_hour)


def _regex_safety_reply(user: User, store: StoreDep, message: str,
                        conversation_id: str | None) -> str | None:
    """Limits and outages never block crisis help: regex-only check, no LLM call."""
    label = classify_scope(redact(message))
    if route_for(label) != Route.ESCALATE:
        return None
    store.create_escalation(user.id, conversation_id, label.value, redact(message))
    return RESPONSES[label]


def _fixed_reply(text: str, remaining: int) -> StreamingResponse:
    def stream() -> Iterator[str]:
        yield _sse("meta", {"route": "escalate", "label": "crisis", "conversation_id": None})
        yield _sse("token", {"text": text})
        yield _sse("done", {"escalated": True, "remaining": remaining})
    return StreamingResponse(stream(), media_type="text/event-stream")


def _agent_or_none() -> CompanionAgent | None:
    try:
        return get_agent()
    except Exception as exc:  # noqa: BLE001 - any start-up failure means "not ready"
        logger.warning("agent unavailable (%s)", type(exc).__name__)
        return None


@app.post("/chat/stream")
def chat_stream(req: ChatRequest, user: Annotated[User, Depends(current_user)],
                store: StoreDep) -> StreamingResponse:
    convo: Conversation | None = None
    if req.conversation_id:
        convo = store.get_conversation(user.id, req.conversation_id)
        if convo is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")

    agent = _agent_or_none()
    if agent is None:  # still starting or a provider is down: no quota spent
        safety = _regex_safety_reply(user, store, req.message, req.conversation_id)
        if safety is None:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, {
                "reason": "unavailable",
                "message": "CompanionAI is waking up. Please try again in a minute."})
        remaining = store.remaining_quota(user.id, user.is_anonymous, get_settings().rate_limits)
        return _fixed_reply(safety, remaining)

    decision = store.consume_message_quota(user.id, user.is_anonymous, get_settings().rate_limits)
    if not decision.allowed:
        safety = _regex_safety_reply(user, store, req.message, req.conversation_id)
        if safety is None:
            logger.info("rate_limited user=%s reason=%s", user.id, decision.reason)
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                                {"reason": decision.reason, "message": _limit_text(decision.reason)})
        return _fixed_reply(safety, 0)

    history = []
    if convo is not None:
        history = [{"role": m.role, "content": m.content}
                   for m in store.list_messages(user.id, convo.id)[-HISTORY_TURNS:]]
    state = CompanionAgent.initial_state("", req.message, [], user.id)
    if convo is None:
        convo = store.create_conversation(user.id, state["message"][:TITLE_CHARS])
    state.update(session_id=convo.id, history=history)  # history is stored redacted already
    store.add_message(user.id, convo.id, "user", state["message"])

    def events() -> Iterator[str]:
        result = StreamResult()
        try:
            for ev in stream_reply(agent, state, result):
                if ev["event"] == "meta":
                    ev["data"]["conversation_id"] = convo.id
                if ev["event"] == "sources":
                    ev["data"]["sources"] = _public_sources(ev["data"]["sources"])
                yield _sse(ev["event"], ev["data"])
        except Exception:
            logger.exception("chat stream failed conversation=%s", convo.id)
            yield _sse("error", {"message": "Something went wrong. Please try again."})
            return
        final = result.state
        sources = _public_sources(final.get("sources", []))
        msg = store.add_message(user.id, convo.id, "assistant", final["reply"],
                                final["route"].value, final["label"].value, sources)
        logger.info("chat user=%s conversation=%s label=%s route=%s", user.id, convo.id,
                    final["label"].value, final["route"].value)
        yield _sse("done", {"message_id": msg.id, "escalated": final.get("ticket_id") is not None,
                            "remaining": decision.remaining})

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


def _limit_text(reason: str) -> str:
    return {
        "demo_total": "You've used all demo messages. Create a free account to keep chatting.",
        "demo_global": "The demo is busy right now. Create a free account to keep chatting.",
        "user_hourly": "You've reached the hourly message limit. Please try again a bit later.",
    }.get(reason, "Message limit reached.")


@app.get("/conversations", response_model=list[Conversation])
def list_conversations(user: Annotated[User, Depends(current_user)],
                       store: StoreDep) -> list[Conversation]:
    return store.list_conversations(user.id)


@app.get("/conversations/{conversation_id}/messages", response_model=list[Message])
def list_messages(conversation_id: str, user: Annotated[User, Depends(current_user)],
                  store: StoreDep) -> list[Message]:
    if store.get_conversation(user.id, conversation_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return store.list_messages(user.id, conversation_id)


@app.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(conversation_id: str, user: Annotated[User, Depends(current_user)],
                        store: StoreDep) -> None:
    if not store.delete_conversation(user.id, conversation_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")


@app.post("/mood", response_model=MoodEntry, status_code=status.HTTP_201_CREATED)
def add_mood(req: MoodRequest, user: Annotated[User, Depends(signed_in_user)],
             store: StoreDep) -> MoodEntry:
    return store.add_mood(user.id, req.score, redact(req.note))


@app.get("/mood", response_model=list[MoodEntry])
def list_moods(user: Annotated[User, Depends(signed_in_user)], store: StoreDep,
               days: Annotated[int, Query(ge=1, le=365)] = 90) -> list[MoodEntry]:
    return store.list_moods(user.id, days)


@app.get("/admin/escalations", response_model=list[Escalation])
def admin_escalations(_: Annotated[User, Depends(admin_user)], store: StoreDep,
                      status_filter: Annotated[str | None, Query(alias="status",
                                                                 pattern="^(open|resolved)$")]
                      = None) -> list[Escalation]:
    return store.list_escalations(status_filter)


@app.post("/admin/escalations/{escalation_id}/resolve", response_model=Escalation)
def admin_resolve(escalation_id: str, admin: Annotated[User, Depends(admin_user)],
                  store: StoreDep) -> Escalation:
    esc = store.resolve_escalation(escalation_id, admin.email or admin.id)
    if esc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ticket not found")
    return esc


@app.get("/safety/summary")
def safety_summary() -> dict[str, Any]:
    return json.loads(SUMMARY_PATH.read_text()) if SUMMARY_PATH.exists() else {}


class IpRateLimiter:
    """Small in-process sliding-window limiter (single API instance) for anonymous endpoints."""

    def __init__(self, limit: int, window_s: float) -> None:
        self.limit, self.window = limit, window_s
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            hits = self._hits.setdefault(key, deque())
            while hits and now - hits[0] > self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                return False
            hits.append(now)
            return True


contact_limiter = IpRateLimiter(limit=5, window_s=3600)


@app.post("/contact", status_code=status.HTTP_202_ACCEPTED)
def contact(req: ContactRequest, request: Request, store: StoreDep) -> dict[str, bool]:
    if not contact_limiter.allow(request.client.host if request.client else "unknown"):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Too many messages from your network. Please try again later.")
    if req.website:  # bot; pretend success
        return {"ok": True}
    store.add_contact_message(req.name.strip(), str(req.email), req.topic, req.message.strip())
    logger.info("contact message received topic=%s", req.topic)
    return {"ok": True}


@app.get("/admin/contact", response_model=list[ContactMessage])
def admin_contact(_: Annotated[User, Depends(admin_user)],
                  store: StoreDep) -> list[ContactMessage]:
    return store.list_contact_messages()
