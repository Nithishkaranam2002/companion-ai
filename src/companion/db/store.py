"""Store interface plus an in-memory implementation (tests and local dev without a DB)."""

import threading
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

from companion.db.models import (
    ContactMessage,
    Conversation,
    Escalation,
    Message,
    MoodEntry,
    RateDecision,
    RateLimits,
)

URGENT_REASONS = frozenset({"crisis", "medical_emergency"})


class Store(Protocol):
    def create_conversation(self, user_id: str, title: str) -> Conversation: ...
    def get_conversation(self, user_id: str, conversation_id: str) -> Conversation | None: ...
    def list_conversations(self, user_id: str, limit: int = 50) -> list[Conversation]: ...
    def delete_conversation(self, user_id: str, conversation_id: str) -> bool: ...
    def add_message(self, user_id: str, conversation_id: str, role: str, content: str,
                    route: str | None = None, label: str | None = None,
                    sources: list[dict[str, Any]] | None = None) -> Message: ...
    def list_messages(self, user_id: str, conversation_id: str,
                      limit: int = 200) -> list[Message]: ...
    def add_mood(self, user_id: str, score: int, note: str) -> MoodEntry: ...
    def list_moods(self, user_id: str, days: int = 90) -> list[MoodEntry]: ...
    def create_escalation(self, user_id: str | None, conversation_id: str | None,
                          reason: str, summary: str) -> Escalation: ...
    def list_escalations(self, status: str | None = None) -> list[Escalation]: ...
    def resolve_escalation(self, escalation_id: str, resolved_by: str) -> Escalation | None: ...
    def consume_message_quota(self, user_id: str, is_demo: bool,
                              limits: RateLimits) -> RateDecision: ...
    def remaining_quota(self, user_id: str, is_demo: bool, limits: RateLimits) -> int: ...
    def add_contact_message(self, name: str, email: str, topic: str,
                            message: str) -> ContactMessage: ...
    def list_contact_messages(self, limit: int = 100) -> list[ContactMessage]: ...


def _now() -> datetime:
    return datetime.now(UTC)


def _id() -> str:
    return str(uuid.uuid4())


class InMemoryStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.conversations: dict[str, Conversation] = {}
        self.messages: list[Message] = []
        self.moods: list[MoodEntry] = []
        self.escalations: dict[str, Escalation] = {}
        self.usage: list[tuple[str, bool, datetime]] = []
        self.contacts: list[ContactMessage] = []

    def create_conversation(self, user_id: str, title: str) -> Conversation:
        now = _now()
        convo = Conversation(id=_id(), user_id=user_id, title=title, created_at=now,
                             updated_at=now)
        self.conversations[convo.id] = convo
        return convo

    def get_conversation(self, user_id: str, conversation_id: str) -> Conversation | None:
        convo = self.conversations.get(conversation_id)
        return convo if convo and convo.user_id == user_id else None

    def list_conversations(self, user_id: str, limit: int = 50) -> list[Conversation]:
        mine = [c for c in self.conversations.values() if c.user_id == user_id]
        return sorted(mine, key=lambda c: c.updated_at, reverse=True)[:limit]

    def delete_conversation(self, user_id: str, conversation_id: str) -> bool:
        if not self.get_conversation(user_id, conversation_id):
            return False
        del self.conversations[conversation_id]
        self.messages = [m for m in self.messages if m.conversation_id != conversation_id]
        return True

    def add_message(self, user_id: str, conversation_id: str, role: str, content: str,
                    route: str | None = None, label: str | None = None,
                    sources: list[dict[str, Any]] | None = None) -> Message:
        msg = Message(id=_id(), conversation_id=conversation_id, role=role, content=content,
                      route=route, label=label, sources=sources or [], created_at=_now())
        self.messages.append(msg)
        convo = self.conversations[conversation_id]
        self.conversations[conversation_id] = convo.model_copy(update={"updated_at": _now()})
        return msg

    def list_messages(self, user_id: str, conversation_id: str,
                      limit: int = 200) -> list[Message]:
        if not self.get_conversation(user_id, conversation_id):
            return []
        return [m for m in self.messages if m.conversation_id == conversation_id][-limit:]

    def add_mood(self, user_id: str, score: int, note: str) -> MoodEntry:
        entry = MoodEntry(id=_id(), user_id=user_id, score=score, note=note, created_at=_now())
        self.moods.append(entry)
        return entry

    def list_moods(self, user_id: str, days: int = 90) -> list[MoodEntry]:
        since = _now() - timedelta(days=days)
        return [m for m in self.moods if m.user_id == user_id and m.created_at >= since]

    def create_escalation(self, user_id: str | None, conversation_id: str | None,
                          reason: str, summary: str) -> Escalation:
        esc = Escalation(id=_id(), user_id=user_id, conversation_id=conversation_id,
                         reason=reason, summary=summary, urgent=reason in URGENT_REASONS,
                         created_at=_now())
        self.escalations[esc.id] = esc
        return esc

    def list_escalations(self, status: str | None = None) -> list[Escalation]:
        rows = [e for e in self.escalations.values() if status is None or e.status == status]
        return sorted(rows, key=lambda e: (not e.urgent, -e.created_at.timestamp()))

    def resolve_escalation(self, escalation_id: str, resolved_by: str) -> Escalation | None:
        esc = self.escalations.get(escalation_id)
        if esc is None:
            return None
        esc = esc.model_copy(update={"status": "resolved", "resolved_by": resolved_by,
                                     "resolved_at": _now()})
        self.escalations[escalation_id] = esc
        return esc

    def _used(self, user_id: str, since: datetime | None) -> int:
        return sum(1 for u, _, t in self.usage if u == user_id and (since is None or t >= since))

    def _check(self, user_id: str, is_demo: bool, limits: RateLimits) -> RateDecision:
        now = _now()
        if is_demo:
            demo_today = sum(1 for _, d, t in self.usage if d and t >= now - timedelta(days=1))
            if demo_today >= limits.demo_global_per_day:
                return RateDecision(False, 0, "demo_global")
            remaining = limits.demo_total - self._used(user_id, None)
            return RateDecision(remaining > 0, max(remaining, 0), "" if remaining > 0 else "demo_total")
        remaining = limits.user_per_hour - self._used(user_id, now - timedelta(hours=1))
        return RateDecision(remaining > 0, max(remaining, 0), "" if remaining > 0 else "user_hourly")

    def consume_message_quota(self, user_id: str, is_demo: bool,
                              limits: RateLimits) -> RateDecision:
        with self._lock:
            decision = self._check(user_id, is_demo, limits)
            if not decision.allowed:
                return decision
            self.usage.append((user_id, is_demo, _now()))
            return RateDecision(True, decision.remaining - 1)

    def remaining_quota(self, user_id: str, is_demo: bool, limits: RateLimits) -> int:
        return self._check(user_id, is_demo, limits).remaining

    def add_contact_message(self, name: str, email: str, topic: str,
                            message: str) -> ContactMessage:
        msg = ContactMessage(id=_id(), name=name, email=email, topic=topic, message=message,
                             created_at=_now())
        self.contacts.append(msg)
        return msg

    def list_contact_messages(self, limit: int = 100) -> list[ContactMessage]:
        return sorted(self.contacts, key=lambda c: c.created_at, reverse=True)[:limit]
