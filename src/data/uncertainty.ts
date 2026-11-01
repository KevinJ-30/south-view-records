import type { Burial, UncertainField } from "./types.js";

/** Kinds of uncertain reading, by the fields each covers. Keep in sync with web/src/lib/uncertainty.ts. */
export const UNCERTAINTY_TYPES = {
  name: ["nameAsWritten"],
  date: ["burialDate"],
  age: ["ageYears", "ageMonthsOrDays"],
  location: ["plat", "section", "block", "lot", "range", "grave"],
  entry: ["entryNo", "sourcePage"],
  marks: ["extraMarks"],
} as const satisfies Record<string, readonly UncertainField[]>;

export type UncertaintyType = keyof typeof UNCERTAINTY_TYPES;

/** "any" or "none" uncertain readings, or one kind of uncertain reading. */
export type UncertaintyFilter = "any" | "none" | UncertaintyType;

export const UNCERTAINTY_FILTERS = ["any", "none", ...Object.keys(UNCERTAINTY_TYPES)] as UncertaintyFilter[];

export function matchesUncertainty(burial: Burial, filter: UncertaintyFilter): boolean {
  if (filter === "any") return burial.uncertainFields.length > 0;
  if (filter === "none") return burial.uncertainFields.length === 0;
  const fields: readonly string[] = UNCERTAINTY_TYPES[filter];
  return burial.uncertainFields.some((field) => fields.includes(field));
}
