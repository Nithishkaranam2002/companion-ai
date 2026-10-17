"use client";

import { Loader2, Mail, MailCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { DemoButton } from "@/components/site/demo-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { site } from "@/lib/site";
import { createClient } from "@/lib/supabase/client";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.3 6.6 2.3 12s4.3 9.8 9.7 9.8c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12Z" />
    </svg>
  );
}

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/chat";
}

export function LoginForm() {
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "google">("idle");
  const [error, setError] = useState<string | null>(null);

  const callback = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback(), shouldCreateUser: true },
    });
    if (error) {
      setStatus("idle");
      setError(
        error.status === 429
          ? "Too many sign-in emails were requested. Please wait a minute and try again."
          : "We couldn't send the link. Please check the address and try again.",
      );
      return;
    }
    setStatus("sent");
  }

  async function google() {
    setError(null);
    setStatus("google");
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback() },
    });
    if (error) {
      setStatus("idle");
      setError("Google sign-in isn't available right now. Please use an email link instead.");
    }
  }

  if (status === "sent") {
    return (
      <div role="status" className="mt-8 animate-fade-in rounded-2xl bg-secondary p-6 text-center">
        <MailCheck className="mx-auto size-8 text-primary" aria-hidden="true" />
        <p className="mt-3 font-medium">Check your inbox</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a sign-in link to <strong className="text-foreground">{email}</strong>. Open it in this browser to
          continue. It expires in an hour.
        </p>
        <Button variant="link" className="mt-2" onClick={() => setStatus("idle")}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-5">
      {site.googleAuth ? (
        <>
          <Button type="button" variant="outline" className="w-full" onClick={google} disabled={status !== "idle"}>
            {status === "google" ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" /> or <Separator className="flex-1" />
          </div>
        </>
      ) : null}
      <form onSubmit={sendLink} className="space-y-3">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" className="w-full" disabled={status !== "idle"}>
          {status === "sending" ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
          Email me a sign-in link
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
        Just looking?{" "}
        <DemoButton variant="link" className="h-auto p-0" label="Try the 10-message demo" />
      </div>
    </div>
  );
}
