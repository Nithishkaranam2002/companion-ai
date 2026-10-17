"""Run CompanionAI evals.

  uv run --group evals python -m evals.run_evals --suite routing      # offline, no keys
  uv run --group evals python -m evals.run_evals --suite safety       # DeepEval G-Eval (judge LLM)
  uv run --group evals python -m evals.run_evals --suite rag          # RAGAS (LLM + embeddings)
  uv run --group evals python -m evals.run_evals --suite all --langsmith
"""

import argparse
import json
import os
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from langchain_core.language_models import FakeListChatModel

from companion.config import get_settings
from companion.db.store import InMemoryStore
from companion.graph import CompanionAgent, build_graph, make_classifier, make_llm
from companion.rag import KnowledgeBase
from evals.metrics.routing import RoutingReport

DEFAULT_JUDGE = "gpt-5.4"  # different from the app model, to avoid self-grading bias
DATASETS = Path(__file__).parent / "datasets"
REPORTS = Path(__file__).parent / "reports"
SUMMARY = Path(__file__).parent / "results" / "summary.json"


def load_jsonl(name: str) -> list[dict[str, str]]:
    lines = (DATASETS / name).read_text(encoding="utf-8").splitlines()
    return [json.loads(line) for line in lines if line.strip()]


def eval_escalate() -> Any:
    """In-memory sink so eval runs never write tickets into the real escalation queue."""
    store = InMemoryStore()
    return lambda state, reason, summary: store.create_escalation(None, None, reason, summary).id


def real_agent() -> CompanionAgent:
    s = get_settings()
    return CompanionAgent(build_graph(make_llm(s.llm_provider, s.llm_model),
                                      KnowledgeBase.from_settings(s), eval_escalate(),
                                      make_classifier(s.llm_provider, s.llm_model)))


def run_routing(agent: CompanionAgent, layers: frozenset[str] = frozenset({"regex", "llm"})
                ) -> dict[str, Any]:
    """Route accuracy. Offline (regex-only) runs should pass layers={"regex"}."""
    report = RoutingReport()
    for i, row in enumerate(load_jsonl("safety.jsonl")):
        if row.get("layer", "regex") not in layers:
            continue
        state = agent.respond(f"eval-routing-{i}", row["input"], row.get("history"))
        report.add(row["category"], row["expected_route"], state["route"].value, row["input"])
    return report.to_dict()


def summarize(test_results: list[Any]) -> dict[str, dict[str, float]]:
    """Mean score and pass rate per metric across DeepEval test results."""
    scores: dict[str, list[tuple[float, bool]]] = {}
    for t in test_results:
        for m in t.metrics_data or []:
            scores.setdefault(m.name, []).append((m.score or 0.0, bool(m.success)))
    return {name: {"mean": round(sum(v for v, _ in vals) / len(vals), 3),
                   "pass_rate": round(sum(ok for _, ok in vals) / len(vals), 3),
                   "n": len(vals)}
            for name, vals in scores.items()}


def run_safety(agent: CompanionAgent, judge: str) -> dict[str, Any]:
    from deepeval import evaluate
    from deepeval.evaluate.configs import DisplayConfig
    from deepeval.test_case import LLMTestCase

    from evals.metrics.geval import all_metrics, grounded_citations

    cases, grounded = [], []
    for i, r in enumerate(load_jsonl("safety.jsonl")):
        state = agent.respond(f"eval-safety-{i}", r["input"], r.get("history"))
        cases.append(LLMTestCase(input=r["input"], actual_output=state["reply"]))
        if state.get("sources"):
            grounded.append(LLMTestCase(input=r["input"], actual_output=state["reply"],
                                        retrieval_context=[s["snippet"] for s in state["sources"]]))
    quiet = DisplayConfig(print_results=False, show_indicator=False)
    results = evaluate(test_cases=cases, metrics=all_metrics(judge), display_config=quiet).test_results
    if grounded:
        results += evaluate(test_cases=grounded, metrics=[grounded_citations(judge)],
                            display_config=quiet).test_results
    failures = [{"input": t.input, "metric": m.name, "score": m.score, "reason": m.reason}
                for t in results for m in t.metrics_data or [] if not m.success]
    return {"summary": summarize(results), "failures": failures}


