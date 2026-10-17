import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/site/logo";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Sign-in problem" };

async function Reason({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return reason ? (
    <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
      Details: {reason.slice(0, 160)}
    </p>
  ) : null;
}

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <Logo />
      <div className="max-w-md animate-fade-up rounded-2xl border bg-card p-8 text-center shadow-sm">
        <AlertCircle className="mx-auto size-8 text-destructive" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold">We couldn&apos;t sign you in</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sign-in links expire after a short time and only work once, in the same browser you
          requested them from. Please request a new one.
        </p>
        <Suspense fallback={null}>
          <Reason searchParams={searchParams} />
        </Suspense>
        <Button asChild className="mt-6">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    </main>
  );
}
