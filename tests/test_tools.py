import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from companion.tools import escalate_to_human, log_mood, read_moods


def test_mood_log_redacts_note(tmp_path: Path) -> None:
    log_mood(tmp_path, "u1", 4, "call me at 555-123-4567")
    raw = (tmp_path / "moods.jsonl").read_text()
    assert "555-123-4567" not in raw
    assert read_moods(tmp_path, "u1")[0].score == 4


def test_mood_scores_are_bounded(tmp_path: Path) -> None:
    with pytest.raises(ValidationError):
        log_mood(tmp_path, "u1", 11)


def test_read_moods_filters_by_user(tmp_path: Path) -> None:
    log_mood(tmp_path, "u1", 5)
    log_mood(tmp_path, "u2", 6)
    assert [m.user_id for m in read_moods(tmp_path, "u1")] == ["u1"]


def test_escalation_ticket(tmp_path: Path) -> None:
    ticket = escalate_to_human(tmp_path, "s1", "crisis", "jane@example.com feels unsafe")
    stored = json.loads((tmp_path / "escalations.jsonl").read_text())
    assert ticket.urgent and stored["ticket_id"] == ticket.ticket_id
    assert "jane@example.com" not in stored["summary"]
