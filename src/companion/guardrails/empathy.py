"""Warm, personalised refusals without letting the LLM give advice.

The LLM writes only a short acknowledgment of what the person is feeling. It is
validated strictly; anything that looks like advice or medical content is
discarded in favour of a fixed opener. The refusal itself is always fixed text.
"""

import logging
import re
from collections.abc import Callable

from langchain_core.language_models import BaseChatModel

from companion.guardrails.output_check import violates_medical_line
from companion.guardrails.scope import ScopeLabel, classify_scope

logger = logging.getLogger(__name__)

Acknowledger = Callable[[str], str]

FALLBACK_ACK = "Thank you for trusting me with this. It makes sense that you want answers."
MAX_ACK_CHARS = 240
_ADVICE = re.compile(
    r"\b(try|take|taking|should|recommend|suggest|consider|dose|mg|medication|meds|"
    r"supplement|diagnos\w*|disorder|treat\w*|prescri\w*|doctor|you have)\b", re.IGNORECASE)

ACK_PROMPT = """Write ONE or TWO short, warm sentences that acknowledge how the person feels \
about what they shared. Reflect their feeling back in plain, kind words.

Strict rules: do not give any advice or suggestions; do not mention medications, \
supplements, conditions, diagnoses, doses, treatments, or professionals; do not ask questions; \
no lists. Output only the sentences."""


def acceptable_ack(text: str) -> bool:
    text = text.strip()
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", text) if s]
    return (
        0 < len(text) <= MAX_ACK_CHARS
        and len(sentences) <= 2
        and "?" not in text
        and "\n" not in text
        and not _ADVICE.search(text)
        and not violates_medical_line(text)
        and classify_scope(text) == ScopeLabel.IN_SCOPE
    )


def make_acknowledger(llm: BaseChatModel) -> Acknowledger:
    def acknowledge(message: str) -> str:
        return str(llm.invoke([("system", ACK_PROMPT), ("human", message)]).content)
    return acknowledge


def safe_ack(acknowledger: Acknowledger | None, message: str) -> str:
    if acknowledger is None:
        return FALLBACK_ACK
    try:
        ack = acknowledger(message).strip()
    except Exception as exc:  # noqa: BLE001 - a failed ack must never block the refusal
        logger.warning("acknowledger failed (%s); using fallback.", type(exc).__name__)
        return FALLBACK_ACK
    return ack if acceptable_ack(ack) else FALLBACK_ACK
