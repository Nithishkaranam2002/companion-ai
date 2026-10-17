# CompanionAI API (FastAPI). Built and run by Render; see render.yaml.
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    MALLOC_ARENA_MAX=2

COPY --from=ghcr.io/astral-sh/uv:0.7.22 /uv /usr/local/bin/uv
WORKDIR /app

# Dependencies first for layer caching (production deps only).
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src ./src
COPY data ./data
COPY evals/results ./evals/results
RUN uv sync --frozen --no-dev

RUN useradd --create-home --uid 10001 app && chown -R app /app
USER app

ENV PATH="/app/.venv/bin:$PATH" \
    CHROMA_DIR=/tmp/chroma \
    PORT=8000
EXPOSE 8000

# One worker keeps memory under the 512 MB free-tier limit.
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT} --workers 1 --proxy-headers --forwarded-allow-ips='*'"]
