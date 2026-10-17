import pytest

from companion.db.store import InMemoryStore
from companion.guardrails.empathy import FALLBACK_ACK, acceptable_ack, safe_ack
from companion.guardrails.policy import Route
from companion.rag import KnowledgeBase
from tests.conftest import make_agent


@pytest.mark.parametrize("ack", [
    "It sounds really frustrating to feel like you can't focus, and I'm sorry it's been so hard.",
    "Feeling better after a tough stretch is a big deal, and it makes sense to wonder what's next.",
])
def test_accepts_pure_empathy(ack: str) -> None:
    assert acceptable_ack(ack)


@pytest.mark.parametrize("ack", [
    "That sounds hard. You should try melatonin.",
    "I'm sorry. Many people take 3 mg to sleep.",
    "It sounds like you have ADHD.",
    "That sounds tough. Consider talking to your doctor.",
    "I hear you. Have you tried journaling?",
    "One. Two. Three sentences is too many.",
    "",
    "x" * 300,
])
def test_rejects_advice_medical_or_malformed(ack: str) -> None:
    assert not acceptable_ack(ack)


def test_safe_ack_falls_back_on_bad_or_failing_llm() -> None:
    assert safe_ack(lambda _: "You should stop your meds.", "x") == FALLBACK_ACK

    def boom(_: str) -> str:
        raise TimeoutError

    assert safe_ack(boom, "x") == FALLBACK_ACK
    assert safe_ack(None, "x") == FALLBACK_ACK


def test_refusal_is_personalised_but_core_is_fixed(kb: KnowledgeBase, store: InMemoryStore) -> None:
    from langchain_core.language_models import FakeListChatModel

    from companion.graph import CompanionAgent, build_graph
    from tests.conftest import escalate_into

    ack = "It sounds really frustrating to feel like you can't focus."
    agent = CompanionAgent(build_graph(FakeListChatModel(responses=["unused"]), kb,
                                       escalate_into(store), acknowledger=lambda _: ack))
    state = agent.respond("s", "Do I have ADHD? I can't focus at all.")
    assert state["route"] == Route.REFUSE
    assert state["reply"].startswith(ack)
    assert "doctor, pharmacist, or licensed clinician" in state["reply"]


def test_refusal_without_acknowledger_uses_fallback(kb: KnowledgeBase, store: InMemoryStore) -> None:
    state = make_agent(kb, store, ["unused"]).respond("s", "What dose of melatonin should I take?")
    assert state["reply"].startswith(FALLBACK_ACK)