def run_rag(agent: CompanionAgent, judge: str) -> dict[str, Any]:
    from evals.metrics import ragas_compat

    ragas_compat.install()
    from ragas import EvaluationDataset, evaluate
    from ragas.embeddings import LangchainEmbeddingsWrapper
    from ragas.llms import LangchainLLMWrapper
    from ragas.metrics import Faithfulness, LLMContextRecall, ResponseRelevancy

    from companion.rag import make_embeddings

    s = get_settings()
    samples = []
    for i, row in enumerate(load_jsonl("rag.jsonl")):
        state = agent.respond(f"eval-rag-{i}", row["question"])
        samples.append({"user_input": row["question"], "response": state["reply"],
                        "retrieved_contexts": [src["snippet"] for src in state["sources"]],
                        "reference": row["reference"]})
    result = evaluate(
        EvaluationDataset.from_list(samples),
        metrics=[Faithfulness(), ResponseRelevancy(), LLMContextRecall()],
        llm=LangchainLLMWrapper(make_llm(s.llm_provider, judge, temperature=0.0)),
        embeddings=LangchainEmbeddingsWrapper(make_embeddings(s)),
    )
    frame = result.to_pandas()
    numeric = frame.select_dtypes("number")
    return {"scores": {k: round(v, 3) for k, v in numeric.mean().to_dict().items()},
            "n": len(frame),
            "per_question": frame[["user_input", *numeric.columns]].to_dict("records")}


def upload_langsmith_datasets() -> None:
    from langsmith import Client

    client = Client()
    for name, key in (("safety.jsonl", "input"), ("rag.jsonl", "question")):
        ds_name = f"companion-ai-{name.removesuffix('.jsonl')}"
        if client.has_dataset(dataset_name=ds_name):
            continue
        ds = client.create_dataset(ds_name)
        rows = load_jsonl(name)
        client.create_examples(dataset_id=ds.id, inputs=[{key: r[key]} for r in rows],
                               outputs=[{k: v for k, v in r.items() if k != key} for r in rows])


def write_summary(report: dict[str, Any], judge: str) -> dict[str, Any]:
    """Aggregate-only scores (no replies or inputs) that are safe to commit and publish."""
    s = get_settings()
    summary: dict[str, Any] = {
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "app_model": s.llm_model, "judge_model": judge,
        "embeddings_model": s.embeddings_model,
    }
    if "routing_live" in report:
        r = report["routing_live"]
        summary["routing"] = {"accuracy": r["accuracy"], "total": r["total"],
                              "by_category": r["by_category"]}
    if "safety" in report:
        summary["deepeval"] = {k.removesuffix(" [GEval]"): v
                               for k, v in report["safety"]["summary"].items()}
    if "rag" in report:
        summary["ragas"] = {**report["rag"]["scores"], "n": report["rag"]["n"]}
    SUMMARY.parent.mkdir(exist_ok=True)
    SUMMARY.write_text(json.dumps(summary, indent=2) + "\n")
    return summary


def offline_agent() -> CompanionAgent:
    """Real guardrails + KB, stub LLM: routing doesn't depend on generation."""
    s = get_settings()
    stub = FakeListChatModel(responses=["(stub reply) [1]"])
    return CompanionAgent(build_graph(stub, KnowledgeBase.from_settings(s), eval_escalate()))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--suite", choices=["routing", "routing_live", "safety", "rag", "all"], default="routing")
    parser.add_argument("--judge", default=DEFAULT_JUDGE, help="Judge model for DeepEval and RAGAS")
    parser.add_argument("--langsmith", action="store_true", help="Upload datasets to LangSmith")
    args = parser.parse_args()
    get_settings()  # loads .env into os.environ before DeepEval/RAGAS read keys
    os.environ.setdefault("DEEPEVAL_TELEMETRY_OPT_OUT", "YES")

    if args.langsmith:
        upload_langsmith_datasets()
    suites: dict[str, Callable[[], dict[str, Any]]] = {
        "routing": lambda: run_routing(offline_agent(), frozenset({"regex"})),
        "routing_live": lambda: run_routing(real_agent()),
        "safety": lambda: run_safety(real_agent(), args.judge),
        "rag": lambda: run_rag(real_agent(), args.judge),
    }
    selected = ["routing_live", "safety", "rag"] if args.suite == "all" else [args.suite]
    report = {name: suites[name]() for name in selected}

    if args.suite in ("all", "routing_live", "safety", "rag"):
        write_summary(report, args.judge)
    REPORTS.mkdir(exist_ok=True)
    out = REPORTS / f"eval-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}.json"
    out.write_text(json.dumps(report, indent=2, default=str))
    print(json.dumps(report, indent=2, default=str))
    print(f"\nReport written to {out}")


if __name__ == "__main__":
    main()
