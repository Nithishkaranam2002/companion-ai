import { ArrowUpRight, BookOpenCheck } from "lucide-react";

import type { Source } from "@/lib/api";

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Unique sources in first-cited order, each with the citation numbers that point to it. */
export function groupSources(sources: Source[]) {
  const byUrl = new Map<string, { source: Source; numbers: number[] }>();
  sources.forEach((s, i) => {
    const entry = byUrl.get(s.url) ?? { source: s, numbers: [] };
    entry.numbers.push(i + 1);
    byUrl.set(s.url, entry);
  });
  return [...byUrl.values()];
}

export function SourceCards({ sources }: { sources: Source[] }) {
  const groups = groupSources(sources);
  if (!groups.length) return null;
  return (
    <div className="mt-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Sources</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {groups.map(({ source, numbers }) => (
          <li key={source.url}>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="group flex h-full items-start gap-3 rounded-xl border border-border/80 bg-background p-3 text-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <BookOpenCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2 font-medium">
                  <span>
                    <span className="text-primary">[{numbers.join(", ")}]</span> {source.title}
                  </span>
                  <ArrowUpRight className="size-3.5 shrink-0 opacity-50 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{host(source.url)}</span>
              </span>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
