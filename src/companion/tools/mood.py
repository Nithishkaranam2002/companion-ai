"""Mood logging. Notes are redacted before they are stored."""

from companion.db.models import MoodEntry
from companion.db.store import Store
from companion.guardrails.redaction import redact


def log_mood(store: Store, user_id: str, score: int, note: str = "") -> MoodEntry:
    if not 1 <= score <= 10:
        raise ValueError("score must be between 1 and 10")
    return store.add_mood(user_id, score, redact(note))
