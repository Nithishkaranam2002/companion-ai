import os
from pathlib import Path

import pytest

from companion.config import get_settings


def test_env_file_keys_reach_process_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / ".env").write_text("COMPANION_TEST_KEY=from-dotenv\n")
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("COMPANION_TEST_KEY", raising=False)
    get_settings.cache_clear()
    try:
        get_settings()
        assert os.environ["COMPANION_TEST_KEY"] == "from-dotenv"
    finally:
        get_settings.cache_clear()
        os.environ.pop("COMPANION_TEST_KEY", None)


def test_defaults_are_openai(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    from companion.config import Settings

    monkeypatch.chdir(tmp_path)  # no .env here
    for var in ("LLM_PROVIDER", "LLM_MODEL", "EMBEDDINGS_PROVIDER"):
        monkeypatch.delenv(var, raising=False)
    s = Settings()
    assert (s.llm_provider, s.embeddings_provider) == ("openai", "openai")


def test_missing_key_fails_fast(monkeypatch: pytest.MonkeyPatch) -> None:
    from companion.config import Settings, require_provider_keys

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="OPENAI_API_KEY"):
        require_provider_keys(Settings(llm_provider="openai", embeddings_provider="openai"))


def test_anthropic_key_not_required_for_openai(monkeypatch: pytest.MonkeyPatch) -> None:
    from companion.config import Settings, require_provider_keys

    monkeypatch.setenv("OPENAI_API_KEY", "test")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    require_provider_keys(Settings(llm_provider="openai", embeddings_provider="openai"))
