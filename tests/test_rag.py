from companion.rag import KnowledgeBase, _parse_front_matter, format_context, load_kb
from tests.conftest import KB_DIR


def test_load_kb_has_citable_metadata() -> None:
    docs = load_kb(KB_DIR)
    assert docs
    assert all(d.metadata["title"] and d.metadata["url"].startswith("https://") for d in docs)


def test_front_matter_parsing() -> None:
    meta, body = _parse_front_matter("---\ntitle: T\nurl: https://x\n---\nbody")
    assert meta == {"title": "T", "url": "https://x"} and body == "body"


def test_search_returns_sources(kb: KnowledgeBase) -> None:
    sources = kb.search("sleep")
    assert len(sources) == 2
    assert "[1]" in format_context(sources)


def test_ingest_is_idempotent(kb: KnowledgeBase) -> None:
    before = len(kb.store.get()["ids"])
    kb.ingest(KB_DIR)
    assert len(kb.store.get()["ids"]) == before


def test_prompt_requires_strict_grounding() -> None:
    from companion.prompts import SYSTEM_PROMPT

    assert "MUST come from the provided sources" in SYSTEM_PROMPT
    assert "Do not add tips" in SYSTEM_PROMPT
