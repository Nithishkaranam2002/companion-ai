"""Typed application settings loaded from environment / .env."""

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from companion.db.models import RateLimits


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

    # Supabase (names match what the Vercel Supabase integration provides)
    database_url: str = Field("", validation_alias=AliasChoices("DATABASE_URL", "POSTGRES_URL"))
    database_url_direct: str = Field("", validation_alias=AliasChoices(
        "DATABASE_URL_DIRECT", "POSTGRES_URL_NON_POOLING"))
    supabase_url: str = Field("", validation_alias=AliasChoices(
        "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"))
    supabase_jwt_secret: str = ""

    # Web
    admin_emails: str = ""  # comma-separated
    allowed_origins: str = "http://localhost:3000"  # comma-separated
    cors_origin_regex: str = ""  # e.g. Vercel preview URLs

    # Rate limits
    rate_limit_user_per_hour: int = 20
    rate_limit_demo_total: int = 10
    rate_limit_demo_global_per_day: int = 500

    @property
    def admin_email_set(self) -> frozenset[str]:
        return frozenset(e.strip().lower() for e in self.admin_emails.split(",") if e.strip())

    @property
    def origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def rate_limits(self) -> RateLimits:
        return RateLimits(self.rate_limit_user_per_hour, self.rate_limit_demo_total,
                          self.rate_limit_demo_global_per_day)


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
