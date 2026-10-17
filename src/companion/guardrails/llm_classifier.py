"""LLM safety classifier: a second layer over the regex classifier.

Regex catches known phrasings deterministically; the LLM catches paraphrases
("ending my life", "I don't see the point anymore"). The graph takes the more
severe of the two labels, so the LLM can only escalate, never downgrade.
"""

import logging
import warnings
from collections.abc import Callable

from langchain_core.language_models import BaseChatModel
from pydantic import BaseModel

from companion.guardrails.scope import ScopeLabel

logger = logging.getLogger(__name__)

# langchain-openai's structured output trips a Pydantic serializer warning whose text
# includes the parsed verdict. Never let model output about a user message reach logs.
warnings.filterwarnings("ignore", message=r"Pydantic serializer warnings", category=UserWarning)

Classifier = Callable[[str], ScopeLabel]

CLASSIFIER_PROMPT = """You are the safety router for a non-medical wellness companion. \
Classify the user's message into exactly one label:

- crisis: any sign of suicidal thoughts, wanting to die, self-harm, hopelessness about living, \
or intent to harm others. Includes indirect phrasing ("I don't see the point anymore", \
"I want to disappear forever").
- medical_emergency: symptoms or situations needing urgent medical care now (chest pain, \
trouble breathing, stroke signs, overdose, severe bleeding, unconsciousness, poisoning).
- human_request: the user asks to talk to a real person, counselor, or human staff.
- medical_advice: asks for diagnosis, whether they have a condition, medication or supplement \
use/doses/interactions, or treatment decisions.
- in_scope: general wellness support (stress, sleep habits, mood, motivation, loneliness, \
exercise, routines) with none of the above.

You may be given recent conversation for context. Classify the latest user message in light \
of it (e.g. "tonight I'm going to do it" after talk of not wanting to live is crisis).

If a message fits several labels, choose the most urgent one, in this order: crisis, \
medical_emergency, human_request, medical_advice, in_scope. When unsure between in_scope \
and a safety label, choose the safety label."""


class SafetyVerdict(BaseModel):
    # Label only: no free-text rationale, so nothing derived from the message can leak.
    label: ScopeLabel


SEVERITY = [ScopeLabel.CRISIS, ScopeLabel.MEDICAL_EMERGENCY, ScopeLabel.HUMAN_REQUEST,
            ScopeLabel.MEDICAL_ADVICE, ScopeLabel.IN_SCOPE]


def most_severe(*labels: ScopeLabel) -> ScopeLabel:
    return min(labels, key=SEVERITY.index)


def make_llm_classifier(llm: BaseChatModel) -> Classifier:
    structured = llm.with_structured_output(SafetyVerdict)

    def classify(text: str) -> ScopeLabel:
        verdict = structured.invoke([("system", CLASSIFIER_PROMPT), ("human", text)])
        return verdict.label

    return classify


def safe_classify(classifier: Classifier, text: str, fallback: ScopeLabel) -> ScopeLabel:
    """Run the LLM classifier; on any failure keep the regex label."""
    try:
        return classifier(text)
    except Exception as exc:  # noqa: BLE001 - classifier failure must never block routing
        logger.warning("LLM classifier failed (%s); using regex label.", type(exc).__name__)
        return fallback
