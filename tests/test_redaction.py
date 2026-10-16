from companion.guardrails.redaction import redact


def test_regex_redaction_without_presidio() -> None:
    out = redact("mail me at a.b@example.com or 555-123-4567, SSN 123-45-6789, MRN: 1234567",
                 use_presidio=False)
    for leaked in ("a.b@example.com", "555-123-4567", "123-45-6789", "1234567"):
        assert leaked not in out
    assert "<EMAIL_ADDRESS>" in out and "<US_SSN>" in out


def test_presidio_redacts_names_and_places() -> None:
    out = redact("My name is Jane Doe and I live in Boston.")
    assert "Jane Doe" not in out
    assert "Boston" not in out


def test_redaction_keeps_wellness_content() -> None:
    assert "anxious" in redact("I feel anxious about tomorrow.")
