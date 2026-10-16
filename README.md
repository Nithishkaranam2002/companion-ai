# CompanionAI

A supportive, LLM-powered wellness companion that grounds its answers in cited sources.
**It is not a medical provider.** It refuses diagnosis, dosing, and treatment questions, and
hands off to a human for crises, self-harm, medical emergencies, or when someone asks.

## How a message flows

```
user text ──► redact (Presidio + regex) ──► classify scope
                                              ├─ crisis / emergency / human request ─► escalate (ticket + resources)
                                              ├─ diagnosis / dosing / treatment ─────► refuse (fixed policy text)
                                              └─ in scope ─► retrieve (Chroma) ─► generate (LLM, cites [n]) ─► output check
```

- **Redaction happens before the graph runs**, so raw PII never enters graph state, logs, or LangSmith traces.
- Routing is **rule-based on purpose**: safety routing has to be deterministic and testable.
  Precedence: crisis > medical emergency > human request > medical advice.
- **Output check**: if a reply mentions doses, diagnoses, or medication changes, the refusal text replaces it.
- Escalation and refusal replies are fixed text and never come from the LLM.

## Setup

```bash
uv sync --group dev            # core + tests (includes spaCy en_core_web_sm for Presidio)
cp .env.example .env           # add OPENAI_API_KEY (OpenAI is the default LLM + embeddings)
uv run python -m companion.ingest   # index data/kb into ChromaDB
```

Anthropic is supported as an optional LLM (`LLM_PROVIDER=anthropic`, needs `ANTHROPIC_API_KEY`).
The app exits with a clear error at startup if the selected provider's key is missing.
Set `EMBEDDINGS_PROVIDER=hash` for offline development (it doesn't retrieve meaningfully, so don't use it in production).

## Run

```bash
uv run uvicorn api.main:app --reload                 # API on :8000
uv run --group ui streamlit run ui/app.py            # UI
uv run python -m companion.mcp_server.server         # MCP server (stdio)
```

### API
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness |
| POST | `/chat` | `{session_id, message, history[]}` → `{reply, route, label, sources[], escalated}` |
| POST | `/mood` | `{user_id, score 1-10, note}`; the note is redacted before storage |
| GET | `/mood/{user_id}` | Recent mood entries |

### MCP tools
`kb_search(query, k)`, `mood_log(user_id, score, note)`, `escalate_to_human(session_id, reason, summary)`.
Built on MCP Python SDK 2.x (`MCPServer`).

Escalation tickets are appended to `$DATA_DIR/escalations.jsonl` (crisis and emergency tickets are flagged `urgent`).
Before production, connect this to a real on-call or paging channel.

## Knowledge base
Curated Markdown files in `data/kb/`, each with front matter (`title`, `source`, `url`) used for citations.
To add a doc, drop a file in that folder and rerun ingest. Ingest is idempotent (content-hashed IDs).

## Tests & evals

```bash
uv run pytest                                                    # offline; fake LLM + in-memory Chroma
uv run --group evals python -m evals.run_evals --suite routing   # offline guardrail routing accuracy
uv run --group evals python -m evals.run_evals --suite safety    # DeepEval G-Eval: boundary, crisis, tone
uv run --group evals python -m evals.run_evals --suite rag       # RAGAS: faithfulness, relevancy, recall
uv run --group evals python -m evals.run_evals --suite all --langsmith   # also upload datasets to LangSmith
```

- Datasets: `evals/datasets/safety.jsonl` (labeled routes) and `rag.jsonl` (question + reference).
- Custom G-Eval metrics live in `evals/metrics/geval.py`. DeepEval uses its default judge model unless you pass `--judge`.
- Reports go to `evals/reports/` (gitignored). Eval runs write escalation tickets to a temp dir, never to the real queue.
- The routing suite also runs inside pytest as a regression gate and must stay at 100%.
- `evals/metrics/ragas_compat.py` is a shim for RAGAS 0.4.3's stale `langchain_community` VertexAI import. Remove it once RAGAS fixes that import.

## Layout
```
src/companion/   graph.py, prompts.py, rag.py, ingest.py, config.py
  guardrails/    scope.py, policy.py, redaction.py, output_check.py
  tools/         mood.py, escalation.py
  mcp_server/    server.py
src/api/         FastAPI app
ui/              Streamlit
evals/           datasets/, metrics/, run_evals.py, reports/
data/kb/         knowledge base
tests/
```
