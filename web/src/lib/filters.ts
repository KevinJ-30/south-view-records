/** Search filters kept in the /search URL, besides the name query and page. */
export const FILTERS = ["from", "to", "infant", "uncertain", "plat", "section", "block", "lot"] as const;

export type Filter = (typeof FILTERS)[number];

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export type DateBound = "from" | "to";
export type DateParts = { year: string; month: string; day: string };

/** "1905-10-07" -> { year: "1905", month: "10", day: "7" }, to fill the date fields from the URL. */
export function splitDate(iso: string | null): DateParts {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (!match) return { year: "", month: "", day: "" };
  return { year: match[1], month: String(Number(match[2])), day: String(Number(match[3])) };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Turns typed date parts into a YYYY-MM-DD bound. A blank day or month widens the bound to
 * cover the whole month or year: "From 1905" is 1905-01-01, "To October 1905" is 1905-10-31.
 */
export function partsToDate(parts: DateParts, bound: DateBound): { value: string | null; error: string | null } {
  const year = parts.year.trim();
  const day = parts.day.trim();
  const month = parts.month;
  if (!year && !month && !day) return { value: null, error: null };
  if (!year) return { value: null, error: "Enter a year, like 1905." };
  if (!/^\d{4}$/.test(year)) return { value: null, error: "Enter the year as 4 digits, like 1905." };
  if (day && !month) return { value: null, error: "Choose a month for this day." };
  if (day && !/^\d{1,2}$/.test(day)) return { value: null, error: "Enter the day as a number, like 12." };

  const monthNumber = month ? Number(month) : bound === "from" ? 1 : 12;
  const lastDay = daysInMonth(Number(year), monthNumber);
  if (day && (Number(day) < 1 || Number(day) > lastDay)) {
    return { value: null, error: `Enter a day from 1 to ${lastDay}. ${MONTHS[monthNumber - 1]} ${year} has ${lastDay} days.` };
  }
  const dayNumber = day ? Number(day) : bound === "from" ? 1 : lastDay;
  return { value: `${year}-${pad(monthNumber)}-${pad(dayNumber)}`, error: null };
}

/** Reads the filter fields of a search form, checking the dates. */
export function readFilters(form: FormData): {
  values: Partial<Record<Filter, string>>;
  errors: Partial<Record<DateBound, string>>;
} {
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const values: Partial<Record<Filter, string>> = {};
  const errors: Partial<Record<DateBound, string>> = {};

  for (const bound of ["from", "to"] as const) {
    const parts = { year: text(`${bound}Year`), month: text(`${bound}Month`), day: text(`${bound}Day`) };
    const { value, error } = partsToDate(parts, bound);
    if (error) errors[bound] = error;
    else if (value) values[bound] = value;
  }
  if (values.from && values.to && values.from > values.to) {
    errors.to = "This is before the “From” date. Check the order of the two dates.";
  }

  for (const name of ["infant", "uncertain", "plat", "section", "block", "lot"] as const) {
    if (text(name)) values[name] = text(name);
  }
  return { values, errors };
}
