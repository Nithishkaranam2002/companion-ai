"""LangGraph orchestration: classify -> (escalate | refuse | retrieve -> generate -> check).

Callers must pass already-redacted text (see `CompanionAgent.respond`), so nothing
raw ever enters graph state or LangSmith traces.
"""

from dataclasses import asdict
from pathlib import Path
from typing import TypedDict

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from companion.guardrails.llm_classifier import (
    Classifier,
    make_llm_classifier,
    most_severe,
    safe_classify,
)
from companion.guardrails.output_check import violates_medical_line
from companion.guardrails.policy import RESPONSES, Route, route_for
from companion.guardrails.redaction import redact
from companion.guardrails.scope import ScopeLabel, classify_scope
from companion.prompts import ANSWER_TEMPLATE, SYSTEM_PROMPT
from companion.rag import KnowledgeBase, Source, format_context
from companion.tools.escalation import escalate_to_human


class Turn(TypedDict):
    role: str  # "user" | "assistant"
    content: str


class CompanionState(TypedDict, total=False):
    session_id: str
    message: str
    history: list[Turn]
    label: ScopeLabel
    route: Route
    sources: list[dict[str, str]]
    reply: str
    ticket_id: str | None


def _to_messages(history: list[Turn]) -> list[BaseMessage]:
    return [HumanMessage(t["content"]) if t["role"] == "user" else AIMessage(t["content"])
            for t in history]


def build_graph(llm: BaseChatModel, kb: KnowledgeBase, data_dir: Path,
                classifier: Classifier | None = None) -> CompiledStateGraph:
    """`classifier` is the optional LLM safety layer; without it routing is regex-only."""

    def classify(state: CompanionState) -> CompanionState:
        label = classify_scope(state["message"])
        if classifier is not None:
            label = most_severe(label, safe_classify(classifier, state["message"], label))
        return {"label": label, "route": route_for(label)}

    def escalate(state: CompanionState) -> CompanionState:
        ticket = escalate_to_human(data_dir, state["session_id"], state["label"].value,
                                   state["message"])
        return {"reply": RESPONSES[state["label"]], "ticket_id": ticket.ticket_id, "sources": []}

    def refuse(state: CompanionState) -> CompanionState:
        return {"reply": RESPONSES[state["label"]], "sources": []}

    def retrieve(state: CompanionState) -> CompanionState:
        return {"sources": [asdict(s) for s in kb.search(state["message"])]}

    def generate(state: CompanionState) -> CompanionState:
        context = format_context([Source(**s) for s in state["sources"]])
        prompt = ANSWER_TEMPLATE.format(context=context, message=state["message"])
        messages = [SystemMessage(SYSTEM_PROMPT), *_to_messages(state.get("history", [])),
                    HumanMessage(prompt)]
        return {"reply": str(llm.invoke(messages).content)}

    def check_output(state: CompanionState) -> CompanionState:
        if violates_medical_line(state["reply"]):
            return {"reply": RESPONSES[ScopeLabel.MEDICAL_ADVICE], "route": Route.REFUSE,
                    "sources": []}
        return {}

    graph = StateGraph(CompanionState)
    graph.add_node("classify", classify)
    graph.add_node("escalate", escalate)
    graph.add_node("refuse", refuse)
    graph.add_node("retrieve", retrieve)
    graph.add_node("generate", generate)
    graph.add_node("check_output", check_output)

    graph.add_edge(START, "classify")
    graph.add_conditional_edges("classify", lambda s: s["route"].value, {
        Route.ESCALATE.value: "escalate",
        Route.REFUSE.value: "refuse",
        Route.ANSWER.value: "retrieve",
    })
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", "check_output")
    for terminal in ("escalate", "refuse", "check_output"):
        graph.add_edge(terminal, END)
    return graph.compile()


class CompanionAgent:
    """Entry point: redacts input, then runs the graph."""

    def __init__(self, graph: CompiledStateGraph) -> None:
        self.graph = graph

    def respond(self, session_id: str, message: str,
                history: list[Turn] | None = None) -> CompanionState:
        safe_history: list[Turn] = [{"role": t["role"], "content": redact(t["content"])}
                                    for t in history or []]
        return self.graph.invoke({
            "session_id": session_id,
            "message": redact(message),
            "history": safe_history,
            "ticket_id": None,
        })


def make_llm(provider: str, model: str, temperature: float = 0.3) -> BaseChatModel:
    from langchain.chat_models import init_chat_model

    return init_chat_model(model, model_provider=provider, temperature=temperature)


def make_classifier(provider: str, model: str) -> Classifier:
    return make_llm_classifier(make_llm(provider, model, temperature=0.0))
