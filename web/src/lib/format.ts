import type { Burial } from "@/lib/api";

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });
const monthFormat = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** "1905-10-12" -> "October 12, 1905". Dates are calendar days, so format in UTC. */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(`${iso}T00:00:00Z`));
}

/** "1905-10" -> "October 1905". */
export function formatMonth(month: string): string {
  return monthFormat.format(new Date(`${month}-01T00:00:00Z`));
}

/**
 * Short age for result lists, from the ledger's two age columns. Values are shown as
 * written; a bare number in the months-or-days column has no unit in the ledger.
 */
export function formatAge(burial: Pick<Burial, "ageYears" | "ageMonthsOrDays">): string | null {
  const parts: string[] = [];
  if (burial.ageYears) {
    parts.push(/^\d+$/.test(burial.ageYears) ? `${burial.ageYears} ${burial.ageYears === "1" ? "year" : "years"}` : burial.ageYears);
  }
  if (burial.ageMonthsOrDays) {
    parts.push(/^\d+$/.test(burial.ageMonthsOrDays) ? `${burial.ageMonthsOrDays} (months or days)` : burial.ageMonthsOrDays);
  }
  return parts.length ? parts.join(", ") : null;
}

/** "Ledger page 6, entry 872", or the line number when the ledger has no entry number. */
export function formatCitation(burial: Pick<Burial, "sourcePage" | "lineOnPage" | "entryNo">): string {
  const page = burial.sourcePage === null ? "Ledger page not recorded" : `Ledger page ${burial.sourcePage}`;
  return burial.entryNo ? `${page}, entry ${burial.entryNo}` : `${page}, line ${burial.lineOnPage} (no entry number)`;
}

export const LOCATION_FIELDS = [
  ["section", "Section"],
  ["block", "Block"],
  ["lot", "Lot"],
  ["range", "Range"],
  ["grave", "Grave"],
] as const satisfies readonly (readonly [keyof Burial, string])[];
