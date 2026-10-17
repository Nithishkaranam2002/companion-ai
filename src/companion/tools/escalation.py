"""Escalation to a human: creates a ticket in the queue the admin page shows."""

from companion.db.models import Escalation
from companion.db.store import Store
from companion.guardrails.redaction import redact

REASONS = frozenset({"crisis", "medical_emergency", "human_request"})


def escalate_to_human(store: Store, reason: str, summary: str, user_id: str | None = None,
                      conversation_id: str | None = None) -> Escalation:
    if reason not in REASONS:
        raise ValueError(f"reason must be one of {sorted(REASONS)}")
    return store.create_escalation(user_id, conversation_id, reason, redact(summary))
