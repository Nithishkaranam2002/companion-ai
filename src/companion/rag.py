"""Retrieval over the curated wellness knowledge base (ChromaDB)."""

import hashlib
from dataclasses import dataclass
from pathlib import Path

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.embeddings import DeterministicFakeEmbedding, Embeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from companion.config import Settings, get_settings

COLLECTION = "wellness_kb"


@dataclass(frozen=True)
class Source:
    title: str
    url: str
    snippet: str


def make_embeddings(settings: Settings) -> Embeddings:
    if settings.embeddings_provider == "openai":
        from langchain_openai import OpenAIEmbeddings

        return OpenAIEmbeddings(model=settings.embeddings_model)
    if settings.embeddings_provider == "voyage":
        from langchain_voyageai import VoyageAIEmbeddings  # optional dependency

        return VoyageAIEmbeddings(model=settings.embeddings_model)
    return DeterministicFakeEmbedding(size=256)


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
        docs = load_kb(kb_dir)
        if docs:
            self.store.add_documents(docs, ids=[_doc_id(d) for d in docs])
        return len(docs)

    def search(self, query: str, k: int | None = None) -> list[Source]:
        hits = self.store.similarity_search(query, k=k or self.k)
        return [Source(title=d.metadata["title"], url=d.metadata["url"], snippet=d.page_content)
                for d in hits]


def format_context(sources: list[Source]) -> str:
    return "\n\n".join(f"[{i}] {s.title} ({s.url})\n{s.snippet}" for i, s in enumerate(sources, 1))
