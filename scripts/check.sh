#!/usr/bin/env bash
# Full pre-commit gate: fails fast on any error. Usage: scripts/check.sh
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== python: ruff + pytest"
uv run ruff check .
uv run --all-groups --exact --frozen pytest -q  # same packages as CI: no leftovers
echo "== web: lint + typecheck + build"
(cd web && npm run lint && npm run typecheck && npm run build >/dev/null)
echo "== secret scan of files to be committed"
if git add -A --dry-run | sed "s/^add '//; s/'$//" | grep -v '^scripts/check.sh$' | xargs grep -lIE \
  'sk-proj-|sk-[A-Za-z0-9]{20,}|eyJhbGciOi[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|sb_secret_|postgres(ql)?://[^ ]*:[^ @]+@' 2>/dev/null; then
  echo "secret-like value found in files above"; exit 1
fi
if git add -A --dry-run | grep -v "\.env\.example'$" | grep -E "(^|/)\.env(\.|'|$)|/\.next/|test-results|playwright-report"; then
  echo "generated or secret files would be committed"; exit 1
fi
echo "ALL CHECKS PASSED"
