"""Typed records persisted by the Store. Text fields are always redacted before storage."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class Conversation(BaseModel):
    id: str
    user_id: str
    title: str
    created_at: datetime
    updated_at: datetime


class Message(BaseModel):
    id: str
    conversation_id: str
    role: Literal["user", "assistant"]
    content: str
    route: str | None = None
    label: str | None = None
    sources: list[dict[str, Any]] = Field(default_factory=list)
    created_at: datetime


class MoodEntry(BaseModel):
    id: str
    user_id: str
    score: int = Field(ge=1, le=10)
    note: str = ""
    created_at: datetime


class Escalation(BaseModel):
    id: str
    user_id: str | None
    conversation_id: str | None
    reason: str
    summary: str
    urgent: bool
    status: Literal["open", "resolved"] = "open"
    resolved_by: str | None = None
    resolved_at: datetime | None = None
    created_at: datetime


@dataclass(frozen=True)
class RateLimits:
    user_per_hour: int = 20
    demo_total: int = 10
    demo_global_per_day: int = 500


@dataclass(frozen=True)
class RateDecision:
    allowed: bool
    remaining: int
    reason: str = ""  # "user_hourly" | "demo_total" | "demo_global" when blocked
