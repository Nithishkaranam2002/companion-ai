"""Background start-up checks: the API boots even when a dependency is down, then keeps retrying."""

import logging
import threading
from collections.abc import Callable
from typing import Literal

logger = logging.getLogger("companion.api")


class Warmup:
    """Runs named start-up tasks in a thread, retrying failures with capped exponential backoff."""

    def __init__(self, tasks: dict[str, Callable[[], object]], base_delay_s: float = 2.0,
                 max_delay_s: float = 300.0) -> None:
        self.tasks = tasks
        self.base_delay_s = base_delay_s
        self.max_delay_s = max_delay_s
        self.checks: dict[str, str] = {name: "starting" for name in tasks}
        self._stop = threading.Event()

    @property
    def status(self) -> Literal["ok", "degraded"]:
        return "ok" if all(v == "ok" for v in self.checks.values()) else "degraded"

    def run_once(self) -> bool:
        for name, task in self.tasks.items():
            if self.checks[name] == "ok":
                continue
            try:
                task()
                self.checks[name] = "ok"
            except Exception as exc:  # noqa: BLE001 - report the type only; messages can echo config
                self.checks[name] = f"error: {type(exc).__name__}"
                logger.warning("startup check %s failed (%s); will retry", name,
                               type(exc).__name__)
        return self.status == "ok"

    def run(self) -> None:
        delay = self.base_delay_s
        while not self.run_once() and not self._stop.wait(delay):
            delay = min(delay * 2, self.max_delay_s)
        if self.status == "ok":
            logger.info("startup checks passed")

    def start(self) -> threading.Thread:
        self._stop.clear()
        self.checks = {name: "starting" for name in self.tasks}
        thread = threading.Thread(target=self.run, name="warmup", daemon=True)
        thread.start()
        return thread

    def stop(self) -> None:
        self._stop.set()

