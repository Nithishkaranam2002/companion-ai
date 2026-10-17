import { HeartHandshake } from "lucide-react";

import { crisisLinks } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-1.5 text-sm text-muted-foreground",
        className,
      )}
    >
      <HeartHandshake className="size-4 text-crisis" aria-hidden="true" />
      <span>
        Not a medical service. In crisis, call or text{" "}
        <a href={crisisLinks.call} className="font-semibold text-foreground underline underline-offset-4">
          988
        </a>
        .
      </span>
    </p>
  );
}
