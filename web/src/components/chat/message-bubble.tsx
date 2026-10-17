"use client";

import { ShieldAlert, Stethoscope } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";

import { SourceCards } from "@/components/chat/source-cards";
import type { ChatMessage } from "@/components/chat/types";
import { CRISIS_LABELS } from "@/components/chat/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Source } from "@/lib/api";
import { cn } from "@/lib/utils";

const CITE_PREFIX = "#cite-";

/** Turn [n] citations into links the markdown renderer can style as chips. */
function linkCitations(text: string, count: number) {
  return text.replace(/\[(\d{1,2})\](?!\()/g, (match, n) =>
    Number(n) >= 1 && Number(n) <= count ? `[${n}](${CITE_PREFIX}${n})` : match,
  );
}

function components(sources: Source[]): Components {
  return {
    a({ href = "", children }) {
      if (href.startsWith(CITE_PREFIX)) {
        const source = sources[Number(href.slice(CITE_PREFIX.length)) - 1];
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="mx-0.5 inline-flex h-5 items-center rounded-md bg-background px-1.5 align-text-top text-xs font-semibold text-primary no-underline ring-1 ring-primary/30 transition-colors hover:bg-primary/10"
                aria-label={`Source ${children}: ${source.title} (opens in a new tab)`}
              >
                {children}
              </a>
            </TooltipTrigger>
            <TooltipContent>{source.title}</TooltipContent>
          </Tooltip>
        );
      }
      return (
        <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4">
          {children}
        </a>
      );
    },
  };
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground sm:max-w-[75%]">
          {message.content}
        </div>
      </div>
    );
  }

  const crisis = message.route === "escalate" && CRISIS_LABELS.has(message.label ?? "");
  const refusal = message.route === "refuse";
  return (
    <div className="flex animate-fade-in justify-start">
      <div
        className={cn(
          "max-w-[92%] rounded-2xl rounded-bl-md bg-secondary px-4 py-3 text-secondary-foreground sm:max-w-[80%]",
          crisis && "border border-crisis/40 bg-crisis-muted",
        )}
      >
        {crisis || refusal ? (
          <p className={cn("mb-1.5 flex items-center gap-1.5 text-xs font-semibold", crisis ? "text-crisis" : "text-muted-foreground")}>
            {crisis ? <ShieldAlert className="size-3.5" aria-hidden="true" /> : <Stethoscope className="size-3.5" aria-hidden="true" />}
            {crisis ? "Safety response" : "Outside what I can help with"}
          </p>
        ) : null}
        <div className="space-y-2 leading-relaxed [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1">
          <ReactMarkdown components={components(message.sources)}>
            {linkCitations(message.content, message.sources.length)}
          </ReactMarkdown>
          {message.streaming ? (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-primary/60 align-middle" aria-hidden="true" />
          ) : null}
        </div>
        {!message.streaming ? <SourceCards sources={message.sources} /> : null}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex justify-start" role="status" aria-label="CompanionAI is typing">
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-secondary px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-2 animate-bounce rounded-full bg-primary/60"
            style={{ animationDelay: `${i * 150}ms` }}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
