"use client";

import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiError } from "@/lib/api";

const topicLabels: Record<string, string> = {
  general: "General question",
  pro: "Pro plan waitlist",
  clinic: "Teams plan", // key kept so existing links and the API stay valid
  privacy: "Privacy request",
  safety: "Safety concern",
};

export function ContactForm() {
  const requested = useSearchParams().get("topic") ?? "";
  const initialTopic = requested in topicLabels ? requested : "general";
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus("sending");
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/contact", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form.entries())),
        auth: false,
      });
      setStatus("sent");
    } catch (e) {
      setStatus("idle");
      setError(e instanceof ApiError ? e.message : "We couldn't send your message. Please try again.");
    }
  }

  if (status === "sent") {
    return (
      <div role="status" className="animate-fade-up rounded-2xl border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-semibold">Thank you, message received</h2>
        <p className="mt-2 text-muted-foreground">We&apos;ll reply to the email you gave us.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border bg-card p-6 sm:p-8" noValidate={false}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required maxLength={120} autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required maxLength={200} autoComplete="email" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="topic">Topic</Label>
        <select
          id="topic"
          name="topic"
          defaultValue={initialTopic}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-ring"
        >
          {Object.entries(topicLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Textarea id="message" name="message" required minLength={10} maxLength={4000} rows={6} />
        <p className="text-xs text-muted-foreground">Please don&apos;t include health details you wouldn&apos;t want stored.</p>
      </div>
      {/* Honeypot: hidden from people, often filled by bots. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={status === "sending"} className="w-full sm:w-auto">
        {status === "sending" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Send message
      </Button>
    </form>
  );
}
