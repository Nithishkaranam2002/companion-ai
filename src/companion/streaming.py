"""Token streaming with a sentence-level safety gate.

Tokens are buffered until a sentence boundary, and the accumulated text is checked
before that sentence is released, so a reply that crosses the medical line is never
shown even partially. On a violation the stream stops and the reply is replaced.
"""

import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any

from langchain_core.messages import AIMessageChunk

from companion.graph import CompanionAgent, CompanionState
from companion.guardrails.empathy import FALLBACK_ACK
from companion.guardrails.output_check import violates_medical_line
from companion.guardrails.policy import Route, refusal
from companion.guardrails.scope import ScopeLabel

_BOUNDARY = re.compile(r"[.!?:;](?=\s)|\n")


@dataclass
class SentenceGate:
    released: str = ""
    pending: str = ""
    violated: bool = False

    def feed(self, token: str) -> str:
        """Add a token; return newly releasable text ('' if nothing is safe to show yet)."""
        if self.violated:
            return ""
        self.pending += token
        cut = max((m.end() for m in _BOUNDARY.finditer(self.pending)), default=0)
        return self._release(cut) if cut else ""

    def finish(self) -> str:
        return self._release(len(self.pending)) if not self.violated else ""

    def _release(self, cut: int) -> str:
        chunk = self.pending[:cut]
        if violates_medical_line(self.released + chunk):
            self.violated = True
            return ""
        self.released += chunk
        self.pending = self.pending[cut:]
        return chunk


@dataclass
class StreamResult:
    state: CompanionState = field(default_factory=dict)  # type: ignore[assignment]
    reply: str = ""


def _token_text(chunk: AIMessageChunk) -> str:
    content: Any = chunk.content
    if isinstance(content, str):
        return content
    return "".join(p.get("text", "") for p in content if isinstance(p, dict))


def stream_reply(agent: CompanionAgent, state: CompanionState,
                 result: StreamResult) -> Iterator[dict[str, Any]]:
    """Yield SSE-ready events; fills `result` with the final state and visible reply."""
    gate = SentenceGate()
    final: dict[str, Any] = dict(state)
    for mode, chunk in agent.graph.stream(state, stream_mode=["updates", "messages"]):
        if mode == "messages":
            msg, meta = chunk
            if meta.get("langgraph_node") == "generate" and isinstance(msg, AIMessageChunk):
                text = gate.feed(_token_text(msg))
                if text:
                    yield {"event": "token", "data": {"text": text}}
            continue
        for node, update in chunk.items():
            final.update(update or {})
            if node == "classify":
                yield {"event": "meta", "data": {"route": update["route"].value,
                                                 "label": update["label"].value}}
            elif node == "retrieve":
                yield {"event": "sources", "data": {"sources": update["sources"]}}

    route = final["route"]
    if route == Route.ANSWER and not gate.violated:
        tail = gate.finish()
        if tail:
            yield {"event": "token", "data": {"text": tail}}
    if gate.violated or (route == Route.REFUSE and final["label"] == ScopeLabel.IN_SCOPE):
        if route != Route.REFUSE:  # gate caught it first; graph check_output didn't run a refusal
            final.update(reply=refusal(FALLBACK_ACK))
        final.update(route=Route.REFUSE, sources=[])
        yield {"event": "replace", "data": {"text": final["reply"]}}
    elif route != Route.ANSWER:
        yield {"event": "token", "data": {"text": final["reply"]}}
    result.state = final  # type: ignore[assignment]
    result.reply = final["reply"]
