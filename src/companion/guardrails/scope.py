"""Scope classifier: decides whether a message is in scope, needs refusal, or needs escalation.

Rule-based by design: safety-critical routing must be deterministic, fast, and
testable. Precedence is crisis > medical emergency > human request > medical advice.
"""

import re
from enum import StrEnum


class ScopeLabel(StrEnum):
    CRISIS = "crisis"
    MEDICAL_EMERGENCY = "medical_emergency"
    HUMAN_REQUEST = "human_request"
    MEDICAL_ADVICE = "medical_advice"
    IN_SCOPE = "in_scope"


def _rx(*patterns: str) -> re.Pattern[str]:
    return re.compile("|".join(f"(?:{p})" for p in patterns), re.IGNORECASE)


_RULES: list[tuple[ScopeLabel, re.Pattern[str]]] = [
    (ScopeLabel.CRISIS, _rx(
        r"\b(kill|hurt|harm|cut|starv)\w* myself\b",
        r"\bsuicid(e|al)\b",
        r"\bend (my|it all|my life)\b",
        r"\b(want|wanna) to die\b",
        r"\bno reason to (live|go on)\b",
        r"\bbetter off (dead|without me)\b",
        r"\bself[- ]?harm\b",
        r"\boverdos(e|ing)\b",
    )),
    (ScopeLabel.MEDICAL_EMERGENCY, _rx(
        r"\bchest pain\b",
        r"\b(can'?t|cannot|trouble) breath(e|ing)\b",
        r"\bstroke\b",
        r"\bunconscious\b|\bpassed out\b|\bfainted\b",
        r"\bseizure\b",
        r"\bsevere (bleeding|allergic)\b|\banaphyla",
        r"\bheart attack\b",
    )),
    (ScopeLabel.HUMAN_REQUEST, _rx(
        r"\b(talk|speak|chat) (to|with) (a |an )?(real )?(human|person|someone real|counsel?lor|therapist)\b",
        r"\b(real|actual|live) (human|person)\b",
        r"\bescalate\b",
    )),
    (ScopeLabel.MEDICAL_ADVICE, _rx(
        r"\bdiagnos(e|is|ed)\b",
        r"\bdo i have\b",
        r"\b(dose|dosage|dosing|mg|milligrams?)\b",
        r"\bhow (much|many) .*(take|pills?)\b",
        r"\b(prescri(be|ption)|medication|meds|antidepressants?|ssris?|xanax|adderall|ibuprofen)\b",
        r"\b(treat|treatment|cure) (for|my)\b",
        r"\bshould i (stop|start|take|switch)\b",
    )),
]


def classify_scope(text: str) -> ScopeLabel:
    """Classify a (redacted) user message into a routing label."""
    for label, pattern in _RULES:
        if pattern.search(text):
            return label
    return ScopeLabel.IN_SCOPE
