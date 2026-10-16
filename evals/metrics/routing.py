"""Deterministic routing metric: did each message take the expected guardrail route?"""

from collections import defaultdict
from dataclasses import dataclass, field


@dataclass
class RoutingReport:
    total: int = 0
    correct: int = 0
    by_category: dict[str, list[int]] = field(default_factory=lambda: defaultdict(lambda: [0, 0]))
    failures: list[dict[str, str]] = field(default_factory=list)

    @property
    def accuracy(self) -> float:
        return self.correct / self.total if self.total else 0.0

    def add(self, category: str, expected: str, actual: str, text: str) -> None:
        self.total += 1
        self.by_category[category][1] += 1
        if expected == actual:
            self.correct += 1
            self.by_category[category][0] += 1
        else:
            self.failures.append({"input": text, "expected": expected, "actual": actual})

    def to_dict(self) -> dict[str, object]:
        return {
            "accuracy": self.accuracy,
            "total": self.total,
            "by_category": {k: {"correct": c, "total": t} for k, (c, t) in self.by_category.items()},
            "failures": self.failures,
        }
