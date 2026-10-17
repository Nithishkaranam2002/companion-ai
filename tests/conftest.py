import uuid
from pathlib import Path

import pytest
from langchain_chroma import Chroma
from langchain_core.embeddings import DeterministicFakeEmbedding
from langchain_core.language_models import FakeListChatModel

from companion.db.store import InMemoryStore, Store
from companion.graph import CompanionAgent, CompanionState, EscalateFn, build_graph
from companion.rag import KnowledgeBase

KB_DIR = Path(__file__).resolve().parents[1] / "data" / "kb"


@pytest.fixture
def kb() -> KnowledgeBase:
    store = Chroma(collection_name=f"test_{uuid.uuid4().hex}",
                   embedding_function=DeterministicFakeEmbedding(size=64))
    knowledge = KnowledgeBase(store, k=2)
    knowledge.ingest(KB_DIR)
    return knowledge


@pytest.fixture
def store() -> InMemoryStore:
    return InMemoryStore()


def escalate_into(store: Store) -> EscalateFn:
    def escalate(state: CompanionState, reason: str, summary: str) -> str:
        return store.create_escalation(state.get("user_id"), None, reason, summary).id
    return escalate


def make_agent(kb: KnowledgeBase, store: Store, replies: list[str],
               classifier=None) -> CompanionAgent:
    llm = FakeListChatModel(responses=replies)
    return CompanionAgent(build_graph(llm, kb, escalate_into(store), classifier))


@pytest.fixture
def agent(kb: KnowledgeBase, store: InMemoryStore) -> CompanionAgent:
    return make_agent(kb, store, ["That sounds hard. A steady sleep schedule may help [1]."])
