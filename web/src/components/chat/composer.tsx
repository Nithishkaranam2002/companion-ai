"use client";

import { ArrowUp, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";

const MAX = 4000;

export function Composer({
  onSend,
  onStop,
  streaming,
  disabled,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled: boolean;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  function submit() {
    const value = text.trim();
    if (!value || streaming || disabled) return;
    onSend(value);
    setText("");
  }

  return (
    <div className="border-t border-border/60 bg-background/90 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-4">
      <form
        className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-input bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/40"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="chat-input" className="sr-only">Message CompanionAI</label>
        <textarea
          id="chat-input"
          ref={ref}
          rows={1}
          value={text}
          maxLength={MAX}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={disabled ? "Message limit reached" : "Share what's on your mind…"}
          className="max-h-[200px] min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed sm:text-sm"
        />
        {streaming ? (
          <Button type="button" size="icon" variant="secondary" onClick={onStop} aria-label="Stop generating">
            <Square className="size-4 fill-current" />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!text.trim() || disabled} aria-label="Send message">
            <ArrowUp className="size-4" />
          </Button>
        )}
      </form>
      <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted-foreground">
        {site.disclaimer}{" "}
        {text.length > MAX - 300 ? <span>({MAX - text.length} characters left)</span> : null}
      </p>
    </div>
  );
}
