"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DemoButton } from "@/components/site/demo-button";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type State = "loading" | "signed-out" | "signed-in";

export function HeaderAuth({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setState(data.session ? "signed-in" : "signed-out"));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      setState(session ? "signed-in" : "signed-out"),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  if (state === "loading") {
    return <div className="h-9 w-40" aria-hidden="true" />;
  }
  if (state === "signed-in") {
    return (
      <Button asChild size={compact ? "sm" : "default"}>
        <Link href="/chat">Open app</Link>
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="ghost" size={compact ? "sm" : "default"}>
        <Link href="/login">Sign in</Link>
      </Button>
      <DemoButton size={compact ? "sm" : "default"} />
    </div>
  );
}
