import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { LoginForm } from "@/components/app/login-form";
import { Logo } from "@/components/site/logo";
import { Disclaimer } from "@/components/site/disclaimer";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in or create a free CompanionAI account.",
};

export default function LoginPage() {
  return (
    <main id="main" className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl animate-breathe" />
      </div>
      <Logo className="mb-8" />
      <div className="w-full max-w-md animate-fade-up rounded-3xl border bg-card p-6 shadow-xl shadow-primary/5 sm:p-8">
        <h1 className="text-center text-3xl font-semibold">Welcome</h1>
        <p className="mt-2 text-center text-muted-foreground">
          Sign in or create a free account. No password needed.
        </p>
        <Suspense fallback={<div className="mt-8 h-56" aria-hidden="true" />}>
          <LoginForm />
        </Suspense>
      </div>
      <p className="mt-6 max-w-md text-center text-xs text-muted-foreground">
        By continuing you agree to our <Link href="/terms" className="underline underline-offset-4">Terms</Link> and{" "}
        <Link href="/privacy" className="underline underline-offset-4">Privacy policy</Link>.
      </p>
      <Disclaimer className="mt-4" />
    </main>
  );
}
