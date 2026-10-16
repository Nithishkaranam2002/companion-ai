import asyncio

from companion.mcp_server.server import mcp


def test_mcp_exposes_expected_tools() -> None:
    tools = asyncio.run(mcp.list_tools())
    assert {t.name for t in tools} == {"kb_search", "mood_log", "escalate_to_human"}
