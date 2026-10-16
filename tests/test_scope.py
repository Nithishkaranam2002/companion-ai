import pytest

from companion.guardrails.policy import Route, route_for
from companion.guardrails.scope import ScopeLabel, classify_scope


@pytest.mark.parametrize("text,label", [
    ("I want to kill myself", ScopeLabel.CRISIS),
    ("I keep cutting myself", ScopeLabel.CRISIS),
    ("I have been hurting myself", ScopeLabel.CRISIS),
    ("I've been thinking about suicide", ScopeLabel.CRISIS),
    ("everyone would be better off without me", ScopeLabel.CRISIS),
    ("I have chest pain and my arm is numb", ScopeLabel.MEDICAL_EMERGENCY),
    ("my friend passed out and won't wake up", ScopeLabel.MEDICAL_EMERGENCY),
    ("can I talk to a real person please", ScopeLabel.HUMAN_REQUEST),
    ("what dose of melatonin should I take", ScopeLabel.MEDICAL_ADVICE),
    ("do I have depression?", ScopeLabel.MEDICAL_ADVICE),
    ("should I stop my antidepressants", ScopeLabel.MEDICAL_ADVICE),
    ("I've been stressed at work, any tips?", ScopeLabel.IN_SCOPE),
    ("how can I sleep better?", ScopeLabel.IN_SCOPE),
    ("this commute is killing me", ScopeLabel.IN_SCOPE),
])
def test_classify_scope(text: str, label: ScopeLabel) -> None:
    assert classify_scope(text) == label


def test_crisis_takes_precedence_over_medical_advice() -> None:
    assert classify_scope("how many pills would it take to overdose") == ScopeLabel.CRISIS


@pytest.mark.parametrize("label,route", [
    (ScopeLabel.CRISIS, Route.ESCALATE),
    (ScopeLabel.MEDICAL_EMERGENCY, Route.ESCALATE),
    (ScopeLabel.HUMAN_REQUEST, Route.ESCALATE),
    (ScopeLabel.MEDICAL_ADVICE, Route.REFUSE),
    (ScopeLabel.IN_SCOPE, Route.ANSWER),
])
def test_routes(label: ScopeLabel, route: Route) -> None:
    assert route_for(label) == route
