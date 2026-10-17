import {
  BookOpenCheck,
  ChartLine,
  EyeOff,
  HandHeart,
  LifeBuoy,
  Lock,
  MessageCircleHeart,
  Quote,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";

import { Section } from "@/components/marketing/section";
import { DemoButton } from "@/components/site/demo-button";
import { Disclaimer } from "@/components/site/disclaimer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { evalSummary, pct, score } from "@/lib/evals";

const steps = [
  {
    icon: MessageCircleHeart,
    title: "Share what's on your mind",
    body: "Write the way you'd talk to a friend. Names, emails and phone numbers are removed before anything is stored or processed.",
  },
  {
    icon: ShieldCheck,
    title: "Safety checks run first",
    body: "Every message is checked by two independent safety layers. Crisis or emergency signs connect you with real help right away.",
  },
  {
    icon: BookOpenCheck,
    title: "Get grounded, cited support",
    body: "Answers draw only from a curated library of NHS, CDC, NIMH and WHO guidance, with a source card you can open for every idea.",
  },
];

const features = [
  { icon: BookOpenCheck, title: "Cited sources, always", body: "Every tip links to the trusted guidance it came from. No made-up advice." },
  { icon: LifeBuoy, title: "Human escalation", body: "Crisis, emergency or a request for a person creates a ticket for our team, plus 988 resources." },
  { icon: Stethoscope, title: "Holds the medical line", body: "No diagnoses, doses or treatment plans — it points you to a clinician, kindly." },
  { icon: ChartLine, title: "Mood tracking", body: "A 10-second daily check-in and a gentle chart of how your weeks are going." },
  { icon: EyeOff, title: "Privacy by design", body: "Personal details are redacted before storage, and raw messages are never written to logs." },
  { icon: Lock, title: "Your data, your control", body: "Delete any conversation at any time. We never sell or share your data for advertising." },
];

const testimonials = [
  {
    quote: "It helped me put words to a stressful week, and it actually showed me where each suggestion came from.",
    who: "Example user · graduate student",
  },
  {
    quote: "When I asked about my medication it didn't guess — it helped me write down questions for my doctor instead.",
    who: "Example user · working parent",
  },
  {
    quote: "The two-minute breathing exercise it found for me has become part of my evening routine.",
    who: "Example user · nurse on night shifts",
  },
];

const faqs = [
  {
    q: "Is CompanionAI a therapist or a medical service?",
    a: "No. CompanionAI is a wellness companion for everyday stress, sleep, mood and connection. It does not diagnose, prescribe, or give treatment advice. If you're in crisis, call or text 988 in the US, or your local emergency number.",
  },
  {
    q: "What happens if I mention self-harm or an emergency?",
    a: "Safety checks run before any answer is written. If there are signs of crisis or a medical emergency, you'll immediately see crisis resources (including 988) and a ticket is created for a human on our team to follow up.",
  },
  {
    q: "Where do the answers come from?",
    a: "From a curated library of public health guidance — NHS, CDC, NIMH, NCCIH, WHO and the 988 Lifeline. Each answer cites its sources as clickable cards, and the assistant is instructed not to add advice that isn't in them.",
  },
  {
    q: "Do I need an account?",
    a: "No — you can try a demo with 10 messages without signing up. A free account saves your conversations and unlocks the mood tracker.",
  },
  {
    q: "How is my data protected?",
    a: "Names, emails, phone numbers and similar details are redacted before your messages are stored. Data is encrypted in transit and at rest, access is restricted per user, and you can delete conversations at any time. Read our privacy policy for the details.",
  },
  {
    q: "Is it free?",
    a: "Yes. The Free plan includes up to 20 messages an hour, conversation history and mood tracking. Pro and Clinic plans are on our roadmap.",
  },
];

export default function LandingPage() {
  const d = evalSummary.deepeval;
  const proof = [
    { value: pct(evalSummary.routing.accuracy), label: `of ${evalSummary.routing.total} safety test conversations routed correctly` },
    { value: score(d.NonMedicalBoundary.mean), label: "non-medical boundary score (DeepEval, out of 1)" },
    { value: score(evalSummary.ragas.faithfulness), label: "answer faithfulness to sources (RAGAS)" },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl animate-breathe" />
          <div className="absolute top-40 -right-24 size-80 rounded-full bg-accent/60 blur-3xl" />
        </div>
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
          <div className="animate-fade-up">
            <Disclaimer />
            <h1 className="mt-6 text-5xl leading-[1.05] font-semibold sm:text-6xl">
              A calm place to talk, <span className="text-primary">grounded in trusted care.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              CompanionAI listens, offers gentle ideas backed by NHS, CDC and NIMH guidance, and connects
              you with a real person when it matters most.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <DemoButton size="lg" label="Try it free — no sign-up" />
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Create a free account</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Demo includes 10 messages. Nothing to install.</p>
          </div>

          <figure
            className="animate-fade-up rounded-3xl border bg-card p-5 shadow-xl shadow-primary/5 [animation-delay:150ms]"
            aria-label="Example conversation"
          >
            <figcaption className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-success" aria-hidden="true" /> Example conversation
              </span>
              <span>Sources cited</span>
            </figcaption>
            <div className="space-y-3 text-sm">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground">
                I&apos;ve been so anxious before work presentations. How can I calm down beforehand?
              </p>
              <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-secondary px-4 py-3 text-secondary-foreground">
                <p>
                  That sounds really uncomfortable — presentations can put your body on high alert. One
                  thing that may help is slow breathing: breathe in gently through your nose for a count
                  of five, then out for five, for 3–5 minutes{" "}
                  <span className="rounded bg-primary/15 px-1 font-medium text-primary">[1]</span>.
                </p>
              </div>
              <div className="flex max-w-[92%] items-start gap-3 rounded-xl border bg-background p-3">
                <BookOpenCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="font-medium">[1] Breathing Exercises for Stress</p>
                  <p className="text-xs text-muted-foreground">NHS · Every Mind Matters</p>
                </div>
              </div>
            </div>
          </figure>
        </div>
      </section>

      {/* Proof strip with real eval numbers */}
      <section aria-label="Measured safety results" className="border-y border-border/60 bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3 sm:px-6">
          {proof.map((p) => (
            <div key={p.label} className="text-center">
              <p className="font-heading text-4xl font-semibold text-primary">{p.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.label}</p>
            </div>
          ))}
        </div>
        <p className="pb-6 text-center text-xs text-muted-foreground">
          From our latest published evaluation.{" "}
          <Link href="/safety" className="underline underline-offset-4 hover:text-foreground">
            See the full results
          </Link>
        </p>
      </section>

      <Section
        id="how-it-works"
        eyebrow="How it works"
        title="Support in three gentle steps"
        intro="Built to be helpful in the everyday moments — and careful in the hard ones."
      >
        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Card className="h-full border-border/70 transition-shadow hover:shadow-md">
                <CardContent className="space-y-3 p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary">
                      <s.icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">Step {i + 1}</span>
                  </div>
                  <h3 className="text-xl font-semibold">{s.title}</h3>
                  <p className="text-muted-foreground">{s.body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      {/* Safety first */}
      <section aria-labelledby="safety-title" className="bg-secondary/50 py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-primary">Safety first</p>
            <h2 id="safety-title" className="mt-3 text-3xl font-semibold sm:text-4xl">
              Caring means knowing where the line is
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              CompanionAI is not a doctor or therapist, and it never pretends to be. Safety checks run
              before any reply is written, and unsafe text is blocked before it reaches your screen.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                { icon: LifeBuoy, text: "Crisis and emergency signs trigger 988 resources and alert a human on our team." },
                { icon: Stethoscope, text: "Questions about diagnoses, medications or doses are kindly redirected to a clinician." },
                { icon: UserRoundCheck, text: "Ask for a real person any time, and a ticket is created for our team." },
              ].map((item) => (
                <li key={item.text} className="flex gap-3">
                  <item.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="mt-8">
              <Link href="/safety">How we keep you safe</Link>
            </Button>
          </div>
          <Card className="border-crisis/30 bg-card">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2 text-crisis">
                <HandHeart className="size-5" aria-hidden="true" />
                <p className="font-semibold">If someone is in danger right now</p>
              </div>
              <p className="text-muted-foreground">
                Please don&apos;t wait for an app. In the US, call or text <strong className="text-foreground">988</strong>{" "}
                for the Suicide &amp; Crisis Lifeline, or call 911 in an emergency. Outside the US, contact your
                local emergency number.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="bg-crisis text-crisis-foreground hover:bg-crisis/90">
                  <a href="tel:988">Call 988</a>
                </Button>
                <Button asChild variant="outline">
                  <a href="https://findahelpline.com/" target="_blank" rel="noreferrer">
                    Find a helpline worldwide
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Section id="features" eyebrow="Features" title="Everything you need, nothing you don't">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border/70 bg-card p-6 transition-colors hover:border-primary/40">
              <f.icon className="size-6 text-primary" aria-hidden="true" />
              <h3 className="mt-4 font-sans text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="testimonials"
        eyebrow="What people could say"
        title="Moments it's designed for"
        intro="CompanionAI is newly launched, so these are illustrative examples written by our team — not quotes from real users."
        className="bg-muted/40"
      >
        <div className="mb-8 flex justify-center">
          <Badge variant="outline" className="border-accent-foreground/30 text-accent-foreground">
            Example testimonials · placeholders
          </Badge>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.quote} className="flex h-full flex-col rounded-2xl border border-dashed border-border bg-card p-6">
              <Quote className="size-5 text-primary/60" aria-hidden="true" />
              <blockquote className="mt-3 flex-1 text-foreground">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-4 text-sm text-muted-foreground">{t.who}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section id="faq" eyebrow="FAQ" title="Questions, answered honestly">
        <Accordion type="single" collapsible className="mx-auto max-w-3xl">
          {faqs.map((f, i) => (
            <AccordionItem key={f.q} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-base">{f.q}</AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Section>

      {/* Final CTA */}
      <section className="px-4 pb-24 sm:px-6">
        <div className="mx-auto max-w-5xl rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12">
          <Sparkles className="mx-auto size-7 opacity-80" aria-hidden="true" />
          <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Take a quiet moment for yourself</h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/85">
            Try CompanionAI free — no sign-up needed for the demo.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <DemoButton size="lg" variant="secondary" label="Start the demo" />
            <Button asChild size="lg" variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <Link href="/login">Create a free account</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
