from pathlib import Path

from langchain_core.embeddings import DeterministicFakeEmbedding
from pydantic import Field

from companion.rag import (
    KnowledgeBase,
    SnapshotEmbeddings,
    _parse_front_matter,
    _text_key,
    format_context,
    load_kb,
    load_snapshot,
    save_snapshot,
    snapshot_path,
)
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
    before = kb.size()
    assert kb.ingest(KB_DIR) == 0  # an existing index is never re-embedded
    assert kb.size() == before


def test_ingest_syncs_only_changes(kb: KnowledgeBase, tmp_path: Path) -> None:
    kept, dropped = sorted(KB_DIR.glob("*.md"))[:2]
    (tmp_path / kept.name).write_text(kept.read_text())
    (tmp_path / "new.md").write_text("---\ntitle: New\nurl: https://example.org\n---\nA new tip.")
    added = kb.ingest(tmp_path)
    titles = {m["file"] for m in kb.store.get()["metadatas"]}
    assert added == 1 and titles == {kept.name, "new.md"} and dropped.name not in titles


class CountingEmbeddings(DeterministicFakeEmbedding):
    calls: list[int] = Field(default_factory=list)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        self.calls.append(len(texts))
        return super().embed_documents(texts)


def test_snapshot_serves_known_chunks_without_api_calls(tmp_path: Path) -> None:
    base = CountingEmbeddings(size=8)
    path = tmp_path / "snap.npz"
    save_snapshot(path, ["known"], [[0.5] * 8], "fake")
    emb = SnapshotEmbeddings(base, load_snapshot(path))
    assert emb.embed_documents(["known"]) == [[0.5] * 8] and base.calls == []
    out = emb.embed_documents(["known", "fresh"])
    assert out[0] == [0.5] * 8 and len(out[1]) == 8 and base.calls == [1]


def test_shipped_snapshot_covers_the_kb() -> None:
    """Fails when data/kb changes without `uv run python -m companion.ingest --snapshot`."""
    from companion.config import Settings

    settings = Settings(embeddings_provider="openai", embeddings_model="text-embedding-3-small",
                        index_snapshot_dir=KB_DIR.parent / "index")
    snapshot = load_snapshot(snapshot_path(settings))
    texts = [d.page_content for d in load_kb(KB_DIR)]
    assert snapshot and all(_text_key(t) in snapshot for t in texts)
    assert len(next(iter(snapshot.values()))) == 1536


def test_prompt_requires_strict_grounding() -> None:
    from companion.prompts import SYSTEM_PROMPT

    assert "MUST come from the provided sources" in SYSTEM_PROMPT
    assert "Do not add tips" in SYSTEM_PROMPT
