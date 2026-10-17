"use client";

import { Leaf, PanelLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppTopbar } from "@/components/app/app-topbar";
import { Composer } from "@/components/chat/composer";
import { ConversationSidebar, type Conversation } from "@/components/chat/conversation-sidebar";
import { CrisisBanner } from "@/components/chat/crisis-banner";
import { MessageBubble, TypingIndicator } from "@/components/chat/message-bubble";
import { CRISIS_LABELS, type ChatMessage } from "@/components/chat/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/use-me";
import { apiFetch, ApiError, streamChat, type Source } from "@/lib/api";

type ApiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  route: ChatMessage["route"];
  label: string | null;
  sources: Source[];
};

type Notice = { title: string; body: string; signup?: boolean };

const suggestions = [
  "I can't switch off at night. Any ideas?",
  "Work has been really stressful lately.",
  "I feel a bit lonely since moving.",
  "How do I start journaling?",
];

let localId = 0;
const tempId = () => `local-${++localId}`;

export function ChatApp() {
  const params = useParams<{ id?: string[] }>();
  const routeId = params.id?.[0] ?? null;
  const router = useRouter();
  const { me, setRemaining } = useMe();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(routeId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(Boolean(routeId));
  const [streaming, setStreaming] = useState(false);
  const [waitingFirstToken, setWaitingFirstToken] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [createdHere, setCreatedHere] = useState<string | null>(null);
  const [prevRouteId, setPrevRouteId] = useState(routeId);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset per-conversation UI when the URL changes (render-phase reset, no effect needed).
  if (routeId !== prevRouteId) {
    setPrevRouteId(routeId);
    setActiveId(routeId);
    setNotice(null);
    setBannerDismissed(false);
    if (!routeId) setMessages([]);
    setMessagesLoading(Boolean(routeId) && routeId !== createdHere);
  }

  const loadConversations = useCallback(
    () =>
      apiFetch<Conversation[]>("/conversations")
        .then(setConversations)
        .catch((e) => toast.error(e instanceof ApiError ? e.message : "Couldn't load your conversations."))
        .finally(() => setListLoading(false)),
    [],
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // Fetch messages when the URL points at a conversation we didn't just create in this view.
  useEffect(() => {
    if (!routeId || routeId === createdHere) return;
    let cancelled = false;
    apiFetch<ApiMessage[]>(`/conversations/${routeId}/messages`)
      .then((rows) => {
        if (!cancelled) setMessages(rows.map((m) => ({ ...m, sources: m.sources ?? [] })));
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error(e instanceof ApiError && e.status === 404 ? "That conversation wasn't found." : "Couldn't load messages.");
        router.replace("/chat");
      })
      .finally(() => !cancelled && setMessagesLoading(false));
    return () => {
      cancelled = true;
    };
  }, [routeId, createdHere, router]);

  // Keep the newest message in view while streaming, unless the reader scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom || waitingFirstToken) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, waitingFirstToken]);

  const updateLast = (patch: (m: ChatMessage) => ChatMessage) =>
    setMessages((ms) => (ms.length ? [...ms.slice(0, -1), patch(ms[ms.length - 1])] : ms));

  async function send(text: string) {
    setNotice(null);
    const assistantId = tempId();
    setMessages((ms) => [
      ...ms,
      { id: tempId(), role: "user", content: text, sources: [] },
      { id: assistantId, role: "assistant", content: "", sources: [], streaming: true },
    ]);
    setStreaming(true);
    setWaitingFirstToken(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const ev of streamChat({ message: text, conversation_id: activeId }, controller.signal)) {
        switch (ev.event) {
          case "meta":
            updateLast((m) => ({ ...m, route: ev.data.route, label: ev.data.label }));
            if (ev.data.conversation_id && ev.data.conversation_id !== activeId) {
              setCreatedHere(ev.data.conversation_id);
              setActiveId(ev.data.conversation_id);
              // Show it in the sidebar now; the refresh after the reply brings the server's (redacted) title.
              const created = { id: ev.data.conversation_id, title: text.slice(0, 60), updated_at: new Date().toISOString() };
              setConversations((cs) => [created, ...cs.filter((c) => c.id !== created.id)]);
              window.history.replaceState(null, "", `/chat/${ev.data.conversation_id}`);
            }
            if (ev.data.route === "escalate") setBannerDismissed(false);
            break;
          case "sources":
            updateLast((m) => ({ ...m, sources: ev.data.sources }));
            break;
          case "token":
            setWaitingFirstToken(false);
            updateLast((m) => ({ ...m, content: m.content + ev.data.text }));
            break;
          case "replace":
            setWaitingFirstToken(false);
            updateLast((m) => ({ ...m, content: ev.data.text, route: "refuse", sources: [] }));
            break;
          case "done":
            setRemaining(ev.data.remaining);
            break;
          case "error":
            throw new ApiError(ev.data.message, 500);
        }
      }
      updateLast((m) => ({ ...m, streaming: false }));
      void loadConversations();
    } catch (e) {
      // Drop the empty assistant placeholder; keep what the person wrote.
      setMessages((ms) => {
        const last = ms[ms.length - 1];
        return last?.id === assistantId && !last.content ? ms.slice(0, -1) : ms;
      });
      updateLast((m) => (m.id === assistantId ? { ...m, streaming: false } : m));
      if (e instanceof ApiError && e.status === 429) {
        const demoOver = e.reason === "demo_total" || e.reason === "demo_global";
        setNotice({ title: demoOver ? "Demo complete" : "Let's take a short pause", body: e.message, signup: demoOver });
        if (demoOver) setRemaining(0);
      } else if (e instanceof ApiError && e.status === 401) {
        setNotice({ title: "Your session ended", body: "Please sign in again to keep chatting.", signup: true });
      } else {
        toast.error(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
      }
    } finally {
      setStreaming(false);
      setWaitingFirstToken(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    updateLast((m) => ({ ...m, streaming: false, content: m.content || "_Stopped._" }));
  }

  // After starting or reopening a chat, put the cursor where the person will type next.
  const focusComposer = () => setTimeout(() => document.getElementById("chat-input")?.focus(), 0);

  function newChat() {
    abortRef.current?.abort();
    setCreatedHere(null);
    setDrawerOpen(false);
    setMessages([]);
    setActiveId(null);
    router.push("/chat");
    focusComposer();
  }

  function selectConversation(id: string) {
    setDrawerOpen(false);
    setCreatedHere(null);
    if (id !== activeId) router.push(`/chat/${id}`);
    focusComposer();
  }

  async function deleteConversation(id: string) {
    try {
      await apiFetch(`/conversations/${id}`, { method: "DELETE" });
      setConversations((cs) => cs.filter((c) => c.id !== id));
      toast.success("Conversation deleted");
      if (id === activeId) newChat();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't delete that conversation.");
    }
  }

  async function renameConversation(id: string, title: string) {
    try {
      const updated = await apiFetch<Conversation>(`/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      setConversations((cs) => cs.map((c) => (c.id === id ? { ...c, title: updated.title } : c)));
      toast.success("Conversation renamed");
      return true;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't rename that conversation.");
      return false;
    }
  }

  const lastCrisis = [...messages].reverse().find((m) => m.route === "escalate" && CRISIS_LABELS.has(m.label ?? ""));
  const showBanner = Boolean(lastCrisis) && !bannerDismissed;
  const outOfDemo = Boolean(me?.is_anonymous && me.remaining_messages <= 0);
  // A used-up demo always says how to continue, including after a reload.
  const shownNotice: Notice | null =
    notice ??
    (outOfDemo
      ? {
          title: "Demo complete",
          body: `You've used all ${me?.limit ?? 10} demo messages. Create a free account to keep chatting.`,
          signup: true,
        }
      : null);

  const sidebar = (
    <ConversationSidebar
      conversations={conversations}
      loading={listLoading}
      activeId={activeId}
      onSelect={selectConversation}
      onNew={newChat}
      onDelete={deleteConversation}
      onRename={renameConversation}
    />
  );

  return (
    <div className="flex h-dvh flex-col">
      <AppTopbar
        leading={
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open conversations">
                <PanelLeft className="size-5" />
              </Button>
            </SheetTrigger>
            {/* Don't return focus to the menu button on close: the chat input takes it instead. */}
            <SheetContent side="left" className="w-80 p-0" onCloseAutoFocus={(e) => e.preventDefault()}>
              <SheetHeader className="sr-only">
                <SheetTitle>Conversations</SheetTitle>
              </SheetHeader>
              <div className="h-full pt-10">{sidebar}</div>
            </SheetContent>
          </Sheet>
        }
      />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-border/60 bg-sidebar md:block" aria-label="Conversation history">
          {sidebar}
        </aside>

        <main id="main" className="flex min-w-0 flex-1 flex-col">
          {showBanner ? (
            <CrisisBanner emergency={lastCrisis?.label === "medical_emergency"} onDismiss={() => setBannerDismissed(true)} />
          ) : null}
          {me?.is_anonymous ? (
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-border/60 bg-accent/50 px-4 py-2 text-center text-sm text-accent-foreground">
              <span>
                <Sparkles className="mr-1 inline size-4 align-text-bottom" aria-hidden="true" />
                Demo mode: <strong>{me.remaining_messages}</strong> of {me.limit} messages left.
              </span>
              <Link href="/login" className="font-medium underline underline-offset-4">
                Create a free account
              </Link>
            </div>
          ) : null}

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" aria-live="polite" aria-busy={streaming}>
            <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
              {messagesLoading ? (
                <div className="space-y-5" aria-label="Loading messages">
                  <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
                  <Skeleton className="h-28 w-4/5 rounded-2xl" />
                  <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex animate-fade-up flex-col items-center py-10 text-center sm:py-16">
                  <div className="flex size-14 items-center justify-center rounded-full bg-primary/12">
                    <Leaf className="size-6 text-primary" aria-hidden="true" />
                  </div>
                  <h1 className="mt-5 text-3xl font-semibold">How are you, really?</h1>
                  <p className="mt-2 max-w-md text-muted-foreground">
                    Take your time. I&apos;ll listen, and share gentle ideas from trusted health guidance, with
                    sources.
                  </p>
                  <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={streaming || outOfDemo}
                        onClick={() => send(s)}
                        className="rounded-xl border border-border/80 bg-card px-4 py-3 text-left text-sm transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m) =>
                  m.role === "assistant" && m.streaming && !m.content ? null : <MessageBubble key={m.id} message={m} />,
                )
              )}
              {waitingFirstToken ? <TypingIndicator /> : null}
              {shownNotice ? (
                <Alert className="animate-fade-in">
                  <Sparkles className="size-4" />
                  <AlertTitle>{shownNotice.title}</AlertTitle>
                  <AlertDescription>
                    <p>{shownNotice.body}</p>
                    {shownNotice.signup ? (
                      <Button asChild size="sm" className="mt-3">
                        <Link href="/login">Create a free account</Link>
                      </Button>
                    ) : null}
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          </div>

          <Composer onSend={send} onStop={stop} streaming={streaming} disabled={outOfDemo} />
        </main>
      </div>
    </div>
  );
}
