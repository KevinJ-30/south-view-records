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
  return burial.entryNo
    ? `Ledger page ${burial.sourcePage}, entry ${burial.entryNo}`
    : `Ledger page ${burial.sourcePage}, line ${burial.lineOnPage} (no entry number)`;
}

/** [6, 7, 8, 12] -> "pages 6–8, 12". */
export function formatPages(pages: number[]): string {
  const runs: string[] = [];
  for (let i = 0; i < pages.length; i += 1) {
    let end = i;
    while (end + 1 < pages.length && pages[end + 1] === pages[end] + 1) end += 1;
    runs.push(end > i ? `${pages[i]}–${pages[end]}` : `${pages[i]}`);
    i = end;
  }
  return `${pages.length === 1 ? "page" : "pages"} ${runs.join(", ")}`;
}

export const LOCATION_FIELDS = [
  ["section", "Section"],
  ["block", "Block"],
  ["lot", "Lot"],
  ["range", "Range"],
  ["grave", "Grave"],
] as const satisfies readonly (readonly [keyof Burial, string])[];
