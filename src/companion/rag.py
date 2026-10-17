"""Retrieval over the curated wellness knowledge base (ChromaDB)."""

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.embeddings import DeterministicFakeEmbedding, Embeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from companion.config import Settings, get_settings

COLLECTION = "wellness_kb"
EMBED_MAX_RETRIES = 4


@dataclass(frozen=True)
class Source:
    title: str
    url: str
    snippet: str


def _text_key(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:32]


def snapshot_path(settings: Settings) -> Path:
    name = f"{settings.embeddings_provider}-{settings.embeddings_model}".replace("/", "_")
    return settings.index_snapshot_dir / f"{name}.npz"


def save_snapshot(path: Path, texts: list[str], vectors: list[list[float]], model: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(path, keys=np.array([_text_key(t) for t in texts]),
                        vectors=np.asarray(vectors, dtype=np.float32),
                        meta=np.array(json.dumps({"model": model})))


def load_snapshot(path: Path) -> dict[str, list[float]]:
    if not path.exists():
        return {}
    with np.load(path) as data:
        return {str(k): v.tolist() for k, v in zip(data["keys"], data["vectors"], strict=True)}


class SnapshotEmbeddings(Embeddings):
    """Serves document vectors from a shipped snapshot; only new or edited chunks hit the API."""

    def __init__(self, base: Embeddings, snapshot: dict[str, list[float]]) -> None:
        self.base = base
        self.snapshot = snapshot

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        missing = [t for t in texts if _text_key(t) not in self.snapshot]
        fresh = dict(zip(missing, self.base.embed_documents(missing), strict=True)) if missing else {}
        return [self.snapshot.get(_text_key(t)) or fresh[t] for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return self.base.embed_query(text)


def make_embeddings(settings: Settings, use_snapshot: bool = True) -> Embeddings:
    if settings.embeddings_provider == "openai":
        from langchain_openai import OpenAIEmbeddings

        base: Embeddings = OpenAIEmbeddings(model=settings.embeddings_model,
                                            max_retries=EMBED_MAX_RETRIES)
    elif settings.embeddings_provider == "voyage":
        from langchain_voyageai import VoyageAIEmbeddings  # optional dependency

        base = VoyageAIEmbeddings(model=settings.embeddings_model)
    else:
        return DeterministicFakeEmbedding(size=256)
    snapshot = load_snapshot(snapshot_path(settings)) if use_snapshot else {}
    return SnapshotEmbeddings(base, snapshot) if snapshot else base


def _parse_front_matter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---"):
        return {}, text
    _, header, body = text.split("---", 2)
    meta = {}
    for line in header.strip().splitlines():
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip()
    return meta, body.strip()


def load_kb(kb_dir: Path) -> list[Document]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)
    docs: list[Document] = []
    for path in sorted(kb_dir.glob("*.md")):
        meta, body = _parse_front_matter(path.read_text(encoding="utf-8"))
        base = {"title": meta.get("title", path.stem), "url": meta.get("url", ""),
                "source": meta.get("source", ""), "file": path.name}
        docs.extend(splitter.create_documents([body], metadatas=[base]))
    return docs


def _doc_id(doc: Document) -> str:
    return hashlib.sha256(f"{doc.metadata['file']}:{doc.page_content}".encode()).hexdigest()[:32]


class KnowledgeBase:
    def __init__(self, store: Chroma, k: int = 4) -> None:
        self.store = store
        self.k = k

    @classmethod
    def from_settings(cls, settings: Settings | None = None, persist: bool = True) -> "KnowledgeBase":
        settings = settings or get_settings()
        store = Chroma(
            collection_name=COLLECTION,
            embedding_function=make_embeddings(settings),
            persist_directory=str(settings.chroma_dir) if persist else None,
        )
        return cls(store, k=settings.retrieval_k)

    def ingest(self, kb_dir: Path) -> int:
        """Sync the index with the KB: embed only new chunks, drop removed ones. Returns # added."""
        docs = {_doc_id(d): d for d in load_kb(kb_dir)}
        existing = set(self.store.get(include=[])["ids"])
        if stale := sorted(existing - docs.keys()):
            self.store.delete(ids=stale)
        new = [i for i in docs if i not in existing]
        if new:
            self.store.add_documents([docs[i] for i in new], ids=new)
        return len(new)

    def size(self) -> int:
        return len(self.store.get(include=[])["ids"])

    def search(self, query: str, k: int | None = None) -> list[Source]:
        hits = self.store.similarity_search(query, k=k or self.k)
        return [Source(title=d.metadata["title"], url=d.metadata["url"], snippet=d.page_content)
                for d in hits]


def format_context(sources: list[Source]) -> str:
    return "\n\n".join(f"[{i}] {s.title} ({s.url})\n{s.snippet}" for i, s in enumerate(sources, 1))
