import type { ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";

const LABEL = "Uncertain reading";
const DETAIL = "The transcriber could not read this clearly in the handwritten ledger.";

/**
 * Wraps a ledger value the transcriber was unsure about: dotted underline, plus an
 * explanation on hover, keyboard focus, or tap. Use `static` inside links, where a
 * nested button is not allowed; it falls back to a native title and screen-reader text.
 */
export function Uncertain({
  uncertain,
  children,
  static: isStatic = false,
}: {
  uncertain: boolean;
  children: ReactNode;
  static?: boolean;
}) {
  if (!uncertain) return <>{children}</>;

  if (isStatic) {
    return (
      <span className="uncertain" title={LABEL}>
        {children}
        <span className="sr-only"> ({LABEL.toLowerCase()})</span>
      </span>
    );
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={100}
        className="uncertain cursor-help rounded-sm text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {children}
        <span className="sr-only"> ({LABEL.toLowerCase()})</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} className="z-50">
          <Popover.Popup className="max-w-64 rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground">
            <Popover.Title className="font-medium">{LABEL}</Popover.Title>
            <Popover.Description className="text-muted-foreground">{DETAIL}</Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function UncertainLegend({ className }: { className?: string }) {
  return (
    <p className={className}>
      <span className="uncertain">Dotted underline</span> = uncertain reading in the original ledger.
    </p>
  );
}
