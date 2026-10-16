"""Mood logging. Notes are redacted before they are stored."""

from datetime import UTC, datetime
from pathlib import Path

from pydantic import BaseModel, Field

from companion.guardrails.redaction import redact
from companion.tools._store import append_jsonl, read_jsonl


class MoodEntry(BaseModel):
    user_id: str
    score: int = Field(ge=1, le=10, description="1 = very low, 10 = great")
    note: str = ""
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


def _path(data_dir: Path) -> Path:
    return data_dir / "moods.jsonl"


def log_mood(data_dir: Path, user_id: str, score: int, note: str = "") -> MoodEntry:
    entry = MoodEntry(user_id=user_id, score=score, note=redact(note))
    append_jsonl(_path(data_dir), entry.model_dump())
    return entry


def read_moods(data_dir: Path, user_id: str, limit: int = 30) -> list[MoodEntry]:
    rows = [MoodEntry(**r) for r in read_jsonl(_path(data_dir)) if r["user_id"] == user_id]
    return rows[-limit:]
