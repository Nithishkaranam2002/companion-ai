"""PII/PHI redaction. Uses Microsoft Presidio when its NLP model is available,
and always applies a regex pass so redaction never silently degrades to a no-op."""

import logging
import re
from functools import lru_cache
from typing import Any

logger = logging.getLogger(__name__)

PRESIDIO_ENTITIES = [
    "PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "US_SSN", "CREDIT_CARD",
    "IP_ADDRESS", "LOCATION", "DATE_TIME", "MEDICAL_LICENSE", "US_DRIVER_LICENSE",
]

SPACY_MODELS = ("en_core_web_lg", "en_core_web_md", "en_core_web_sm")

_REGEX_RULES: list[tuple[str, re.Pattern[str]]] = [
    ("EMAIL_ADDRESS", re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")),
    ("US_SSN", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
    ("CREDIT_CARD", re.compile(r"\b(?:\d[ -]?){13,16}\b")),
    ("PHONE_NUMBER", re.compile(r"(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b")),
    ("IP_ADDRESS", re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")),
    ("MRN", re.compile(r"\b(?:MRN|medical record(?: number)?)[:#\s]*\d{5,}\b", re.IGNORECASE)),
    ("DATE_OF_BIRTH", re.compile(r"\b(?:DOB|date of birth)[:\s]*[\d/.-]{6,10}\b", re.IGNORECASE)),
]


@lru_cache(maxsize=1)
def _presidio() -> tuple[Any, Any] | None:
    try:
        import spacy.util
        from presidio_analyzer import AnalyzerEngine
        from presidio_analyzer.nlp_engine import NlpEngineProvider
        from presidio_anonymizer import AnonymizerEngine

        model = next((m for m in SPACY_MODELS if spacy.util.is_package(m)), None)
        if model is None:
            raise LookupError("no spaCy model installed")
        nlp = NlpEngineProvider(nlp_configuration={
            "nlp_engine_name": "spacy",
            "models": [{"lang_code": "en", "model_name": model}],
        }).create_engine()
        return AnalyzerEngine(nlp_engine=nlp, supported_languages=["en"]), AnonymizerEngine()
    except Exception as exc:  # noqa: BLE001 - any failure falls back to regex-only
        logger.warning("Presidio unavailable (%s); using regex redaction only.", type(exc).__name__)
        return None


def _regex_redact(text: str) -> str:
    for label, pattern in _REGEX_RULES:
        text = pattern.sub(f"<{label}>", text)
    return text


def _presidio_redact(text: str) -> str:
    engines = _presidio()
    if engines is None:
        return text
    analyzer, anonymizer = engines
    results = analyzer.analyze(text=text, entities=PRESIDIO_ENTITIES, language="en")
    return anonymizer.anonymize(text=text, analyzer_results=results).text


def redact(text: str, use_presidio: bool = True) -> str:
    """Return `text` with PII/PHI replaced by <ENTITY> placeholders."""
    redacted = _presidio_redact(text) if use_presidio else text
    return _regex_redact(redacted)
