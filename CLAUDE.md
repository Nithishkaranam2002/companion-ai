# CompanionAI

## What this is
An LLM-powered wellness companion that gives supportive, grounded conversation
with cited sources. It is NOT a medical provider. It must hold the non-medical
line, refuse diagnosis/dosing/treatment advice, and escalate to a human when
needed (crisis, self-harm, medical emergency, explicit request).

## Stack
- Python 3.11, uv for deps, FastAPI backend, Streamlit UI
- LangChain + LangGraph for orchestration
- RAG: ChromaDB + OpenAI or Anthropic embeddings, curated wellness docs in /data/kb
- MCP: a small MCP server exposing tools (kb_search, mood_log, escalate_to_human)
- Guardrails: scope classifier, refusal policy, escalation node, PII/PHI redaction (Microsoft Presidio)
- Evals: LangSmith (tracing + datasets), RAGAS (RAG quality), DeepEval (safety, tone, custom G-Eval metrics)
- pytest for tests

## Folder layout
src/companion/  (graph.py, prompts.py, rag.py, guardrails/, tools/, mcp_server/)
src/api/        (FastAPI app)
ui/             (Streamlit)
evals/          (datasets/, metrics/, run_evals.py, reports/)
data/kb/        (knowledge base docs)
tests/

## Rules
- Keep secrets in .env, never commit them. Provide .env.example.
- Every feature gets pytest tests.
- Never log raw user health data; redact before logging/tracing.
- Keep functions small and typed. Update README when adding features.
