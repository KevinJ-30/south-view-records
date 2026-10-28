import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import { createMemoryRepository } from "./burials.js";
import { UNCERTAIN_FIELD_NAMES } from "./load.js";
import { InvalidRecord, type Burial, type BurialInput, type BurialRepository } from "./types.js";

const TABLE = "burial_records";
/** Supabase returns at most 1000 rows per request, so rows are fetched in pages. */
const PAGE_SIZE = 1000;
/**
 * How long a server instance serves its copy of the table before reading it again.
 * Vercel runs several instances, so an edit made through one reaches the others within this time.
 */
const REFRESH_MS = 60_000;

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

/** API field name -> the ledger name stored in uncertain_fields ("nameAsWritten" -> "name"). */
const LEDGER_FIELD_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(UNCERTAIN_FIELD_NAMES)
    .reverse()
    .map(([ledgerName, apiName]) => [apiName, ledgerName]),
);

function wholeNumber(label: string, value: string | null): number | null {
  if (value === null) return null;
  if (!/^\d+$/.test(value)) throw new InvalidRecord(`${label} must be a whole number, got "${value}".`);
  return Number(value);
}

/** Reverses ageUnderOneYear: "3 months", "7 days", "1 month 2 days". A bare number is months, as in load_burial_records.sql. */
export function splitAgeUnderOneYear(value: string | null): { age_months: number | null; age_days: number | null } {
  if (value === null) return { age_months: null, age_days: null };
  if (/^\d+$/.test(value)) return { age_months: Number(value), age_days: null };
  const match = /^(?:(\d+)\s*months?)?\s*(?:(\d+)\s*days?)?$/i.exec(value.trim());
  if (!match || (!match[1] && !match[2])) {
    throw new InvalidRecord(`Age in months or days must look like "3 months", "7 days" or "1 month 2 days", got "${value}".`);
  }
  return { age_months: match[1] ? Number(match[1]) : null, age_days: match[2] ? Number(match[2]) : null };
}

/** Maps a Burial to the burial_records columns, without index_record. */
export function burialToRow(input: BurialInput): Omit<BurialRow, "index_record"> {
  return {
    ledger_page: input.sourcePage,
    line_on_page: input.lineOnPage,
    entry_number: wholeNumber("Entry number", input.entryNo),
    name_as_written: input.nameAsWritten,
    is_infant_of_parent: input.isInfantOf,
    burial_date: input.burialDate,
    age_years: wholeNumber("Age in years", input.ageYears),
    ...splitAgeUnderOneYear(input.ageMonthsOrDays),
    plat: input.plat,
    section: wholeNumber("Section", input.section),
    block: wholeNumber("Block", input.block),
    lot: input.lot,
    range: input.range,
    grave: wholeNumber("Grave", input.grave),
    uncertain_fields: input.uncertainFields.map((name) => LEDGER_FIELD_NAMES[name] ?? name),
    transcriber_note: input.transcriberNote,
  };
}

/** Plain-language versions of the check constraints on burial_records. */
const CHECK_MESSAGES: Record<string, string> = {
  burial_records_age_years_range: "Age in years must be between 0 and 130.",
  burial_records_block_positive: "Block must be a whole number of 1 or more.",
  burial_records_entry_number_positive: "Entry number must be a whole number of 1 or more.",
  burial_records_grave_positive: "Grave must be a whole number of 1 or more.",
  burial_records_ledger_page_positive: "Ledger page must be a whole number of 1 or more.",
  burial_records_line_on_page_positive: "Line on page must be a whole number of 1 or more.",
  burial_records_name_as_written_nonempty: "Name as written can't be blank.",
  burial_records_plat_format: "Plat may only use capital letters and digits, e.g. VR.",
  burial_records_range_format: "Range may only use capital letters, e.g. B.",
  burial_records_section_positive: "Section must be a whole number of 1 or more.",
};

/** Bad values and broken constraints are the editor's to fix (400); anything else is a server problem. */
export function writeError(action: string, error: PostgrestError): Error {
  if (error.code === "23505") return new InvalidRecord("Another record already uses that ledger page and line.");
  if (error.code === "23514") {
    const constraint = /check constraint "([^"]+)"/.exec(error.message)?.[1] ?? "";
    return new InvalidRecord(CHECK_MESSAGES[constraint] ?? `A value breaks the table's rule "${constraint}".`);
  }
  if (/^2[23]/.test(error.code)) return new InvalidRecord(error.message);
  return new Error(`Supabase: could not ${action}: ${error.message}`);
}

async function fetchAllRows(client: SupabaseClient): Promise<Burial[]> {
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
  return rows.map(rowToBurial);
}

/**
 * Reads every row of burial_records into memory and searches it like the CSV version,
 * re-reading the table every REFRESH_MS. Writes go straight to Supabase, then the copy is re-read.
 */
export async function loadBurialsFromSupabase(url: string, key: string): Promise<BurialRepository> {
  const client = createClient(url, key, { auth: { persistSession: false } });
  let cache = createMemoryRepository(await fetchAllRows(client));
  let loadedAt = Date.now();
  let refreshing: Promise<void> | null = null;

  const reload = async () => {
    cache = createMemoryRepository(await fetchAllRows(client));
    loadedAt = Date.now();
  };

  const current = async () => {
    if (Date.now() - loadedAt > REFRESH_MS) {
      // If Supabase is unreachable, keep serving the last copy rather than failing searches.
      refreshing ??= reload()
        .catch((error) => console.error(error))
        .finally(() => {
          refreshing = null;
        });
      await refreshing;
    }
    return cache;
  };

  return {
    search: async (params) => (await current()).search(params),
    getById: async (id) => (await current()).getById(id),
    stats: async () => (await current()).stats(),

    async create(input) {
      const row = burialToRow(input);
      const last = await client.from(TABLE).select("index_record").order("index_record", { ascending: false }).limit(1);
      if (last.error) throw writeError("add the record", last.error);
      const id = ((last.data[0] as { index_record: number } | undefined)?.index_record ?? 0) + 1;
      const { data, error } = await client
        .from(TABLE)
        .insert({ index_record: id, ...row })
        .select()
        .single();
      if (error) throw writeError("add the record", error);
      await reload();
      return rowToBurial(data as BurialRow);
    },

    async update(id, input) {
      const { data, error } = await client.from(TABLE).update(burialToRow(input)).eq("index_record", id).select();
      if (error) throw writeError("save the record", error);
      await reload();
      return data.length ? rowToBurial(data[0] as BurialRow) : null;
    },

    async remove(id) {
      const { data, error } = await client.from(TABLE).delete().eq("index_record", id).select("index_record");
      if (error) throw writeError("delete the record", error);
      await reload();
      return data.length > 0;
    },
  };
}
