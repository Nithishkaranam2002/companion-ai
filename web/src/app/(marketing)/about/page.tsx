import { BookOpenCheck, HeartHandshake, Scale, Sprout } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/marketing/section";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About",
  description: "Why we built CompanionAI and the principles that guide it.",
};

const principles = [
  { icon: HeartHandshake, title: "Kindness first", body: "Every reply should leave someone feeling heard, especially when the answer is \"that's a question for your doctor.\"" },
  { icon: Scale, title: "Honest limits", body: "We're clear about what CompanionAI is, and isn't. It's a wellness companion, never a clinician." },
  { icon: BookOpenCheck, title: "Trusted, cited knowledge", body: "Ideas come from public health guidance you can check yourself, not from guesswork." },
  { icon: Sprout, title: "Measured, in the open", body: "We test safety and quality on every change and publish the results, including where we fall short." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="Everyday support, with care built in"
        intro="Most hard days aren't emergencies. They're stress, poor sleep, loneliness, or a racing mind at 2am. CompanionAI is there for those moments, and knows when to hand you to a person."
      />
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-5 text-lg text-muted-foreground">
          <p>
            CompanionAI started from a simple question: could an AI companion be genuinely helpful for everyday
            wellbeing <em>without</em> overstepping into medical care? Our answer is a design built around restraint.
            Every idea comes from established public health guidance. Safety checks run before every reply. And there
            is always a clear path to a human.
          </p>
          <p>
            CompanionAI is an independent project. It runs on large language models, a curated knowledge library, and
            the safety layers described on our{" "}
            <Link href="/safety" className="text-primary underline underline-offset-4">safety page</Link>. Its
            evaluation results are published there too.
          </p>
        </div>

        <h2 className="mt-16 text-center text-3xl font-semibold">What we believe</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {principles.map((p) => (
            <div key={p.title} className="rounded-2xl border border-border/70 bg-card p-6">
              <p.icon className="size-6 text-primary" aria-hidden="true" />
              <h3 className="mt-4 font-sans text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/login">Create a free account</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/contact">Contact us</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
