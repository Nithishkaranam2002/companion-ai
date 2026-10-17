import { HeartHandshake, MessageSquareText, Phone, Siren, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { crisisLinks } from "@/lib/site";

export function CrisisBanner({ emergency, onDismiss }: { emergency: boolean; onDismiss: () => void }) {
  return (
    <section
      role="alert"
      aria-labelledby="crisis-title"
      className="border-b border-crisis/30 bg-crisis-muted px-4 py-4"
    >
      <div className="mx-auto flex max-w-3xl gap-3">
        <HeartHandshake className="mt-0.5 size-6 shrink-0 text-crisis" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="crisis-title" className="font-sans text-base font-semibold">
            {emergency ? "This may be a medical emergency" : "You don't have to go through this alone"}
          </h2>
          <p className="mt-1 text-sm text-foreground/80">
            {emergency
              ? "Please call 911 (or your local emergency number) or go to the nearest emergency room now."
              : "Free, confidential support is available 24/7. A person on our team has also been notified."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {emergency ? (
              <Button asChild size="sm" className="bg-crisis text-crisis-foreground hover:bg-crisis/90">
                <a href="tel:911"><Siren className="size-4" /> Call 911</a>
              </Button>
            ) : null}
            <Button asChild size="sm" className={emergency ? "" : "bg-crisis text-crisis-foreground hover:bg-crisis/90"} variant={emergency ? "outline" : "default"}>
              <a href={crisisLinks.call}><Phone className="size-4" /> Call 988</a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={crisisLinks.text}><MessageSquareText className="size-4" /> Text 988</a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={crisisLinks.chat} target="_blank" rel="noreferrer">Chat online</a>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <a href={crisisLinks.international} target="_blank" rel="noreferrer">Outside the US</a>
            </Button>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={onDismiss} aria-label="Hide crisis resources">
          <X className="size-4" />
        </Button>
      </div>
    </section>
  );
}
