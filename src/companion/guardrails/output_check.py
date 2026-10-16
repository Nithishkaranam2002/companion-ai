"""Post-generation check: catches model replies that cross the non-medical line."""

import re

_PATTERNS = (
    r"\b\d+(\.\d+)?\s?(mg|mcg|milligrams?|ml)\b",
    r"\btake \d+\b",
    (r"\byou (probably |likely |may |might )?(have|are suffering from) (a |an )?"
     r"(depression|anxiety disorder|bipolar|adhd|ptsd|ocd|insomnia disorder)\b"),
    r"\bi (diagnose|would diagnose)\b",
    r"\b(increase|decrease|stop|start) (taking )?your (medication|meds|dose)\b",
)
_VIOLATIONS = re.compile("|".join(f"(?:{p})" for p in _PATTERNS), re.IGNORECASE)


def violates_medical_line(reply: str) -> bool:
    return bool(_VIOLATIONS.search(reply))
