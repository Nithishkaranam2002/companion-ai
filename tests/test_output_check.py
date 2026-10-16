import pytest

from companion.guardrails.output_check import violates_medical_line


@pytest.mark.parametrize("reply", [
    "Try taking 5 mg of melatonin.",
    "You probably have depression.",
    "You should stop your medication.",
    "Take 2 tablets before bed.",
])
def test_flags_medical_advice(reply: str) -> None:
    assert violates_medical_line(reply)


def test_allows_wellness_reply() -> None:
    assert not violates_medical_line("A 5 minute breathing exercise might help you unwind [1].")
