"""Postgres (Supabase) implementation of the Store."""

import json
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from companion.db.models import (
    Conversation,
    Escalation,
    Message,
    MoodEntry,
    RateDecision,
    RateLimits,
)
from companion.db.store import URGENT_REASONS

# libpq rejects unknown URI params (e.g. Vercel's `supa=base-pooler.x`).
_LIBPQ_PARAMS = {"sslmode", "sslrootcert", "connect_timeout", "application_name", "options"}


def clean_dsn(url: str) -> str:
    parts = urlsplit(url.replace("postgres://", "postgresql://", 1))
    query = [(k, v) for k, v in parse_qsl(parts.query) if k in _LIBPQ_PARAMS]
    if not any(k == "sslmode" for k, _ in query):
        query.append(("sslmode", "require"))
    return urlunsplit(parts._replace(query=urlencode(query)))


class PostgresStore:
    def __init__(self, url: str, min_size: int = 1, max_size: int = 5) -> None:
        # prepare_threshold=None: Supabase's transaction pooler doesn't support prepared statements.
        self.pool = ConnectionPool(clean_dsn(url), min_size=min_size, max_size=max_size,
                                   kwargs={"row_factory": dict_row, "prepare_threshold": None},
                                   open=True)

    def _one(self, sql: str, params: tuple[Any, ...]) -> dict[str, Any] | None:
        with self.pool.connection() as conn:
            return conn.execute(sql, params).fetchone()

    def _all(self, sql: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
        with self.pool.connection() as conn:
            return conn.execute(sql, params).fetchall()

    @staticmethod
    def _ids(row: dict[str, Any]) -> dict[str, Any]:
        return {k: (str(v) if k.endswith("id") and v is not None else v) for k, v in row.items()}

    def create_conversation(self, user_id: str, title: str) -> Conversation:
        row = self._one("insert into conversations (user_id, title) values (%s, %s) returning *",
                        (user_id, title))
        return Conversation(**self._ids(row))

    def get_conversation(self, user_id: str, conversation_id: str) -> Conversation | None:
        row = self._one("select * from conversations where id = %s and user_id = %s",
                        (conversation_id, user_id))
        return Conversation(**self._ids(row)) if row else None

    def list_conversations(self, user_id: str, limit: int = 50) -> list[Conversation]:
        rows = self._all("select * from conversations where user_id = %s "
                         "order by updated_at desc limit %s", (user_id, limit))
        return [Conversation(**self._ids(r)) for r in rows]

    def delete_conversation(self, user_id: str, conversation_id: str) -> bool:
        row = self._one("delete from conversations where id = %s and user_id = %s returning id",
                        (conversation_id, user_id))
        return row is not None

    def add_message(self, user_id: str, conversation_id: str, role: str, content: str,
                    route: str | None = None, label: str | None = None,
                    sources: list[dict[str, Any]] | None = None) -> Message:
        with self.pool.connection() as conn:
            row = conn.execute(
                "insert into messages (conversation_id, user_id, role, content, route, label, "
                "sources) values (%s, %s, %s, %s, %s, %s, %s::jsonb) returning *",
                (conversation_id, user_id, role, content, route, label,
                 json.dumps(sources or []))).fetchone()
            conn.execute("update conversations set updated_at = now() where id = %s",
                         (conversation_id,))
        return Message(**self._ids(row))

    def list_messages(self, user_id: str, conversation_id: str,
                      limit: int = 200) -> list[Message]:
        rows = self._all("select * from (select * from messages where conversation_id = %s "
                         "and user_id = %s order by created_at desc limit %s) m "
                         "order by created_at", (conversation_id, user_id, limit))
        return [Message(**self._ids(r)) for r in rows]

    def add_mood(self, user_id: str, score: int, note: str) -> MoodEntry:
        row = self._one("insert into mood_entries (user_id, score, note) values (%s, %s, %s) "
                        "returning *", (user_id, score, note))
        return MoodEntry(**self._ids(row))

    def list_moods(self, user_id: str, days: int = 90) -> list[MoodEntry]:
        rows = self._all("select * from mood_entries where user_id = %s and "
                         "created_at >= now() - make_interval(days => %s) order by created_at",
                         (user_id, days))
        return [MoodEntry(**self._ids(r)) for r in rows]

    def create_escalation(self, user_id: str | None, conversation_id: str | None,
                          reason: str, summary: str) -> Escalation:
        row = self._one("insert into escalations (user_id, conversation_id, reason, summary, "
                        "urgent) values (%s, %s, %s, %s, %s) returning *",
                        (user_id, conversation_id, reason, summary, reason in URGENT_REASONS))
        return Escalation(**self._ids(row))

    def list_escalations(self, status: str | None = None) -> list[Escalation]:
        rows = self._all("select * from escalations where (%s::text is null or status = %s) "
                         "order by urgent desc, created_at desc limit 200", (status, status))
        return [Escalation(**self._ids(r)) for r in rows]

    def resolve_escalation(self, escalation_id: str, resolved_by: str) -> Escalation | None:
        row = self._one("update escalations set status = 'resolved', resolved_by = %s, "
                        "resolved_at = now() where id = %s returning *",
                        (resolved_by, escalation_id))
        return Escalation(**self._ids(row)) if row else None

    def _check(self, conn: Any, user_id: str, is_demo: bool, limits: RateLimits) -> RateDecision:
        if is_demo:
            day = conn.execute("select count(*) as n from usage_events where is_demo and "
                               "created_at >= now() - interval '1 day'").fetchone()["n"]
            if day >= limits.demo_global_per_day:
                return RateDecision(False, 0, "demo_global")
            used = conn.execute("select count(*) as n from usage_events where user_id = %s",
                                (user_id,)).fetchone()["n"]
            remaining = limits.demo_total - used
            return RateDecision(remaining > 0, max(remaining, 0),
                                "" if remaining > 0 else "demo_total")
        used = conn.execute("select count(*) as n from usage_events where user_id = %s and "
                            "created_at >= now() - interval '1 hour'", (user_id,)).fetchone()["n"]
        remaining = limits.user_per_hour - used
        return RateDecision(remaining > 0, max(remaining, 0),
                            "" if remaining > 0 else "user_hourly")

    def consume_message_quota(self, user_id: str, is_demo: bool,
                              limits: RateLimits) -> RateDecision:
        with self.pool.connection() as conn, conn.transaction():
            # Serialize concurrent requests per user so two can't both take the last slot.
            conn.execute("select pg_advisory_xact_lock(hashtext(%s))", (user_id,))
            if is_demo:
                conn.execute("select pg_advisory_xact_lock(hashtext('demo-global'))")
            decision = self._check(conn, user_id, is_demo, limits)
            if not decision.allowed:
                return decision
            conn.execute("insert into usage_events (user_id, is_demo) values (%s, %s)",
                         (user_id, is_demo))
            return RateDecision(True, decision.remaining - 1)

    def remaining_quota(self, user_id: str, is_demo: bool, limits: RateLimits) -> int:
        with self.pool.connection() as conn:
            return self._check(conn, user_id, is_demo, limits).remaining
