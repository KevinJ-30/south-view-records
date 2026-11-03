import type { ReactNode } from "react";
import { usePageTitle } from "@/hooks/use-page-title";

export const METHODS_PATH = "/methods";

/** A short, plain-language account of how the ledgers were transcribed. */
export function MethodsPage() {
  usePageTitle("How these records were made");

  return (
    <article className="flex flex-col gap-6">
      <h1 tabIndex={-1} className="font-heading text-3xl font-semibold text-foreground outline-none">
        How these records were made
      </h1>

      <Section title="Scanning the ledgers">
        We scanned the ledgers and split each two-page spread into single pages, cropping carefully so no columns were
        cut off and the writing near the binding was kept. We also made grayscale and simplified-color copies of each
        page to help with faded handwriting, and kept the original color scans.
      </Section>

      <Section title="Reading the handwriting">
        An AI model that can read images transcribed each page, zooming in on hard-to-read parts. It was given detailed
        instructions about how the ledger is laid out and what each column means, plus a few examples from records we’d
        already transcribed. Names and values are kept exactly as written, in the same order as the page. Anything it
        couldn’t read clearly, couldn’t read at all, or had to work out is marked, and those marks are the highlighted
        “uncertain” values you’ll see on the site.
      </Section>

      <Section title="Checking the results">
        We combined all the pages and checked them for consistency. We only made small, careful fixes, like filling a gap
        the ledger itself supports or tidying formatting, and logged every change. Where something was truly unclear, we
        left it unclear rather than guess.
      </Section>

      <Section title="A note on accuracy">
        These are AI-assisted transcriptions, not a verified reading of the original ledgers. They’re a good place to
        start, but if a record matters to you, it’s worth checking against the ledger itself.
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-heading text-xl font-semibold text-foreground">{title}</h2>
      <p className="leading-relaxed">{children}</p>
    </section>
  );
}
