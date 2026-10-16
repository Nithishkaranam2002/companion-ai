"""Refusal and escalation policy: maps scope labels to routes and fixed responses."""

from enum import StrEnum

from companion.guardrails.scope import ScopeLabel


class Route(StrEnum):
    ANSWER = "answer"
    REFUSE = "refuse"
    ESCALATE = "escalate"


CRISIS_RESOURCES = (
    "If you are in the US, you can call or text 988 (Suicide & Crisis Lifeline) any time. "
    "Elsewhere, please contact your local emergency number or a crisis line "
    "(findahelpline.com lists them by country)."
)

RESPONSES: dict[ScopeLabel, str] = {
    ScopeLabel.CRISIS: (
        "I'm really glad you told me, and I'm sorry you're carrying this right now. "
        "Your safety matters most, and you deserve support from a real person. "
        f"{CRISIS_RESOURCES} I've also flagged this conversation for a human on our team. "
        "Are you safe right now?"
    ),
    ScopeLabel.MEDICAL_EMERGENCY: (
        "This sounds like it could be a medical emergency. Please call your local emergency "
        "number (911 in the US) or go to the nearest emergency room now. "
        "I've flagged this conversation for a human on our team."
    ),
    ScopeLabel.HUMAN_REQUEST: (
        "Of course. I've passed this conversation to a human on our team, and someone will "
        "follow up. I'm happy to keep talking in the meantime if that helps."
    ),
    ScopeLabel.MEDICAL_ADVICE: (
        "I'm a wellness companion, not a medical provider, so I can't diagnose conditions or "
        "advise on medications, doses, or treatments. A doctor, pharmacist, or licensed "
        "clinician is the right person for that. If it helps, I can share general wellness "
        "information or help you prepare questions for that conversation."
    ),
}

ROUTES: dict[ScopeLabel, Route] = {
    ScopeLabel.CRISIS: Route.ESCALATE,
    ScopeLabel.MEDICAL_EMERGENCY: Route.ESCALATE,
    ScopeLabel.HUMAN_REQUEST: Route.ESCALATE,
    ScopeLabel.MEDICAL_ADVICE: Route.REFUSE,
    ScopeLabel.IN_SCOPE: Route.ANSWER,
}


def route_for(label: ScopeLabel) -> Route:
    return ROUTES[label]


def response_for_route(label: ScopeLabel) -> str | None:
    """Fixed response for refuse/escalate labels; None when the LLM should answer."""
    return RESPONSES.get(label)
