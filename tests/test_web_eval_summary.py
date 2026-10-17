import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_web_eval_summary_matches_evals() -> None:
    """The safety page must show the real latest scores: run `npm run sync:evals` in web/."""
    source = json.loads((ROOT / "evals" / "results" / "summary.json").read_text())
    copy = json.loads((ROOT / "web" / "src" / "data" / "eval-summary.json").read_text())
    assert copy == source
