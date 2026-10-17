# CompanionAI

A supportive, LLM-powered wellness companion that grounds its answers in cited sources.
**It is not a medical provider.** It refuses diagnosis, dosing, and treatment questions, and
hands off to a human for crises, self-harm, medical emergencies, or when someone asks.

## How a message flows

```
user text ──► redact (Presidio + regex) ──► classify scope (regex + LLM, most severe wins)
                                              ├─ crisis / emergency / human request ─► escalate (ticket + resources)
                                              ├─ diagnosis / dosing / treatment ─────► refuse (fixed policy text)
                                              └─ in scope ─► retrieve (Chroma) ─► generate (LLM, cites [n]) ─► output check
```

- **Redaction happens before the graph runs**, so raw PII never enters graph state, logs, or LangSmith traces.
- Routing is **two-layer**: a deterministic regex classifier plus an LLM safety classifier
  (`guardrails/llm_classifier.py`). The more severe label wins, so the LLM can escalate a
  paraphrase the regex misses ("I don't see the point anymore") but can never downgrade a regex hit.
  If the LLM call fails, routing falls back to the regex label.
  Precedence: crisis > medical emergency > human request > medical advice.
- **Output check**: if a reply mentions doses, diagnoses, or medication changes, the refusal text replaces it.
- Escalation replies are fixed text. Refusals are fixed text after a short, validated empathetic
  acknowledgment (see Eval results).

## Setup

```bash
uv sync --group dev            # core + tests (includes spaCy en_core_web_sm for Presidio)
cp .env.example .env           # add OPENAI_API_KEY (OpenAI is the default LLM + embeddings)
uv run python -m companion.ingest   # index data/kb into ChromaDB
```

Anthropic is supported as an optional LLM (`LLM_PROVIDER=anthropic`, needs `ANTHROPIC_API_KEY`).
The app exits with a clear error at startup if the selected provider's key is missing.
Set `EMBEDDINGS_PROVIDER=hash` for offline development (it doesn't retrieve meaningfully, so don't use it in production).

## Database (Supabase)

Provisioned through the Vercel Marketplace (Supabase integration). The API connects with
`POSTGRES_URL` (pooled) and verifies Supabase logins with `SUPABASE_URL` (ES256 signing keys via
the project's public key endpoint) or `SUPABASE_JWT_SECRET` (older HS256 projects).

```bash
uv run python -m companion.db.migrate           # applies supabase/migrations/*.sql
TEST_DATABASE_URL=... uv run pytest tests/test_store.py   # store contract tests against Postgres
```

Row-level security is on for every table. Signed-in users can read only their own
conversations, messages and moods. Escalations and usage events have no client access at all.
All writes go through the API, which redacts first. Verified: with the public anon key, every
table reads as 0 rows and inserts are refused.

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

## Eval results

App model `gpt-5.5`, judge `gpt-5.4` (a different model, to avoid self-grading), embeddings
`text-embedding-3-small`. Datasets: 40 safety conversations, 20 RAG questions. Both runs used the
same datasets, metrics, and judge. Aggregate scores are in
[`evals/results/summary.json`](evals/results/summary.json).

**Before** = baseline (2026-10-16). **After** = warmer refusals + strict source grounding (2026-10-17).

| Metric | Before | After |
|---|---|---|
| Safety routing, live two-layer classifier (40) | 100% | **100%** |
| DeepEval: non-medical boundary (mean / pass) | 0.998 / 100% | **1.000 / 100%** |
| DeepEval: crisis handling | 0.965 / 97.5% | 0.960 / 95.0% |
| DeepEval: empathetic tone | 0.843 / 87.5% | **0.892 / 95.0%** |
| DeepEval: grounded citations (14 answered) | 0.859 / 100% | **0.942 / 100%** |
| RAGAS: faithfulness | 0.765 | **0.883** |
| RAGAS: answer relevancy | 0.815 | **0.849** |
| RAGAS: context recall | 0.900 | 0.900 |

**What changed**
- **Warmer refusals** (`guardrails/empathy.py`): the LLM writes only a 1–2 sentence
  acknowledgment of the person's feelings. It's rejected, and a fixed warm opener used instead, if
  it is too long, asks a question, contains advice words (try, should, recommend…), mentions
  anything medical, or fails the reply check. The refusal itself is still fixed text. In testing,
  9 of 10 real acknowledgments passed.
- **Strict grounding** (`prompts.py`): every tip, fact, or number must come from a cited source,
  with no tips from general knowledge. When the sources don't cover something, the reply says so.

**How to read the remaining failures**
- Crisis-handling dip (1 → 2 failures): the judge marked down the melatonin and ibuprofen
  refusals as "overcautious" for not giving general dosing guidance. That's the judge disagreeing
  with the product rule, not a safety regression. Next step: tell the metric that refusing
  dosing questions is correct.
- The one tone failure left is the medical-emergency reply, marked down for directive language
  ("call emergency services now"). Directness is intended in an emergency.
- One RAG question ("my friend… seems at risk") is escalated as a crisis, so it never reaches
  retrieval and scores 0. Questions about helping *someone else* who may be at risk get the
  crisis reply, which is written for the user themselves.

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
