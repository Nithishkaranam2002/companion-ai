import type { Metadata } from "next";
import { Suspense } from "react";

import { ContactForm } from "@/components/marketing/contact-form";
import { PageHero } from "@/components/marketing/section";
import { Disclaimer } from "@/components/site/disclaimer";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the CompanionAI team.",
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="We'd love to hear from you"
        intro="Questions, feedback, waitlist requests, or partnership ideas. We read every message and reply by email, usually within two business days."
      />
      <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <div className="mb-8 flex justify-center">
          <Disclaimer />
        </div>
        <Suspense fallback={<div className="h-[34rem] animate-pulse rounded-2xl border bg-card" aria-hidden="true" />}>
          <ContactForm />
        </Suspense>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          This form isn&apos;t monitored around the clock. If you or someone else is in danger, call or text 988
          (US) or your local emergency number.
        </p>
      </div>
    </>
  );
}
