"""MCP server exposing kb_search, mood_log, and escalate_to_human.

Run: uv run python -m companion.mcp_server.server
"""

from dataclasses import asdict

from mcp.server.mcpserver import MCPServer

from companion.config import get_settings
from companion.rag import KnowledgeBase
from companion.tools.escalation import escalate_to_human as _escalate
from companion.tools.mood import log_mood

mcp = MCPServer(
    name="companion-ai",
    instructions="Wellness tools. Not for diagnosis, dosing, or treatment advice.",
)


@mcp.tool()
def kb_search(query: str, k: int = 4) -> list[dict[str, str]]:
    """Search the curated wellness knowledge base. Returns title, url, and snippet."""
    return [asdict(s) for s in KnowledgeBase.from_settings().search(query, k=k)]


@mcp.tool()
def mood_log(user_id: str, score: int, note: str = "") -> dict[str, object]:
    """Log a mood score (1-10) with an optional note. The note is PII-redacted before storage."""
    return log_mood(get_settings().data_dir, user_id, score, note).model_dump()


@mcp.tool()
def escalate_to_human(session_id: str, reason: str, summary: str) -> dict[str, object]:
    """Hand the conversation to a human reviewer. Reason: crisis | medical_emergency | human_request."""
    return _escalate(get_settings().data_dir, session_id, reason, summary).model_dump()


if __name__ == "__main__":
    mcp.run()
