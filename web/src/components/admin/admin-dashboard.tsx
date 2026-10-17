"use client";

import { AlertTriangle, CheckCircle2, Inbox, Loader2, Mail, RefreshCw, ShieldAlert, ShieldOff } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AppTopbar } from "@/components/app/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMe } from "@/hooks/use-me";
import { apiFetch, ApiError } from "@/lib/api";

type Escalation = {
  id: string;
  user_id: string | null;
  conversation_id: string | null;
  reason: string;
  summary: string;
  urgent: boolean;
  status: "open" | "resolved";
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
};

type ContactMessage = { id: string; name: string; email: string; topic: string; message: string; created_at: string };

const reasonLabel: Record<string, string> = {
  crisis: "Crisis",
  medical_emergency: "Medical emergency",
  human_request: "Asked for a person",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function Empty({ icon: Icon, text }: { icon: typeof Inbox; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
      <Icon className="mx-auto size-7 opacity-70" aria-hidden="true" />
      <p className="mt-3">{text}</p>
    </div>
  );
}

function TicketCard({ t, onResolve, resolving }: { t: Escalation; onResolve?: () => void; resolving?: boolean }) {
  return (
    <Card className={t.urgent && t.status === "open" ? "border-crisis/40" : undefined}>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {t.urgent ? (
            <Badge className="bg-crisis text-crisis-foreground">
              <ShieldAlert className="size-3" aria-hidden="true" /> Urgent
            </Badge>
          ) : null}
          <Badge variant="outline">{reasonLabel[t.reason] ?? t.reason}</Badge>
          <span className="text-xs text-muted-foreground">{when(t.created_at)}</span>
        </div>
        <blockquote className="rounded-lg bg-muted px-4 py-3 text-sm">{t.summary}</blockquote>
        <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <div><dt className="inline">User: </dt><dd className="inline font-mono">{t.user_id ?? "—"}</dd></div>
          <div><dt className="inline">Conversation: </dt><dd className="inline font-mono">{t.conversation_id ?? "—"}</dd></div>
          {t.resolved_at ? (
            <div className="sm:col-span-2"><dt className="inline">Resolved: </dt><dd className="inline">{when(t.resolved_at)} by {t.resolved_by}</dd></div>
          ) : null}
        </dl>
        {onResolve ? (
          <Button size="sm" onClick={onResolve} disabled={resolving}>
            {resolving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Mark resolved
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AdminDashboard() {
  const { me, loading: meLoading } = useMe();
  const [open, setOpen] = useState<Escalation[]>([]);
  const [resolved, setResolved] = useState<Escalation[]>([]);
  const [contacts, setContacts] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(
    () =>
      Promise.all([
        apiFetch<Escalation[]>("/admin/escalations?status=open"),
        apiFetch<Escalation[]>("/admin/escalations?status=resolved"),
        apiFetch<ContactMessage[]>("/admin/contact"),
      ])
        .then(([o, r, c]) => {
          setOpen(o);
          setResolved(r);
          setContacts(c);
        })
        .catch((e) => toast.error(e instanceof ApiError ? e.message : "Couldn't load the queue."))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    if (me?.is_admin) void load();
  }, [me?.is_admin, load]);

  async function resolve(id: string) {
    setResolving(id);
    try {
      const done = await apiFetch<Escalation>(`/admin/escalations/${id}/resolve`, { method: "POST" });
      setOpen((ts) => ts.filter((t) => t.id !== id));
      setResolved((ts) => [done, ...ts]);
      toast.success("Ticket resolved");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't resolve that ticket.");
    } finally {
      setResolving(null);
    }
  }

  const urgentOpen = open.filter((t) => t.urgent).length;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppTopbar />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {meLoading ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : !me?.is_admin ? (
          <div className="mx-auto max-w-md py-16 text-center">
            <ShieldOff className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
            <h1 className="mt-4 text-3xl font-semibold">Admins only</h1>
            <p className="mt-2 text-muted-foreground">This page is for the CompanionAI team. Your account doesn&apos;t have access.</p>
            <Button asChild className="mt-6">
              <Link href="/chat">Back to chat</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold">Escalation queue</h1>
                <p className="mt-1 text-muted-foreground">
                  {loading ? "Loading…" : `${open.length} open · ${urgentOpen} urgent`}
                </p>
              </div>
              <Button variant="outline" onClick={() => { setLoading(true); void load(); }} disabled={loading}>
                <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh
              </Button>
            </div>
            {urgentOpen > 0 ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl bg-crisis-muted px-4 py-3 text-sm">
                <AlertTriangle className="size-4 text-crisis" aria-hidden="true" />
                {urgentOpen} urgent ticket{urgentOpen === 1 ? "" : "s"} need follow-up. Messages are redacted; contact details are not stored.
              </p>
            ) : null}

            <Tabs defaultValue="open" className="mt-6">
              <TabsList>
                <TabsTrigger value="open">Open ({open.length})</TabsTrigger>
                <TabsTrigger value="resolved">Resolved ({resolved.length})</TabsTrigger>
                <TabsTrigger value="contact">Contact ({contacts.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="open" className="mt-4 space-y-3">
                {loading ? (
                  [0, 1].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)
                ) : open.length === 0 ? (
                  <Empty icon={CheckCircle2} text="All clear. No open tickets." />
                ) : (
                  open.map((t) => <TicketCard key={t.id} t={t} onResolve={() => resolve(t.id)} resolving={resolving === t.id} />)
                )}
              </TabsContent>
              <TabsContent value="resolved" className="mt-4 space-y-3">
                {loading ? (
                  <Skeleton className="h-40 rounded-2xl" />
                ) : resolved.length === 0 ? (
                  <Empty icon={Inbox} text="No resolved tickets yet." />
                ) : (
                  resolved.map((t) => <TicketCard key={t.id} t={t} />)
                )}
              </TabsContent>
              <TabsContent value="contact" className="mt-4 space-y-3">
                {loading ? (
                  <Skeleton className="h-32 rounded-2xl" />
                ) : contacts.length === 0 ? (
                  <Empty icon={Mail} text="No contact messages yet." />
                ) : (
                  contacts.map((c) => (
                    <Card key={c.id}>
                      <CardContent className="space-y-2 p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="capitalize">{c.topic}</Badge>
                          <span className="text-xs text-muted-foreground">{when(c.created_at)}</span>
                        </div>
                        <p className="text-sm font-medium">
                          {c.name} · <a href={`mailto:${c.email}`} className="text-primary underline underline-offset-4">{c.email}</a>
                        </p>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{c.message}</p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
