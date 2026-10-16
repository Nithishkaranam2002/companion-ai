from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import app, get_agent
from companion.config import get_settings
from companion.rag import KnowledgeBase
from tests.conftest import make_agent


@pytest.fixture
def client(kb: KnowledgeBase, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    get_settings.cache_clear()
    app.dependency_overrides[get_agent] = lambda: make_agent(kb, tmp_path, ["Try a walk [1]."])
    yield TestClient(app)
    app.dependency_overrides.clear()
    get_settings.cache_clear()


def test_health(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok"}


def test_chat_answer(client: TestClient) -> None:
    body = client.post("/chat", json={"session_id": "s", "message": "I feel low today"}).json()
    assert body["route"] == "answer" and body["sources"] and not body["escalated"]


def test_chat_escalation(client: TestClient) -> None:
    body = client.post("/chat", json={"session_id": "s", "message": "I want a real person"}).json()
    assert body["route"] == "escalate" and body["escalated"]


def test_chat_rejects_empty_message(client: TestClient) -> None:
    assert client.post("/chat", json={"session_id": "s", "message": ""}).status_code == 422


def test_mood_roundtrip(client: TestClient) -> None:
    assert client.post("/mood", json={"user_id": "u", "score": 7}).status_code == 200
    assert client.get("/mood/u").json()[0]["score"] == 7
