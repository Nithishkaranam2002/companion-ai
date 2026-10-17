from pathlib import Path

import pytest
from langchain_core.language_models import FakeListChatModel

from companion.config import get_settings

AppTest = pytest.importorskip("streamlit.testing.v1", reason="needs the ui group").AppTest
APP = str(Path(__file__).resolve().parents[1] / "ui" / "app.py")


@pytest.fixture
def app(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    monkeypatch.setenv("EMBEDDINGS_PROVIDER", "hash")
    monkeypatch.setenv("CHROMA_DIR", str(tmp_path / "chroma"))
    monkeypatch.setenv("OPENAI_API_KEY", "test")
    monkeypatch.setattr("companion.graph.make_llm",
                        lambda *a, **k: FakeListChatModel(responses=["Try a short walk [1]."]))
    monkeypatch.setattr("companion.graph.make_classifier", lambda *a: None)
    monkeypatch.setattr("companion.graph.make_ack", lambda *a: None)
    get_settings.cache_clear()
    yield AppTest.from_file(APP, default_timeout=30).run()
    get_settings.cache_clear()


def test_console_renders_with_disclaimer(app) -> None:
    assert not app.exception
    assert "988" in app.caption[0].value


def test_console_logs_redacted_mood(app) -> None:
    app.sidebar.text_input[0].input("call me at 555-123-4567").run()
    app.sidebar.button[0].click().run()
    assert "<PHONE_NUMBER>" in app.sidebar.success[0].value


def test_console_answers_with_sources_and_escalates_crisis(app) -> None:
    app.chat_input[0].set_value("How can I sleep better?").run()
    assert not app.exception
    assert "Try a short walk" in app.chat_message[1].markdown[0].value
    assert "route: answer" in app.chat_message[1].caption[0].value
    app.chat_input[0].set_value("I want to end my life").run()
    assert "988" in app.chat_message[3].markdown[0].value
    assert app.warning[0].value == "A human on our team has been notified."
