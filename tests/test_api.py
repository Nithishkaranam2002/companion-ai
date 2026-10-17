import json
import time
from collections.abc import Iterator

import jwt
import pytest
from fastapi.testclient import TestClient

from api.main import app, get_agent
from companion.config import get_settings
from companion.db.factory import get_store
from companion.db.store import InMemoryStore
from companion.rag import KnowledgeBase
from tests.conftest import make_agent

SECRET = "test-secret-at-least-32-characters-long!!"


def auth(sub: str = "user-1", email: str = "me@example.com", anonymous: bool = False) -> dict:
    tok = jwt.encode({"sub": sub, "aud": "authenticated", "exp": int(time.time()) + 600,
                      "email": email, "is_anonymous": anonymous}, SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture
def store() -> InMemoryStore:
    return InMemoryStore()


@pytest.fixture
def client(kb: KnowledgeBase, store: InMemoryStore,
           monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    monkeypatch.setenv("ADMIN_EMAILS", "boss@example.com")
    monkeypatch.setenv("RATE_LIMIT_USER_PER_HOUR", "3")
    monkeypatch.setenv("RATE_LIMIT_DEMO_TOTAL", "2")
    get_settings.cache_clear()
    agent = make_agent(kb, store, ["Try a short walk. It can help [1]."])
    app.dependency_overrides[get_store] = lambda: store
    get_agent.cache_clear()
    monkeypatch.setattr("api.main.get_agent", lambda: agent)
    yield TestClient(app)
    app.dependency_overrides.clear()
    get_settings.cache_clear()


def sse(resp) -> list[tuple[str, dict]]:
    events = []
    for block in resp.text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        events.append((lines["event"], json.loads(lines["data"])))
    return events


def chat(client: TestClient, message: str, headers: dict, conversation_id: str | None = None):
    return client.post("/chat/stream", json={"message": message, "conversation_id": conversation_id},
                       headers=headers)


def test_health(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok"}


def test_requires_auth(client: TestClient) -> None:
    assert client.post("/chat/stream", json={"message": "hi"}).status_code == 401
    assert client.get("/conversations", headers={"Authorization": "Bearer junk"}).status_code == 401


def test_stream_chat_persists_redacted(client: TestClient, store: InMemoryStore) -> None:
    resp = chat(client, "I'm Jane Doe and I feel low, mail jane@example.com", auth())
    events = sse(resp)
    assert resp.headers["content-type"].startswith("text/event-stream")
    meta = events[0][1]
    assert meta["route"] == "answer" and meta["conversation_id"]
    assert events[-1][0] == "done"
    text = "".join(d["text"] for e, d in events if e == "token")
    assert text == "Try a short walk. It can help [1]."
    stored = store.list_messages("user-1", meta["conversation_id"])
    assert "jane@example.com" not in stored[0].content and "Jane Doe" not in stored[0].content
    assert stored[1].sources and stored[1].route == "answer"


def test_conversations_are_private(client: TestClient) -> None:
    cid = sse(chat(client, "hello there", auth()))[0][1]["conversation_id"]
    assert len(client.get("/conversations", headers=auth()).json()) == 1
    other = auth(sub="user-2")
    assert client.get(f"/conversations/{cid}/messages", headers=other).status_code == 404
    assert chat(client, "hi", other, cid).status_code == 404
    assert client.delete(f"/conversations/{cid}", headers=auth()).status_code == 204


def test_continues_conversation_with_history(client: TestClient, store: InMemoryStore) -> None:
    cid = sse(chat(client, "first", auth()))[0][1]["conversation_id"]
    sse(chat(client, "second", auth(), cid))
    assert len(store.list_messages("user-1", cid)) == 4


def test_hourly_rate_limit(client: TestClient) -> None:
    for _ in range(3):
        assert chat(client, "hello", auth()).status_code == 200
    resp = chat(client, "hello", auth())
    assert resp.status_code == 429 and resp.json()["detail"]["reason"] == "user_hourly"


def test_rate_limit_never_blocks_crisis_help(client: TestClient, store: InMemoryStore) -> None:
    for _ in range(3):
        chat(client, "hello", auth())
    events = sse(chat(client, "I want to kill myself", auth()))
    assert "988" in "".join(d.get("text", "") for _, d in events)
    assert any(e.reason == "crisis" for e in store.list_escalations())


def test_demo_limit_and_restrictions(client: TestClient) -> None:
    demo = auth(sub="anon-1", email="", anonymous=True)
    assert client.get("/me", headers=demo).json()["remaining_messages"] == 2
    for _ in range(2):
        assert chat(client, "hello", demo).status_code == 200
    assert chat(client, "hello", demo).json()["detail"]["reason"] == "demo_total"
    assert client.post("/mood", json={"score": 5}, headers=demo).status_code == 403


def test_crisis_stream_escalates(client: TestClient, store: InMemoryStore) -> None:
    events = sse(chat(client, "I want to end my life", auth()))
    assert events[0][1]["route"] == "escalate" and events[-1][1]["escalated"]
    assert store.list_escalations("open")[0].user_id == "user-1"


def test_mood_roundtrip_redacts(client: TestClient) -> None:
    resp = client.post("/mood", json={"score": 7, "note": "call 555-123-4567"}, headers=auth())
    assert resp.status_code == 201 and "555-123-4567" not in resp.json()["note"]
    assert client.get("/mood", headers=auth()).json()[0]["score"] == 7
    assert client.post("/mood", json={"score": 11}, headers=auth()).status_code == 422


def test_admin_queue(client: TestClient, store: InMemoryStore) -> None:
    esc = store.create_escalation("user-1", None, "crisis", "s")
    assert client.get("/admin/escalations", headers=auth()).status_code == 403
    boss = auth(sub="admin", email="Boss@Example.com")
    assert client.get("/admin/escalations?status=open", headers=boss).json()[0]["id"] == esc.id
    done = client.post(f"/admin/escalations/{esc.id}/resolve", headers=boss).json()
    assert done["status"] == "resolved" and done["resolved_by"] == "boss@example.com"


def test_anonymous_cannot_be_admin(client: TestClient) -> None:
    fake = auth(sub="anon", email="boss@example.com", anonymous=True)
    assert client.get("/admin/escalations", headers=fake).status_code == 403


def test_cors_allows_configured_origin(client: TestClient) -> None:
    resp = client.options("/chat/stream", headers={
        "Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"})
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"
    bad = client.options("/chat/stream", headers={
        "Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in bad.headers


def test_safety_summary(client: TestClient) -> None:
    assert client.get("/safety/summary").json()["routing"]["total"] == 40


@pytest.fixture(autouse=True)
def fresh_contact_limiter(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.main import IpRateLimiter

    monkeypatch.setattr("api.main.contact_limiter", IpRateLimiter(limit=5, window_s=3600))


def test_contact_rate_limited_per_ip(client: TestClient) -> None:
    body = {"name": "Ada", "email": "ada@example.com", "message": "Hello there, team!"}
    codes = [client.post("/contact", json=body).status_code for _ in range(6)]
    assert codes == [202] * 5 + [429]


def test_contact_form(client: TestClient, store: InMemoryStore) -> None:
    body = {"name": "Ada", "email": "ada@example.com", "topic": "pro",
            "message": "Please add me to the waitlist."}
    assert client.post("/contact", json=body).status_code == 202
    assert store.contacts[0].topic == "pro"
    assert client.post("/contact", json={**body, "email": "nope"}).status_code == 422
    assert client.post("/contact", json={**body, "website": "spam.biz"}).status_code == 202
    assert len(store.contacts) == 1  # honeypot submission dropped
    boss = auth(sub="admin", email="boss@example.com")
    assert client.get("/admin/contact", headers=auth()).status_code == 403
    assert client.get("/admin/contact", headers=boss).json()[0]["email"] == "ada@example.com"


def test_sources_keep_citation_order(client: TestClient) -> None:
    events = sse(chat(client, "How can I sleep better?", auth()))
    sources = next(d for e, d in events if e == "sources")["sources"]
    assert len(sources) == 2  # k=2 in the test KB, duplicates kept so [n] maps to sources[n-1]
    assert all(set(s) == {"title", "url", "snippet"} for s in sources)
