from api.warmup import Warmup


def test_retries_failed_checks_until_they_pass() -> None:
    calls = {"n": 0}

    def flaky() -> None:
        calls["n"] += 1
        if calls["n"] < 3:
            raise TimeoutError("down")

    w = Warmup({"kb": flaky, "llm": lambda: None}, base_delay_s=0.001)
    assert w.status == "degraded" and w.checks == {"kb": "starting", "llm": "starting"}
    w.run()
    assert w.status == "ok" and calls["n"] == 3


def test_failed_check_reports_type_only() -> None:
    def boom() -> None:
        raise ValueError("Bearer sk-live-123")

    w = Warmup({"kb": boom})
    assert not w.run_once()
    assert w.checks == {"kb": "error: ValueError"}


def test_passing_checks_are_not_rerun() -> None:
    calls = []
    w = Warmup({"kb": lambda: calls.append(1)})
    w.run_once()
    w.run_once()
    assert calls == [1]


def test_stop_ends_retry_loop() -> None:
    def boom() -> None:
        raise OSError

    w = Warmup({"kb": boom}, base_delay_s=60)
    thread = w.start()
    w.stop()
    thread.join(timeout=2)
    assert not thread.is_alive() and w.status == "degraded"
