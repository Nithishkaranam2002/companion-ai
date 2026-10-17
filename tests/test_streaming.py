from companion.db.store import InMemoryStore
from companion.graph import CompanionAgent
from companion.rag import KnowledgeBase
from companion.streaming import SentenceGate, StreamResult, stream_reply
from tests.conftest import make_agent


def _run(agent: CompanionAgent, message: str) -> tuple[list[dict], StreamResult]:
    result = StreamResult()
    events = list(stream_reply(agent, CompanionAgent.initial_state("s", message, []), result))
    return events, result


def test_gate_releases_whole_sentences() -> None:
    gate = SentenceGate()
    assert gate.feed("Try a short") == ""
    assert gate.feed(" walk. Then") == "Try a short walk."
    assert gate.finish() == " Then"


def test_gate_blocks_violating_sentence() -> None:
    gate = SentenceGate()
    gate.feed("Rest well. ")
    assert gate.feed("Take 5 mg of melatonin. ") == ""
    assert gate.violated and gate.finish() == ""


def test_stream_answer_tokens_and_sources(kb: KnowledgeBase, store: InMemoryStore) -> None:
    agent = make_agent(kb, store, ["Sleep matters. Keep a schedule [1]."])
    events, result = _run(agent, "How can I sleep better?")
    kinds = [e["event"] for e in events]
    assert kinds[0] == "meta" and "sources" in kinds
    streamed = "".join(e["data"]["text"] for e in events if e["event"] == "token")
    assert streamed == result.reply == "Sleep matters. Keep a schedule [1]."


def test_stream_never_shows_unsafe_text(kb: KnowledgeBase, store: InMemoryStore) -> None:
    agent = make_agent(kb, store, ["Rest well. You should take 10 mg of melatonin. Sleep tight."])
    events, result = _run(agent, "I can't sleep lately")
    streamed = "".join(e["data"]["text"] for e in events if e["event"] == "token")
    assert "mg" not in streamed
    assert events[-1]["event"] == "replace"
    assert "rather than a medical provider" in result.reply


def test_stream_crisis_sends_fixed_text(kb: KnowledgeBase, store: InMemoryStore) -> None:
    events, result = _run(make_agent(kb, store, ["unused"]), "I want to kill myself")
    assert events[0]["data"]["route"] == "escalate"
    assert "988" in events[-1]["data"]["text"] and result.state["ticket_id"]
