"""ragas 0.4.x imports `langchain_community.chat_models.vertexai`, which no longer exists in
langchain-community releases compatible with LangChain 1.x. Register a placeholder module so
ragas imports cleanly; Vertex AI is not used here. Remove once ragas drops the import."""

import sys
import types

_MODULE = "langchain_community.chat_models.vertexai"


def install() -> None:
    if _MODULE in sys.modules:
        return
    try:
        __import__(_MODULE)
    except ImportError:
        stub = types.ModuleType(_MODULE)
        stub.ChatVertexAI = type("ChatVertexAI", (), {})  # type: ignore[attr-defined]
        sys.modules[_MODULE] = stub
