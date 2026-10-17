import { ArrowLeft, Compass } from "lucide-react";
import Link from "next/link";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-24">
        <div className="max-w-md animate-fade-up text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-secondary">
            <Compass className="size-7 text-primary" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-primary">404</p>
          <h1 className="mt-2 text-4xl font-semibold">This path doesn&apos;t lead anywhere</h1>
          <p className="mt-4 text-muted-foreground">
            The page you were looking for has moved or never existed. Take a breath — let&apos;s get
            you back somewhere familiar.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/">
                <ArrowLeft className="size-4" /> Back home
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact">Contact us</Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
