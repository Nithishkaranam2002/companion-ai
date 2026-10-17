"use client";

import { CalendarCheck, Loader2, NotebookPen, SmilePlus, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AppTopbar } from "@/components/app/app-topbar";
import { MoodChart } from "@/components/mood/mood-chart";
import { dailyAverages, moodWord, type MoodEntry } from "@/components/mood/mood-scale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMe } from "@/hooks/use-me";
import { apiFetch, ApiError } from "@/lib/api";

function sameDay(iso: string, ref: number) {
  return new Date(iso).toDateString() === new Date(ref).toDateString();
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof TrendingUp; label: string; value: string; hint: string }) {
  return (
    <Card className="gap-2 py-5">
      <CardContent className="px-5">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" /> {label}
        </p>
        <p className="mt-2 font-heading text-3xl font-semibold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function MoodTracker() {
  const { me, loading: meLoading } = useMe();
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("30");
  const [score, setScore] = useState(6);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [asOf, setAsOf] = useState(0); // when entries were last fetched or saved

  const signedIn = Boolean(me && !me.is_anonymous);

  const load = useCallback(
    (range: string) =>
      apiFetch<MoodEntry[]>(`/mood?days=${range}`)
        .then((rows) => {
          setEntries(rows);
          setAsOf(Date.now());
        })
        .catch((e) => toast.error(e instanceof ApiError ? e.message : "Couldn't load your mood history."))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    if (signedIn) void load(days);
  }, [signedIn, days, load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const entry = await apiFetch<MoodEntry>("/mood", { method: "POST", body: JSON.stringify({ score, note }) });
      setEntries((es) => [...es, entry]);
      setAsOf(Date.now());
      setNote("");
      toast.success("Check-in saved. Thank you for taking a moment for yourself.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save your check-in.");
    } finally {
      setSaving(false);
    }
  }

  const points = dailyAverages(entries);
  const lastWeek = entries.filter((e) => asOf - new Date(e.created_at).getTime() < 7 * 86400_000);
  const weekAvg = lastWeek.length ? (lastWeek.reduce((s, e) => s + e.score, 0) / lastWeek.length).toFixed(1) : "–";
  const checkedInToday = asOf > 0 && entries.some((e) => sameDay(e.created_at, asOf));
  const latest = entries[entries.length - 1];

  return (
    <div className="flex min-h-dvh flex-col">
      <AppTopbar />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="animate-fade-up">
          <h1 className="text-3xl font-semibold sm:text-4xl">Mood tracker</h1>
          <p className="mt-2 text-muted-foreground">A ten-second daily check-in, and a gentle view of how your weeks are going.</p>
        </div>

        {meLoading ? (
          <Skeleton className="mt-8 h-64 rounded-2xl" />
        ) : !signedIn ? (
          <Card className="mt-8 text-center">
            <CardContent className="py-10">
              <SmilePlus className="mx-auto size-8 text-primary" aria-hidden="true" />
              <h2 className="mt-4 text-2xl font-semibold">Track your mood with a free account</h2>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                Mood tracking saves your check-ins over time, so it needs an account. It&apos;s free and takes a moment.
              </p>
              <Button asChild className="mt-6">
                <Link href="/login?next=/mood">Create a free account</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="font-sans text-lg">
                    {checkedInToday ? "Check in again" : "How are you feeling today?"}
                  </CardTitle>
                  <CardDescription>
                    {checkedInToday ? "You've already checked in today. Moods change, and that's okay." : "There are no wrong answers."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={save} className="space-y-6">
                    <div>
                      <div className="flex items-baseline justify-between">
                        <Label id="mood-label">Mood</Label>
                        <p className="text-sm" aria-live="polite">
                          <span className="font-heading text-2xl font-semibold text-primary tabular-nums">{score}</span>
                          <span className="text-muted-foreground"> / 10 · {moodWord(score)}</span>
                        </p>
                      </div>
                      <Slider
                        className="mt-4"
                        min={1}
                        max={10}
                        step={1}
                        value={[score]}
                        onValueChange={([v]) => setScore(v)}
                        aria-labelledby="mood-label"
                        aria-valuetext={`${score} out of 10, ${moodWord(score)}`}
                      />
                      <div className="mt-2 flex justify-between text-xs text-muted-foreground" aria-hidden="true">
                        <span>Very low</span>
                        <span>Great</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mood-note">Note (optional)</Label>
                      <Textarea
                        id="mood-note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={1000}
                        rows={3}
                        placeholder="What's shaping your day?"
                      />
                      <p className="text-xs text-muted-foreground">Names and contact details are removed before saving.</p>
                    </div>
                    <Button type="submit" disabled={saving} className="w-full">
                      {saving ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck className="size-4" />}
                      Save check-in
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  <Stat icon={TrendingUp} label="7-day average" value={weekAvg} hint="out of 10" />
                  <Stat icon={CalendarCheck} label="Check-ins" value={String(entries.length)} hint={`last ${days} days`} />
                  <Stat icon={SmilePlus} label="Latest" value={latest ? String(latest.score) : "–"} hint={latest ? moodWord(latest.score) : "no entries yet"} />
                </div>
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle className="font-sans text-lg">Daily mood</CardTitle>
                      <CardDescription>Average score per day, 1 (very low) to 10 (great)</CardDescription>
                    </div>
                    <ToggleGroup
                      type="single"
                      size="sm"
                      variant="outline"
                      value={days}
                      onValueChange={(v) => v && setDays(v)}
                      aria-label="Time range"
                    >
                      <ToggleGroupItem value="30">30 days</ToggleGroupItem>
                      <ToggleGroupItem value="90">90 days</ToggleGroupItem>
                    </ToggleGroup>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-64 rounded-xl" />
                    ) : points.length === 0 ? (
                      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed text-center">
                        <TrendingUp className="size-6 text-muted-foreground" aria-hidden="true" />
                        <p className="mt-3 font-medium">Your chart starts with your first check-in</p>
                        <p className="mt-1 text-sm text-muted-foreground">Log how you feel today to see it here.</p>
                      </div>
                    ) : (
                      <MoodChart data={points} />
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <section aria-labelledby="history-title" className="mt-8">
              <h2 id="history-title" className="flex items-center gap-2 font-sans text-lg font-semibold">
                <NotebookPen className="size-5 text-primary" aria-hidden="true" /> Recent check-ins
              </h2>
              {loading ? (
                <Skeleton className="mt-4 h-40 rounded-xl" />
              ) : entries.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No check-ins yet.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Your mood check-ins, newest first</caption>
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th scope="col" className="px-4 py-3 font-medium">When</th>
                        <th scope="col" className="px-4 py-3 font-medium">Mood</th>
                        <th scope="col" className="px-4 py-3 font-medium">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...entries].reverse().slice(0, 30).map((e) => (
                        <tr key={e.id} className="border-b border-border/60 last:border-0">
                          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                            {new Date(e.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className="font-semibold tabular-nums">{e.score}</span>{" "}
                            <span className="text-muted-foreground">{moodWord(e.score)}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{e.note || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
