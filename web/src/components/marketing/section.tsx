import { cn } from "@/lib/utils";

export function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20 py-20 sm:py-24", className)} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          {eyebrow ? <p className="text-sm font-medium uppercase tracking-widest text-primary">{eyebrow}</p> : null}
          <h2 id={id ? `${id}-title` : undefined} className="mt-3 text-3xl font-semibold sm:text-4xl">
            {title}
          </h2>
          {intro ? <p className="mt-4 text-lg text-muted-foreground">{intro}</p> : null}
        </div>
        <div className="mt-14">{children}</div>
      </div>
    </section>
  );
}

export function PageHero({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <div className="border-b border-border/60 bg-gradient-to-b from-secondary/60 to-background">
      <div className="mx-auto max-w-3xl animate-fade-up px-4 py-16 text-center sm:px-6 sm:py-20">
        <p className="text-sm font-medium uppercase tracking-widest text-primary">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">{title}</h1>
        <p className="mt-5 text-lg text-muted-foreground">{intro}</p>
      </div>
    </div>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:mt-2 [&_p]:mt-4 [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-muted-foreground">
      {children}
    </div>
  );
}
