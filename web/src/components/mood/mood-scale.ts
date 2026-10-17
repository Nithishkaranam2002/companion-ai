export function moodWord(score: number) {
  if (score <= 2) return "Very low";
  if (score <= 4) return "Low";
  if (score <= 6) return "Okay";
  if (score <= 8) return "Good";
  return "Great";
}

export type MoodEntry = { id: string; score: number; note: string; created_at: string };

export type DayPoint = { day: string; label: string; avg: number; count: number };

/** Average entries per local calendar day, oldest first. */
export function dailyAverages(entries: MoodEntry[]): DayPoint[] {
  const byDay = new Map<string, number[]>();
  for (const e of entries) {
    const d = new Date(e.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    byDay.set(key, [...(byDay.get(key) ?? []), e.score]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, scores]) => ({
      day,
      label: new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      avg: Math.round((scores.reduce((s, x) => s + x, 0) / scores.length) * 10) / 10,
      count: scores.length,
    }));
}
