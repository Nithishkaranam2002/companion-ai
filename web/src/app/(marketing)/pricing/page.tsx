import { Check, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/marketing/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description: "CompanionAI is free to use. Pro and Clinic plans are coming soon.",
};

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    blurb: "Everything you need to start feeling more supported.",
    features: [
      "Up to 20 messages per hour",
      "Cited answers from trusted health guidance",
      "Crisis resources and human escalation",
      "Saved conversation history",
      "Daily mood tracker with charts",
    ],
    cta: { label: "Create a free account", href: "/login", note: "Email sign-in link. No card needed." },
    status: "Available now",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$9",
    period: "per month",
    blurb: "For people who check in every day and want more room to talk.",
    features: [
      "Everything in Free",
      "Higher message limits",
      "Mood insights and weekly reflections",
      "Export your conversations and mood history",
      "Priority human follow-up",
    ],
    cta: { label: "Join the Pro waitlist", href: "/contact?topic=pro", note: "Opens a short form. No payment." },
    status: "Coming soon",
    highlight: true,
  },
  {
    name: "Clinic",
    price: "$49",
    period: "per seat / month",
    blurb: "For clinics and wellbeing teams supporting people between visits.",
    features: [
      "Everything in Pro",
      "Escalation queue and reviewer dashboard",
      "Custom knowledge base from your own materials",
      "Single sign-on and audit logs",
      "Business Associate Agreement on request",
    ],
    cta: { label: "Talk to us", href: "/contact?topic=clinic", note: "Opens a short form. No payment." },
    status: "Coming soon",
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Care that's free to start"
        intro="CompanionAI is free today. Pro and Clinic plans are in development. Join the waitlist and we'll let you know when they launch."
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {tiers.map((t) => (
            <Card
              key={t.name}
              className={cn(
                "relative flex flex-col border-border/70",
                t.highlight && "border-primary/50 shadow-lg shadow-primary/10 lg:-translate-y-2",
              )}
            >
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold">{t.name}</h2>
                  <Badge variant={t.status === "Available now" ? "default" : "secondary"}>{t.status}</Badge>
                </div>
                <p className="text-muted-foreground">{t.blurb}</p>
                <p>
                  <span className="font-heading text-4xl font-semibold">{t.price}</span>{" "}
                  <span className="text-sm text-muted-foreground">{t.period}</span>
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="flex-col gap-2">
                <Button asChild className="w-full" variant={t.highlight || t.name === "Free" ? "default" : "outline"}>
                  <Link href={t.cta.href} aria-describedby={`cta-note-${t.name}`}>
                    {t.cta.label}
                  </Link>
                </Button>
                <p id={`cta-note-${t.name}`} className="text-xs text-muted-foreground">
                  {t.cta.note}
                </p>
              </CardFooter>
            </Card>
          ))}
        </div>
        <p className="mx-auto mt-10 flex max-w-2xl items-start justify-center gap-2 text-center text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          No payments are collected today. Prices for upcoming plans are indicative and may change before launch.
        </p>
      </div>
    </>
  );
}
