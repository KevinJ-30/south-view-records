import { CalendarDaysIcon, HashIcon, HourglassIcon, MapPinIcon, PenLineIcon, UserRoundIcon, type LucideIcon } from "lucide-react";
import type { Burial } from "@/lib/api";

export type UncertaintyType = "name" | "date" | "age" | "location" | "entry" | "marks";

export type UncertaintyKind = {
  id: UncertaintyType;
  label: string;
  /** Burial fields this kind covers. */
  fields: readonly string[];
  icon: LucideIcon;
  detail: string;
  /** Tag text, when "<label> uncertain" doesn't read well. */
  tag?: string;
  /** Search filter option, when "Uncertain <label>" doesn't read well. */
  filter?: string;
};

/**
 * Kinds of uncertain reading, each with its own color (--uncertain-<id> in index.css) and icon.
 * Keep the ids and fields in sync with the backend's src/data/uncertainty.ts.
 */
export const UNCERTAINTY_KINDS: UncertaintyKind[] = [
  {
    id: "name",
    label: "Name",
    fields: ["nameAsWritten"],
    icon: UserRoundIcon,
    detail: "The transcriber couldn’t read the name clearly. Try other spellings when searching.",
  },
  {
    id: "date",
    label: "Burial date",
    fields: ["burialDate"],
    icon: CalendarDaysIcon,
    detail: "The transcriber couldn’t read the burial date clearly.",
  },
  {
    id: "age",
    label: "Age",
    fields: ["ageYears", "ageMonthsOrDays"],
    icon: HourglassIcon,
    detail: "The transcriber couldn’t read the age clearly.",
  },
  {
    id: "location",
    label: "Plot location",
    fields: ["plat", "section", "block", "lot", "range", "grave"],
    icon: MapPinIcon,
    detail: "The transcriber couldn’t read part of the plot location clearly.",
  },
  {
    id: "entry",
    label: "Ledger entry",
    fields: ["entryNo", "sourcePage"],
    icon: HashIcon,
    detail: "The transcriber couldn’t read the entry number or page number clearly.",
  },
  {
    id: "marks",
    label: "Extra marks",
    // Not a value on the record: stray writing, strike-throughs, or overlapping text on the row.
    fields: ["extraMarks"],
    icon: PenLineIcon,
    detail: "The row has stray writing, strike-throughs, or overlapping text, so read it with care.",
    tag: "Extra marks on row",
    filter: "Extra marks on the row",
  },
];

export function kindOfField(field: string): UncertaintyKind | undefined {
  return UNCERTAINTY_KINDS.find((kind) => kind.fields.includes(field));
}

/** The kinds of uncertain reading in a record, in a fixed order. */
export function uncertainKinds(burial: Pick<Burial, "uncertainFields">): UncertaintyKind[] {
  return UNCERTAINTY_KINDS.filter((kind) => kind.fields.some((field) => burial.uncertainFields.includes(field)));
}
