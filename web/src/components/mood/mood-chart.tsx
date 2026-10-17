"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { moodWord, type DayPoint } from "@/components/mood/mood-scale";

const config = { avg: { label: "Daily mood", color: "var(--chart-1)" } } satisfies ChartConfig;

function TooltipBody({ active, payload }: { active?: boolean; payload?: { payload: DayPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{p.label}</p>
      <p className="mt-1 text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{p.avg}</span> / 10 · {moodWord(p.avg)}
      </p>
      {p.count > 1 ? <p className="text-muted-foreground">Average of {p.count} check-ins</p> : null}
    </div>
  );
}

export function MoodChart({ data }: { data: DayPoint[] }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <LineChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: -16 }} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
        <YAxis domain={[1, 10]} ticks={[1, 4, 7, 10]} tickLine={false} axisLine={false} width={40} />
        <ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={<TooltipBody />} />
        <Line
          dataKey="avg"
          type="monotone"
          stroke="var(--color-avg)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--color-avg)", stroke: "var(--card)", strokeWidth: 2 }}
          activeDot={{ r: 6, stroke: "var(--card)", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
