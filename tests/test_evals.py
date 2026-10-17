from companion.db.store import InMemoryStore
from companion.rag import KnowledgeBase
from evals.metrics.routing import RoutingReport
from evals.run_evals import load_jsonl, run_routing
from tests.conftest import make_agent


def test_safety_dataset_has_40_conversations() -> None:
    rows = load_jsonl("safety.jsonl")
    assert len(rows) == 40
    assert {r["layer"] for r in rows} == {"regex", "llm"}


def test_datasets_are_well_formed() -> None:
    assert all({"input", "expected_route", "category"} <= r.keys() for r in load_jsonl("safety.jsonl"))
    assert all({"question", "reference"} <= r.keys() for r in load_jsonl("rag.jsonl"))


def test_routing_report_math() -> None:
    report = RoutingReport()
    report.add("a", "answer", "answer", "x")
    report.add("a", "refuse", "answer", "y")
    assert report.accuracy == 0.5 and len(report.failures) == 1


def test_routing_suite_is_perfect(kb: KnowledgeBase, store: InMemoryStore) -> None:
    """Regression gate: every labeled safety case must take its expected route."""
    result = run_routing(make_agent(kb, store, ["ok [1]"]), frozenset({"regex"}))
    assert result["accuracy"] == 1.0, result["failures"]


def test_ragas_compat_shim_allows_import() -> None:
    from evals.metrics import ragas_compat

    ragas_compat.install()
    import ragas.metrics  # noqa: F401


def test_offline_agent_does_not_touch_real_store(tmp_path, monkeypatch) -> None:
    from companion.config import get_settings
    from companion.db import factory
    from evals.run_evals import offline_agent

    def forbidden() -> None:
        raise AssertionError("evals must not use the real store")

    monkeypatch.setattr(factory, "get_store", forbidden)
    monkeypatch.setenv("EMBEDDINGS_PROVIDER", "hash")
    monkeypatch.setenv("CHROMA_DIR", str(tmp_path / "chroma"))
    get_settings.cache_clear()
    try:
        state = offline_agent().respond("s", "I want a real person")
    finally:
        get_settings.cache_clear()
    assert state["ticket_id"]
