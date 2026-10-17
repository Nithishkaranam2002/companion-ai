"""Index the knowledge base into ChromaDB.

Run: uv run python -m companion.ingest             # sync the local index
     uv run python -m companion.ingest --snapshot  # refresh data/index/*.npz after editing data/kb
"""

import argparse

from companion.config import Settings, get_settings, require_provider_keys
from companion.rag import KnowledgeBase, load_kb, make_embeddings, save_snapshot, snapshot_path


def write_snapshot(settings: Settings) -> int:
    """Embed every KB chunk and save the vectors, so deployments start without embedding calls."""
    texts = [d.page_content for d in load_kb(settings.kb_dir)]
    vectors = make_embeddings(settings, use_snapshot=False).embed_documents(texts)
    save_snapshot(snapshot_path(settings), texts, vectors, settings.embeddings_model)
    return len(texts)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", action="store_true", help="rebuild the shipped vector snapshot")
    args = parser.parse_args()
    settings = get_settings()
    if settings.embeddings_provider != "hash":
        require_provider_keys(settings.model_copy(update={"llm_provider": settings.embeddings_provider}))
    if args.snapshot:
        print(f"Wrote {write_snapshot(settings)} vectors to {snapshot_path(settings)}")
        return
    kb = KnowledgeBase.from_settings(settings)
    added = kb.ingest(settings.kb_dir)
    print(f"Added {added} new chunks; index has {kb.size()} chunks from {settings.kb_dir}")


if __name__ == "__main__":
    main()
