"""Streamlit dev console: the full guardrail graph in-process, no API or login needed.

Run: uv run --group ui streamlit run ui/app.py
Tickets and moods go to an in-memory store, so local testing never touches the production queue.
The production web app lives in web/ and talks to the FastAPI service.
"""

import uuid

import streamlit as st

from companion.config import get_settings, require_provider_keys
from companion.db.store import InMemoryStore, Store
from companion.graph import (
    CompanionAgent,
    CompanionState,
    build_graph,
    make_ack,
    make_classifier,
    make_llm,
)
from companion.rag import KnowledgeBase
from companion.tools.mood import log_mood

DEV_USER = "streamlit-dev"


@st.cache_resource
def store() -> Store:
    return InMemoryStore()


@st.cache_resource
def agent() -> CompanionAgent:
    settings = get_settings()
    require_provider_keys(settings)
    kb = KnowledgeBase.from_settings(settings)
    kb.ingest(settings.kb_dir)  # only new or edited chunks are embedded

    def escalate(state: CompanionState, reason: str, summary: str) -> str:
        return store().create_escalation(None, None, reason, summary).id

    model = (settings.llm_provider, settings.llm_model)
    return CompanionAgent(build_graph(make_llm(*model), kb, escalate, make_classifier(*model),
                                      make_ack(*model)))


st.set_page_config(page_title="CompanionAI console", page_icon="🌿")
st.title("CompanionAI")
st.caption("Not a medical service. In crisis, call or text 988.")

if "session_id" not in st.session_state:
    st.session_state.session_id = uuid.uuid4().hex
    st.session_state.history = []

with st.sidebar:
    st.subheader("Mood check-in")
    score = st.slider("How are you feeling?", 1, 10, 5)
    note = st.text_input("Note (optional)")
    if st.button("Log mood"):
        entry = log_mood(store(), DEV_USER, score, note)
        st.success(f"Logged {entry.score}/10" + (f": {entry.note}" if entry.note else ""))

for turn in st.session_state.history:
    with st.chat_message(turn["role"]):
        st.markdown(turn["content"])

if prompt := st.chat_input("What's on your mind?"):
    with st.chat_message("user"):
        st.markdown(prompt)
    with st.spinner("Thinking…"):
        result = agent().respond(st.session_state.session_id, prompt, st.session_state.history)
    with st.chat_message("assistant"):
        st.markdown(result["reply"])
        st.caption(f"route: {result['route'].value} · label: {result['label'].value}")
        if result.get("ticket_id"):
            st.warning("A human on our team has been notified.")
        if result.get("sources"):
            st.markdown("**Sources**\n" + "\n".join(
                f"{i}. [{s['title']}]({s['url']})" for i, s in enumerate(result["sources"], 1)))
    # History holds the redacted message, matching what the API stores.
    st.session_state.history += [{"role": "user", "content": result["message"]},
                                 {"role": "assistant", "content": result["reply"]}]
