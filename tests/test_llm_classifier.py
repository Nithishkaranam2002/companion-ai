from companion.db.store import InMemoryStore
from companion.graph import CompanionAgent
from companion.guardrails.llm_classifier import most_severe, safe_classify
from companion.guardrails.policy import Route
from companion.guardrails.scope import ScopeLabel
from companion.rag import KnowledgeBase
from tests.conftest import make_agent


def _agent(kb: KnowledgeBase, store: InMemoryStore, label: ScopeLabel) -> CompanionAgent:
    return make_agent(kb, store, ["ok [1]"], classifier=lambda _: label)


def test_most_severe_ordering() -> None:
    assert most_severe(ScopeLabel.IN_SCOPE, ScopeLabel.CRISIS) == ScopeLabel.CRISIS
    assert most_severe(ScopeLabel.MEDICAL_ADVICE, ScopeLabel.HUMAN_REQUEST) == ScopeLabel.HUMAN_REQUEST


def test_llm_layer_escalates_paraphrased_crisis(kb: KnowledgeBase, store: InMemoryStore) -> None:
    state = _agent(kb, store, ScopeLabel.CRISIS).respond("s", "I don't see the point anymore")
    assert state["route"] == Route.ESCALATE and state["ticket_id"]


def test_llm_layer_cannot_downgrade_regex(kb: KnowledgeBase, store: InMemoryStore) -> None:
    state = _agent(kb, store, ScopeLabel.IN_SCOPE).respond("s", "I want to kill myself")
    assert state["route"] == Route.ESCALATE


def test_classifier_failure_falls_back_to_regex() -> None:
    def broken(_: str) -> ScopeLabel:
        raise TimeoutError

    assert safe_classify(broken, "x", ScopeLabel.MEDICAL_ADVICE) == ScopeLabel.MEDICAL_ADVICE


def test_classifier_sees_recent_history(kb: KnowledgeBase, store: InMemoryStore) -> None:
    seen: list[str] = []

    def spy(text: str) -> ScopeLabel:
        seen.append(text)
        return ScopeLabel.CRISIS if "better off" in text else ScopeLabel.IN_SCOPE

    agent = make_agent(kb, store, ["ok"], classifier=spy)
    history = [{"role": "user", "content": "they'd all be better off"}]
    state = agent.respond("s", "Tonight I'm going to do it.", history)
    assert "Tonight" in seen[0] and "better off" in seen[0]
    assert state["route"] == Route.ESCALATE


def test_verdict_has_no_free_text_fields() -> None:
    from companion.guardrails.llm_classifier import SafetyVerdict

    assert set(SafetyVerdict.model_fields) == {"label"}
