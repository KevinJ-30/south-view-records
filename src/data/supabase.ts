import { createClient } from "@supabase/supabase-js";
import { createMemoryRepository } from "./burials.js";
import { UNCERTAIN_FIELD_NAMES } from "./load.js";
import type { Burial, BurialRepository } from "./types.js";

const TABLE = "burial_records";
/** Supabase returns at most 1000 rows per request, so rows are fetched in pages. */
const PAGE_SIZE = 1000;

/** A row of public.burial_records as Supabase returns it. */
export type BurialRow = {
  index_record: number;
  ledger_page: number;
  line_on_page: number;
  entry_number: number | null;
  name_as_written: string;
  is_infant_of_parent: boolean;
  burial_date: string | null;
  age_years: number | null;
  age_months: number | null;
  age_days: number | null;
  plat: string | null;
  section: number | string | null;
  block: number | string | null;
  lot: number | string | null;
  range: string | null;
  grave: number | string | null;
  uncertain_fields?: string[] | null;
  transcriber_note: string | null;
};

const text = (value: number | string | null | undefined): string | null => {
  const trimmed = value === null || value === undefined ? "" : String(value).trim();
  return trimmed || null;
};

/** "1 month", "3 months", "7 days": the way the ledger writes ages under a year. */
function ageUnderOneYear(months: number | null, days: number | null): string | null {
  if (months !== null && days !== null) return `${months} ${months === 1 ? "month" : "months"} ${days} ${days === 1 ? "day" : "days"}`;
  if (months !== null) return `${months} ${months === 1 ? "month" : "months"}`;
  if (days !== null) return `${days} ${days === 1 ? "day" : "days"}`;
  return null;
}

/** Maps a burial_records row to the API's Burial. The record id is index_record, the id used in the CSVs. */
export function rowToBurial(row: BurialRow): Burial {
  return {
    id: row.index_record,
    sourcePage: row.ledger_page,
    lineOnPage: row.line_on_page,
    entryNo: text(row.entry_number),
    nameAsWritten: row.name_as_written,
    isInfantOf: row.is_infant_of_parent,
    burialDate: row.burial_date,
    ageYears: text(row.age_years),
    ageMonthsOrDays: ageUnderOneYear(row.age_months, row.age_days),
    plat: text(row.plat),
    section: text(row.section),
    block: text(row.block),
    lot: text(row.lot),
    range: text(row.range),
    grave: text(row.grave),
    uncertainFields: (row.uncertain_fields ?? []).map((name) => UNCERTAIN_FIELD_NAMES[name.toLowerCase()] ?? name),
    transcriberNote: text(row.transcriber_note),
  };
}

/** Reads every row of burial_records from Supabase once, then serves from memory like the CSV version. */
export async function loadBurialsFromSupabase(url: string, key: string): Promise<BurialRepository> {
  const client = createClient(url, key, { auth: { persistSession: false } });
  const rows: BurialRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(TABLE)
      .select("*")
      .order("index_record")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Supabase: could not read ${TABLE}: ${error.message}`);
    rows.push(...(data as BurialRow[]));
    if (data.length < PAGE_SIZE) break;
  }

  return createMemoryRepository(rows.map(rowToBurial));
}
