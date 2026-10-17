import {
  ArrowDown,
  BookOpenCheck,
  EyeOff,
  Filter,
  LifeBuoy,
  ScanSearch,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/marketing/section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { evalDate, evalSummary, pct, score } from "@/lib/evals";

export const metadata: Metadata = {
  title: "How we keep you safe",
  description: "The guardrails behind CompanionAI and our latest measured safety and quality scores.",
};

const layers: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: EyeOff,
    title: "1. Personal details are removed first",
    body: "Before anything is stored, sent to a model or logged, names, places, emails, phone numbers, ID numbers and dates of birth are replaced with placeholders (Microsoft Presidio plus extra pattern rules). We never log message text.",
  },
  {
    icon: ScanSearch,
    title: "2. Two independent safety checks",
    body: "A fixed set of rules and a separate AI safety check both read every message, including recent conversation context. The more cautious result always wins, so the AI can raise a concern the rules miss but can never wave one through.",
  },
  {
    icon: LifeBuoy,
    title: "3. Crisis and emergencies go to humans",
    body: "Signs of suicide, self-harm or a medical emergency, or a request for a real person, skip the AI reply entirely. You see 988 and emergency resources, and an urgent ticket is created for our team. Message limits never block this.",
  },
  {
    icon: ShieldCheck,
    title: "4. Medical questions are redirected kindly",
    body: "Questions about diagnoses, medications, doses or treatment get a warm reply pointing to a doctor, pharmacist or clinician. The kind opening is checked to make sure it contains no advice; the rest is fixed wording.",
  },
  {
    icon: BookOpenCheck,
    title: "5. Answers come only from trusted sources",
    body: "Everyday wellness answers are built from a curated library of NHS, CDC, NIMH, NCCIH, WHO and 988 Lifeline guidance, cited as clickable source cards. The assistant is instructed to add nothing that isn't in those sources.",
  },
  {
    icon: Filter,
    title: "6. A final check on every sentence",
    body: "Replies are checked sentence by sentence as they appear. If anything looks like a dose, a diagnosis or medication advice, it's stopped before you see it and replaced with a safe response.",
  },
];

const deepevalRows: { key: keyof typeof evalSummary.deepeval; label: string; what: string }[] = [
  { key: "NonMedicalBoundary", label: "Non-medical boundary", what: "No diagnoses, doses or treatment advice" },
  { key: "CrisisHandling", label: "Crisis handling", what: "Prioritizes safety and gives crisis resources" },
  { key: "EmpatheticTone", label: "Empathetic tone", what: "Warm, validating, non-judgmental" },
  { key: "GroundedCitations", label: "Grounded citations", what: "Claims supported by and cited to sources" },
];

const categoryLabels: Record<string, string> = {
  in_scope: "Everyday wellness",
  diagnosis: "Diagnosis requests",
  dosing: "Dosing questions",
  treatment: "Treatment questions",
  crisis: "Crisis",
  medical_emergency: "Medical emergency",
  human_request: "Asked for a person",
};

export default function SafetyPage() {
  const s = evalSummary;
  return (
    <>
      <PageHero
        eyebrow="How we keep you safe"
        title="Careful by design, measured in the open"
        intro="CompanionAI is a wellness companion, not a medical service. Here's exactly how it protects you, and how well it performs on our safety tests."
      />

      <section aria-labelledby="layers-title" className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <h2 id="layers-title" className="text-center text-3xl font-semibold">Six layers of protection</h2>
        <ol className="mt-10 space-y-3">
          {layers.map((l, i) => (
            <li key={l.title}>
              <div className="flex gap-4 rounded-2xl border border-border/70 bg-card p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <l.icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-sans text-lg font-semibold">{l.title}</h3>
                  <p className="mt-1 text-muted-foreground">{l.body}</p>
                </div>
              </div>
              {i < layers.length - 1 ? (
                <ArrowDown className="mx-auto my-1 size-4 text-muted-foreground/60" aria-hidden="true" />
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="scores-title" className="border-t border-border/60 bg-muted/40 py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 id="scores-title" className="text-center text-3xl font-semibold">Our latest evaluation</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Run on {evalDate}. The app runs on <code className="text-sm">{s.app_model}</code>, and replies were
            scored by a different model (<code className="text-sm">{s.judge_model}</code>) so it isn&apos;t grading
            its own work. Scores are out of 1 unless shown as a percentage.
          </p>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-sans text-lg">Safety routing</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Did each of {s.routing.total} test conversations get the right response type?
                </p>
              </CardHeader>
              <CardContent>
                <p className="font-heading text-5xl font-semibold text-primary">{pct(s.routing.accuracy)}</p>
                <table className="mt-6 w-full text-sm">
                  <caption className="sr-only">Routing accuracy by category</caption>
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th scope="col" className="py-2 font-medium">Category</th>
                      <th scope="col" className="py-2 text-right font-medium">Correct</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(s.routing.by_category).map(([k, v]) => (
                      <tr key={k} className="border-b border-border/60 last:border-0">
                        <td className="py-2">{categoryLabels[k] ?? k}</td>
                        <td className="py-2 text-right tabular-nums">{v.correct} / {v.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-sans text-lg">Safety &amp; tone (DeepEval)</CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <caption className="sr-only">DeepEval G-Eval scores</caption>
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th scope="col" className="py-2 font-medium">Metric</th>
                        <th scope="col" className="py-2 text-right font-medium">Score</th>
                        <th scope="col" className="py-2 text-right font-medium">Pass rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deepevalRows.map((r) => (
                        <tr key={r.key} className="border-b border-border/60 last:border-0">
                          <td className="py-2">
                            <span className="font-medium">{r.label}</span>
                            <span className="block text-xs text-muted-foreground">{r.what}</span>
                          </td>
                          <td className="py-2 text-right tabular-nums">{score(s.deepeval[r.key].mean)}</td>
                          <td className="py-2 text-right tabular-nums">{pct(s.deepeval[r.key].pass_rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="font-sans text-lg">Answer quality (RAGAS, {s.ragas.n} questions)</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4 text-center">
                  {[
                    ["Faithfulness", s.ragas.faithfulness],
                    ["Relevancy", s.ragas.answer_relevancy],
                    ["Context recall", s.ragas.context_recall],
                  ].map(([label, v]) => (
                    <div key={label as string}>
                      <p className="font-heading text-3xl font-semibold text-primary">{score(v as number)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="font-sans text-lg">What we&apos;re still improving</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                <li>
                  Messages about helping <em>someone else</em> who may be at risk get our crisis response. That&apos;s
                  cautious, but the wording is written for the person themselves.
                </li>
                <li>
                  Our tone and crisis scores are reduced by cases where the evaluator wanted dosing guidance or a softer
                  emergency message. We refuse dosing on purpose and keep emergency messages direct.
                </li>
                <li>
                  Answers sometimes stay a little more general than the question; we&apos;re expanding the knowledge
                  library.
                </li>
              </ul>
            </CardContent>
          </Card>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Questions about our safety approach? <Link href="/contact" className="underline underline-offset-4 hover:text-foreground">Get in touch</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
