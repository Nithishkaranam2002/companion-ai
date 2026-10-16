"""Index the knowledge base into ChromaDB. Run: uv run python -m companion.ingest"""

from companion.config import get_settings, require_provider_keys
from companion.rag import KnowledgeBase


def main() -> None:
    settings = get_settings()
    if settings.embeddings_provider != "hash":
        require_provider_keys(settings.model_copy(update={"llm_provider": settings.embeddings_provider}))
    count = KnowledgeBase.from_settings(settings).ingest(settings.kb_dir)
    print(f"Indexed {count} chunks from {settings.kb_dir}")


if __name__ == "__main__":
    main()
