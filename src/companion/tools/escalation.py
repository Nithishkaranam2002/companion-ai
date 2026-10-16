"""Escalation to a human. Writes a ticket to a queue a human reviewer monitors."""

import uuid
from datetime import UTC, datetime
from pathlib import Path

from pydantic import BaseModel, Field

from companion.guardrails.redaction import redact
from companion.tools._store import append_jsonl

URGENT_REASONS = frozenset({"crisis", "medical_emergency"})


class EscalationTicket(BaseModel):
    ticket_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    session_id: str
    reason: str
    summary: str
    urgent: bool
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


def escalate_to_human(data_dir: Path, session_id: str, reason: str, summary: str) -> EscalationTicket:
    ticket = EscalationTicket(
        session_id=session_id,
        reason=reason,
        summary=redact(summary),
        urgent=reason in URGENT_REASONS,
    )
    append_jsonl(data_dir / "escalations.jsonl", ticket.model_dump())
    return ticket
