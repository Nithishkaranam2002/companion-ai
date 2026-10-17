from companion.db.store import InMemoryStore
from companion.graph import CompanionAgent
from companion.guardrails.policy import Route
from companion.rag import KnowledgeBase
from tests.conftest import make_agent


def test_in_scope_answer_has_sources(agent: CompanionAgent) -> None:
    state = agent.respond("s1", "How can I sleep better?")
    assert state["route"] == Route.ANSWER
    assert state["sources"] and "[1]" in state["reply"]


def test_crisis_escalates_with_resources(agent: CompanionAgent, store: InMemoryStore) -> None:
    state = agent.respond("s1", "I want to end my life", user_id="u1")
    assert state["route"] == Route.ESCALATE
    assert "988" in state["reply"] and state["ticket_id"]
    ticket = store.escalations[state["ticket_id"]]
    assert ticket.urgent and ticket.user_id == "u1"


def test_medical_advice_refused_without_llm(agent: CompanionAgent) -> None:
    state = agent.respond("s1", "What dosage of sertraline should I take?")
    assert state["route"] == Route.REFUSE
    assert "not a medical provider" in state["reply"]


def test_unsafe_llm_output_is_replaced(kb: KnowledgeBase, store: InMemoryStore) -> None:
    unsafe = make_agent(kb, store, ["You should take 10 mg of melatonin."])
    state = unsafe.respond("s1", "I can't seem to fall asleep lately")
    assert state["route"] == Route.REFUSE
    assert "10 mg" not in state["reply"]


def test_input_is_redacted_before_graph(agent: CompanionAgent) -> None:
    state = agent.respond("s1", "I'm Jane Doe, email jane@example.com, and I'm stressed",
                          history=[{"role": "user", "content": "call 555-123-4567"}])
    assert "jane@example.com" not in state["message"]
    assert "Jane Doe" not in state["message"]
    assert "555-123-4567" not in state["history"][0]["content"]
