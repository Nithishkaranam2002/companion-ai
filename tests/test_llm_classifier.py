from pathlib import Path

from langchain_core.language_models import FakeListChatModel

from companion.graph import CompanionAgent, build_graph
from companion.guardrails.llm_classifier import most_severe, safe_classify
from companion.guardrails.policy import Route
from companion.guardrails.scope import ScopeLabel
from companion.rag import KnowledgeBase


def _agent(kb: KnowledgeBase, tmp_path: Path, label: ScopeLabel) -> CompanionAgent:
    llm = FakeListChatModel(responses=["ok [1]"])
    return CompanionAgent(build_graph(llm, kb, tmp_path, classifier=lambda _: label))


def test_most_severe_ordering() -> None:
    assert most_severe(ScopeLabel.IN_SCOPE, ScopeLabel.CRISIS) == ScopeLabel.CRISIS
    assert most_severe(ScopeLabel.MEDICAL_ADVICE, ScopeLabel.HUMAN_REQUEST) == ScopeLabel.HUMAN_REQUEST


def test_llm_layer_escalates_paraphrased_crisis(kb: KnowledgeBase, tmp_path: Path) -> None:
    state = _agent(kb, tmp_path, ScopeLabel.CRISIS).respond("s", "I don't see the point anymore")
    assert state["route"] == Route.ESCALATE and state["ticket_id"]


def test_llm_layer_cannot_downgrade_regex(kb: KnowledgeBase, tmp_path: Path) -> None:
    state = _agent(kb, tmp_path, ScopeLabel.IN_SCOPE).respond("s", "I want to kill myself")
    assert state["route"] == Route.ESCALATE


def test_classifier_failure_falls_back_to_regex() -> None:
    def broken(_: str) -> ScopeLabel:
        raise TimeoutError

    assert safe_classify(broken, "x", ScopeLabel.MEDICAL_ADVICE) == ScopeLabel.MEDICAL_ADVICE
