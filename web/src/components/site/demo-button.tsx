"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ComponentProps } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Props = Omit<ComponentProps<typeof Button>, "onClick"> & { label?: string };

/** Starts a no-signup demo session (Supabase anonymous sign-in, 10 messages). */
export function DemoButton({ label = "Try the demo", children, ...props }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true);
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        setPending(false);
        toast.error("The demo isn't available right now. Please create a free account instead.");
        return;
      }
    }
    router.push("/chat");
    router.refresh();
  }

  return (
    <Button onClick={start} disabled={pending} {...props}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      {children ?? label}
    </Button>
  );
}
