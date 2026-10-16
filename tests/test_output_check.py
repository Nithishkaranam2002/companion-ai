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


@pytest.mark.parametrize("reply", [
    "Take 5 minutes to breathe before you go on.",
    "Try to take 3 deep breaths.",
])
def test_breathing_advice_is_not_a_dose(reply: str) -> None:
    assert not violates_medical_line(reply)
