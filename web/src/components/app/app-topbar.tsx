"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AccountMenu } from "@/components/app/account-menu";
import { Logo } from "@/components/site/logo";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { useMe } from "@/hooks/use-me";
import { cn } from "@/lib/utils";

export function AppTopbar({ leading }: { leading?: React.ReactNode }) {
  const pathname = usePathname();
  const { me } = useMe();
  const links = [
    { href: "/chat", label: "Chat" },
    { href: "/mood", label: "Mood" },
    ...(me?.is_admin ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur sm:px-4">
      <div className="flex items-center gap-1">
        {leading}
        <Logo className="text-base [&_svg]:size-7" />
      </div>
      <nav aria-label="App" className="flex items-center gap-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={pathname.startsWith(l.href) ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
              pathname.startsWith(l.href) && "bg-muted text-foreground",
            )}
          >
            {l.label}
          </Link>
        ))}
        <ThemeToggle />
        <AccountMenu />
      </nav>
    </header>
  );
}
