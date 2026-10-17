import { Phone } from "lucide-react";
import Link from "next/link";

import { CurrentYear } from "@/components/site/current-year";
import { Logo } from "@/components/site/logo";
import { crisisLinks, footerNav, site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-muted/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">{site.tagline}</p>
          <p className="flex items-center gap-2 text-sm font-medium">
            <Phone className="size-4 text-crisis" aria-hidden="true" />
            <span>
              In crisis? Call or text{" "}
              <a href={crisisLinks.call} className="underline underline-offset-4">988</a>
            </span>
          </p>
        </div>
        {footerNav.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <h2 className="mb-3 font-sans text-sm font-semibold">{group.title}</h2>
            <ul className="space-y-2">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© <CurrentYear /> CompanionAI. All rights reserved.</p>
          <p>{site.disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
