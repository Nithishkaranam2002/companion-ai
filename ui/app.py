"""Streamlit UI. Run: uv run --group ui streamlit run ui/app.py"""

import os
import uuid

import httpx
import streamlit as st

API_URL = os.getenv("API_URL", "http://localhost:8000")

st.set_page_config(page_title="CompanionAI", page_icon="🌿")
st.title("CompanionAI")
st.caption("A supportive wellness companion. Not a medical provider. "
           "In an emergency, call your local emergency number (US: 911, crisis line: 988).")

if "session_id" not in st.session_state:
    st.session_state.session_id = uuid.uuid4().hex
    st.session_state.history = []

with st.sidebar:
    st.subheader("Mood check-in")
    score = st.slider("How are you feeling?", 1, 10, 5)
    note = st.text_input("Note (optional)")
    if st.button("Log mood"):
        httpx.post(f"{API_URL}/mood", json={"user_id": st.session_state.session_id,
                                            "score": score, "note": note}, timeout=10)
        st.success("Logged")

for turn in st.session_state.history:
    with st.chat_message(turn["role"]):
        st.markdown(turn["content"])

if prompt := st.chat_input("What's on your mind?"):
    with st.chat_message("user"):
        st.markdown(prompt)
    resp = httpx.post(f"{API_URL}/chat", timeout=60, json={
        "session_id": st.session_state.session_id,
        "message": prompt,
        "history": st.session_state.history,
    }).json()
    with st.chat_message("assistant"):
        st.markdown(resp["reply"])
        if resp["escalated"]:
            st.warning("A human on our team has been notified.")
        if resp["sources"]:
            st.markdown("**Sources**\n" + "\n".join(f"- [{s['title']}]({s['url']})"
                                                    for s in resp["sources"]))
    st.session_state.history += [{"role": "user", "content": prompt},
                                 {"role": "assistant", "content": resp["reply"]}]
