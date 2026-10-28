import type { ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import { CircleHelpIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { kindOfField, uncertainKinds, type UncertaintyKind } from "@/lib/uncertainty";
import type { Burial } from "@/lib/api";

const GENERIC_DETAIL = "The transcriber couldn’t read this clearly in the handwritten ledger.";

/**
 * Wraps a ledger value the transcriber was unsure about: a tint and dotted underline in
 * the color for its kind (name, date, age, plot, entry), a "?" mark, and an explanation
 * on hover, keyboard focus, or tap. `field` is the Burial field shown, which sets the kind.
 * Use `static` inside links, where a nested button is not allowed; it falls back to a
 * native title and screen-reader text.
 */
export function Uncertain({
  uncertain,
  field,
  children,
  static: isStatic = false,
}: {
  uncertain: boolean;
  field: string;
  children: ReactNode;
  static?: boolean;
}) {
  if (!uncertain) return <>{children}</>;

  const kind = kindOfField(field);
  const label = kind ? `Uncertain ${kind.label.toLowerCase()}` : "Uncertain reading";
  const marked = (
    <>
      {children}
      <CircleHelpIcon aria-hidden="true" className="uncertainty-ink ml-1 inline size-[0.85em] align-[-0.1em]" />
      <span className="sr-only"> ({label.toLowerCase()})</span>
    </>
  );

  if (isStatic) {
    return (
      <span className="uncertain" data-uncertainty={kind?.id} title={label}>
        {marked}
      </span>
    );
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={100}
        data-uncertainty={kind?.id}
        className="uncertain cursor-help text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {marked}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} className="z-50">
          <Popover.Popup className="max-w-64 rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground">
            <Popover.Title className="font-medium">{label}</Popover.Title>
            <Popover.Description className="text-muted-foreground">{kind?.detail ?? GENERIC_DETAIL}</Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** A colored tag such as "Name uncertain", with the kind's icon. */
export function UncertaintyTag({ kind, className }: { kind: UncertaintyKind; className?: string }) {
  const Icon = kind.icon;
  return (
    <span
      data-uncertainty={kind.id}
      className={cn(
        "uncertainty-tag inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {kind.label} uncertain
    </span>
  );
}

/** Explains the marks above a list of results that includes uncertain readings. */
export function UncertainLegend({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 rounded-xl border border-gold bg-card px-4 py-3 text-sm", className)}>
      <CircleHelpIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gold-ink" />
      <span>
        Values <span className="uncertain">highlighted with a ?</span> were hard to read in the handwritten ledger.
        Colored tags on each record show which part is uncertain.
      </span>
    </p>
  );
}

/** A prominent box at the top of a record listing what the transcriber was unsure about. */
export function RecordUncertainty({ burial }: { burial: Pick<Burial, "uncertainFields"> }) {
  const kinds = uncertainKinds(burial);
  if (burial.uncertainFields.length === 0) return null;
  return (
    <section aria-labelledby="uncertainty" className="rounded-2xl border-2 border-gold bg-card px-5 py-4">
      <h2 id="uncertainty" className="flex items-center gap-2 font-medium">
        <CircleHelpIcon aria-hidden="true" className="size-5 shrink-0 text-gold-ink" />
        Parts of this record were hard to read
      </h2>
      <p className="mt-1 text-muted-foreground">
        The transcriber marked these as uncertain. Below, they are highlighted and marked with a ?.
      </p>
      {kinds.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {kinds.map((kind) => (
            <li key={kind.id}>
              <UncertaintyTag kind={kind} className="text-sm" />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
