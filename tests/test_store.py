"""Store contract: runs against InMemoryStore always, and PostgresStore when
TEST_DATABASE_URL points at a disposable Supabase/Postgres database."""

import os
import uuid
from collections.abc import Iterator

import pytest

from companion.db.models import RateLimits
from companion.db.store import InMemoryStore, Store

PG_URL = os.environ.get("TEST_DATABASE_URL", "")
LIMITS = RateLimits(user_per_hour=3, demo_total=2, demo_global_per_day=100)


def _pg_user(store: Store) -> str:
    """auth.users FK: create a throwaway auth user row for Postgres runs."""
    uid = str(uuid.uuid4())
    with store.pool.connection() as conn:  # type: ignore[attr-defined]
        conn.execute("insert into auth.users (id, aud, role, email) values "
                     "(%s, 'authenticated', 'authenticated', %s)", (uid, f"{uid}@test.local"))
    return uid


@pytest.fixture(params=["memory", "postgres"])
def store_and_user(request: pytest.FixtureRequest) -> Iterator[tuple[Store, str]]:
    if request.param == "memory":
        yield InMemoryStore(), str(uuid.uuid4())
        return
    if not PG_URL:
        pytest.skip("TEST_DATABASE_URL not set")
    from companion.db.postgres import PostgresStore

    store = PostgresStore(PG_URL)
    uid = _pg_user(store)
    yield store, uid
    with store.pool.connection() as conn:
        conn.execute("delete from usage_events where user_id = %s", (uid,))
        conn.execute("delete from escalations where user_id = %s", (uid,))
        conn.execute("delete from auth.users where id = %s", (uid,))
    store.pool.close()


def test_conversation_lifecycle(store_and_user: tuple[Store, str]) -> None:
    store, uid = store_and_user
    convo = store.create_conversation(uid, "Sleep")
    store.add_message(uid, convo.id, "user", "hi")
    store.add_message(uid, convo.id, "assistant", "hello [1]", "answer", "in_scope",
                      [{"title": "T", "url": "https://x"}])
    msgs = store.list_messages(uid, convo.id)
    assert [m.role for m in msgs] == ["user", "assistant"]
    assert msgs[1].sources[0]["url"] == "https://x"
    assert store.list_conversations(uid)[0].id == convo.id
    renamed = store.rename_conversation(uid, convo.id, "Evening plan")
    assert renamed is not None and renamed.title == "Evening plan"
    assert store.get_conversation(uid, convo.id).title == "Evening plan"
    assert store.delete_conversation(uid, convo.id)
    assert store.get_conversation(uid, convo.id) is None


def test_users_cannot_read_each_others_conversations(store_and_user: tuple[Store, str]) -> None:
    store, uid = store_and_user
    convo = store.create_conversation(uid, "mine")
    other = str(uuid.uuid4())
    assert store.get_conversation(other, convo.id) is None
    assert store.list_messages(other, convo.id) == []
    assert not store.delete_conversation(other, convo.id)
    assert store.rename_conversation(other, convo.id, "hijack") is None


def test_moods(store_and_user: tuple[Store, str]) -> None:
    store, uid = store_and_user
    store.add_mood(uid, 7, "ok")
    assert [m.score for m in store.list_moods(uid)] == [7]


def test_escalation_queue(store_and_user: tuple[Store, str]) -> None:
    store, uid = store_and_user
    esc = store.create_escalation(uid, None, "crisis", "summary")
    assert esc.urgent and esc.status == "open"
    assert esc.id in {e.id for e in store.list_escalations("open")}
    resolved = store.resolve_escalation(esc.id, "admin@example.com")
    assert resolved and resolved.status == "resolved" and resolved.resolved_at


def test_hourly_rate_limit(store_and_user: tuple[Store, str]) -> None:
    store, uid = store_and_user
    results = [store.consume_message_quota(uid, False, LIMITS) for _ in range(4)]
    assert [r.allowed for r in results] == [True, True, True, False]
    assert results[-1].reason == "user_hourly"
    assert store.remaining_quota(uid, False, LIMITS) == 0


def test_demo_total_limit(store_and_user: tuple[Store, str]) -> None:
    store, uid = store_and_user
    results = [store.consume_message_quota(uid, True, LIMITS) for _ in range(3)]
    assert [r.allowed for r in results] == [True, True, False]
    assert results[-1].reason == "demo_total"


def test_demo_global_cap() -> None:
    store = InMemoryStore()
    limits = RateLimits(demo_total=10, demo_global_per_day=2)
    assert store.consume_message_quota("a", True, limits).allowed
    assert store.consume_message_quota("b", True, limits).allowed
    assert store.consume_message_quota("c", True, limits).reason == "demo_global"


def test_contact_messages(store_and_user: tuple[Store, str]) -> None:
    store, _ = store_and_user
    msg = store.add_contact_message("Ada", "ada@example.com", "general", "hello there team")
    assert msg.id in {m.id for m in store.list_contact_messages()}
    if hasattr(store, "pool"):
        with store.pool.connection() as conn:  # type: ignore[attr-defined]
            conn.execute("delete from contact_messages where id = %s", (msg.id,))
