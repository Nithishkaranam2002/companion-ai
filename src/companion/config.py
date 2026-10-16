"""Typed application settings loaded from environment / .env."""

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    llm_provider: Literal["openai", "anthropic"] = "openai"
    llm_model: str = "gpt-5.5"
    embeddings_provider: Literal["openai", "voyage", "hash"] = "openai"
    embeddings_model: str = "text-embedding-3-small"
    chroma_dir: Path = Path(".chroma")
    kb_dir: Path = Path("data/kb")
    data_dir: Path = Path("var")
    retrieval_k: int = 4


@lru_cache
def get_settings() -> Settings:
    # Provider SDKs (OpenAI, Anthropic, LangSmith) read keys from os.environ, not Settings.
    load_dotenv(".env", override=False)
    return Settings()


PROVIDER_KEYS = {"openai": "OPENAI_API_KEY", "anthropic": "ANTHROPIC_API_KEY",
                 "voyage": "VOYAGE_API_KEY"}


def require_provider_keys(settings: Settings) -> None:
    """Fail fast with a clear message if a selected provider's API key is missing."""
    providers = {settings.llm_provider, settings.embeddings_provider} - {"hash"}
    missing = sorted(PROVIDER_KEYS[p] for p in providers if not os.environ.get(PROVIDER_KEYS[p]))
    if missing:
        raise RuntimeError(f"Missing API key(s) in environment/.env: {', '.join(missing)}")
