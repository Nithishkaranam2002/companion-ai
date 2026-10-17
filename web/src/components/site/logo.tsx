import Link from "next/link";

import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <circle cx="16" cy="16" r="15" className="fill-primary/15" />
      <path
        d="M16 25c-5-2.5-8-6.4-8-11 0-2.5 1.6-4.5 4-4.5 1.7 0 3.1.9 4 2.3.9-1.4 2.3-2.3 4-2.3 2.4 0 4 2 4 4.5 0 4.6-3 8.5-8 11Z"
        className="fill-primary"
      />
      <path d="M16 12v11" className="stroke-primary-foreground" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2 rounded-md font-heading text-lg font-semibold", className)}
      aria-label="CompanionAI home"
    >
      <LogoMark />
      <span>CompanionAI</span>
    </Link>
  );
}
