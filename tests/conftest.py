import uuid
from pathlib import Path

import pytest
from langchain_chroma import Chroma
from langchain_core.embeddings import DeterministicFakeEmbedding
from langchain_core.language_models import FakeListChatModel

from companion.graph import CompanionAgent, build_graph
from companion.rag import KnowledgeBase

KB_DIR = Path(__file__).resolve().parents[1] / "data" / "kb"


@pytest.fixture
def kb() -> KnowledgeBase:
    store = Chroma(collection_name=f"test_{uuid.uuid4().hex}",
                   embedding_function=DeterministicFakeEmbedding(size=64))
    knowledge = KnowledgeBase(store, k=2)
    knowledge.ingest(KB_DIR)
    return knowledge


def make_agent(kb: KnowledgeBase, data_dir: Path, replies: list[str]) -> CompanionAgent:
    return CompanionAgent(build_graph(FakeListChatModel(responses=replies), kb, data_dir))


@pytest.fixture
def agent(kb: KnowledgeBase, tmp_path: Path) -> CompanionAgent:
    return make_agent(kb, tmp_path, ["That sounds hard. A steady sleep schedule may help [1]."])
