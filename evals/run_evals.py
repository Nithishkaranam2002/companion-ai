"""Run CompanionAI evals.

  uv run --group evals python -m evals.run_evals --suite routing      # offline, no keys
  uv run --group evals python -m evals.run_evals --suite safety       # DeepEval G-Eval (judge LLM)
  uv run --group evals python -m evals.run_evals --suite rag          # RAGAS (LLM + embeddings)
  uv run --group evals python -m evals.run_evals --suite all --langsmith
"""

import argparse
import json
import tempfile
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from langchain_core.language_models import FakeListChatModel

from companion.config import get_settings
from companion.graph import CompanionAgent, build_graph, make_llm
from companion.rag import KnowledgeBase
from evals.metrics.routing import RoutingReport

DATASETS = Path(__file__).parent / "datasets"
REPORTS = Path(__file__).parent / "reports"


def load_jsonl(name: str) -> list[dict[str, str]]:
    lines = (DATASETS / name).read_text(encoding="utf-8").splitlines()
    return [json.loads(line) for line in lines if line.strip()]


def eval_data_dir() -> Path:
    """Scratch dir so eval runs never write tickets into the real escalation queue."""
    return Path(tempfile.mkdtemp(prefix="companion-eval-"))


def real_agent() -> CompanionAgent:
    s = get_settings()
    return CompanionAgent(build_graph(make_llm(s.llm_provider, s.llm_model),
                                      KnowledgeBase.from_settings(s), eval_data_dir()))


def run_routing(agent: CompanionAgent) -> dict[str, Any]:
    report = RoutingReport()
    for i, row in enumerate(load_jsonl("safety.jsonl")):
        state = agent.respond(f"eval-routing-{i}", row["input"])
        report.add(row["category"], row["expected_route"], state["route"].value, row["input"])
    return report.to_dict()


def run_safety(agent: CompanionAgent, judge: str | None) -> dict[str, Any]:
    from deepeval import evaluate
    from deepeval.test_case import LLMTestCase

    from evals.metrics.geval import all_metrics

    cases = [LLMTestCase(input=r["input"],
                         actual_output=agent.respond(f"eval-safety-{i}", r["input"])["reply"])
             for i, r in enumerate(load_jsonl("safety.jsonl"))]
    result = evaluate(test_cases=cases, metrics=all_metrics(judge))
    return {"cases": [{"input": t.input, "success": t.success,
                       "metrics": {m.name: m.score for m in t.metrics_data or []}}
                      for t in result.test_results]}


def run_rag(agent: CompanionAgent) -> dict[str, Any]:
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
        llm=LangchainLLMWrapper(make_llm(s.llm_provider, s.llm_model)),
        embeddings=LangchainEmbeddingsWrapper(make_embeddings(s)),
    )
    return {"scores": result.to_pandas().select_dtypes("number").mean().to_dict()}


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


def offline_agent() -> CompanionAgent:
    """Real guardrails + KB, stub LLM: routing doesn't depend on generation."""
    s = get_settings()
    stub = FakeListChatModel(responses=["(stub reply) [1]"])
    return CompanionAgent(build_graph(stub, KnowledgeBase.from_settings(s), eval_data_dir()))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--suite", choices=["routing", "safety", "rag", "all"], default="routing")
    parser.add_argument("--judge", default=None, help="DeepEval judge model (default: DeepEval's)")
    parser.add_argument("--langsmith", action="store_true", help="Upload datasets to LangSmith")
    args = parser.parse_args()

    if args.langsmith:
        upload_langsmith_datasets()
    suites: dict[str, Callable[[], dict[str, Any]]] = {
        "routing": lambda: run_routing(offline_agent()),
        "safety": lambda: run_safety(real_agent(), args.judge),
        "rag": lambda: run_rag(real_agent()),
    }
    selected = list(suites) if args.suite == "all" else [args.suite]
    report = {name: suites[name]() for name in selected}

    REPORTS.mkdir(exist_ok=True)
    out = REPORTS / f"eval-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}.json"
    out.write_text(json.dumps(report, indent=2, default=str))
    print(json.dumps(report, indent=2, default=str))
    print(f"\nReport written to {out}")


if __name__ == "__main__":
    main()
