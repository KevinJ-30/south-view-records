import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseCsv } from "./csv.js";
import type { Burial, UncertainField } from "./types.js";

export const CSV_COLUMNS = [
  "id",
  "source_page",
  "line_on_page",
  "entry_no",
  "name_as_written",
  "is_infant_of",
  "burial_date",
  "age_years",
  "age_months_or_days",
  "plat",
  "section",
  "block",
  "lot",
  "range",
  "grave",
  "uncertain_fields",
  "transcriber_note",
] as const;

type Column = (typeof CSV_COLUMNS)[number];

/**
 * Ledger field names used in uncertain_fields, mapped to API field names. When two names map
 * to one field, the first is the one written back to Supabase.
 */
export const UNCERTAIN_FIELD_NAMES: Record<string, UncertainField> = {
  name: "nameAsWritten",
  name_as_written: "nameAsWritten",
  entry_number: "entryNo",
  entry_no: "entryNo",
  burial_date: "burialDate",
  date: "burialDate",
  age_years: "ageYears",
  age_months_or_days: "ageMonthsOrDays",
  plat: "plat",
  section: "section",
  block: "block",
  lot: "lot",
  range: "range",
  grave: "grave",
  ledger_page: "sourcePage",
  source_page: "sourcePage",
  extra_marks: "extraMarks",
};

export class CsvFormatError extends Error {
  constructor(source: string, line: number | null, message: string) {
    super(line === null ? `${source}: ${message}` : `${source}, line ${line}: ${message}`);
    this.name = "CsvFormatError";
  }
}

/** Parses one ledger CSV. Throws CsvFormatError naming the file and line on bad input. */
export function parseBurialCsv(text: string, source: string): Burial[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new CsvFormatError(source, null, "file is empty");
  const columns = header.map((name) => name.trim());
  if (columns.join(",") !== CSV_COLUMNS.join(",")) {
    throw new CsvFormatError(
      source,
      1,
      `expected columns ${CSV_COLUMNS.join(",")} but found ${columns.join(",")}`,
    );
  }

  return rows.map((cells, index) => {
    const line = index + 2;
    if (cells.length !== CSV_COLUMNS.length) {
      throw new CsvFormatError(source, line, `expected ${CSV_COLUMNS.length} fields, found ${cells.length}`);
    }
    const value = (column: Column) => cells[CSV_COLUMNS.indexOf(column)].trim();
    const optional = (column: Column) => value(column) || null;
    const integer = (column: Column) => {
      const raw = value(column);
      if (!/^\d+$/.test(raw)) throw new CsvFormatError(source, line, `${column} must be a whole number, got "${raw}"`);
      return Number(raw);
    };

    const infant = value("is_infant_of").toLowerCase();
    if (infant !== "yes" && infant !== "no") {
      throw new CsvFormatError(source, line, `is_infant_of must be yes or no, got "${value("is_infant_of")}"`);
    }
    const burialDate = optional("burial_date");
    if (burialDate !== null && !isIsoDate(burialDate)) {
      throw new CsvFormatError(source, line, `burial_date must be YYYY-MM-DD, got "${burialDate}"`);
    }
    const nameAsWritten = value("name_as_written");
    if (!nameAsWritten) throw new CsvFormatError(source, line, "name_as_written is blank");

    return {
      id: integer("id"),
      sourcePage: integer("source_page"),
      lineOnPage: integer("line_on_page"),
      entryNo: optional("entry_no"),
      nameAsWritten,
      isInfantOf: infant === "yes",
      burialDate,
      ageYears: optional("age_years"),
      ageMonthsOrDays: optional("age_months_or_days"),
      plat: optional("plat"),
      section: optional("section"),
      block: optional("block"),
      lot: optional("lot"),
      range: optional("range"),
      grave: optional("grave"),
      uncertainFields: value("uncertain_fields")
        .split(";")
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => UNCERTAIN_FIELD_NAMES[name.toLowerCase()] ?? name),
      transcriberNote: optional("transcriber_note"),
    };
  });
}

/**
 * Loads every *.csv in a directory, in filename order. Rows are keyed by id, so
 * loading the same file twice, or a corrected re-export of a page, never duplicates
 * a burial: a later file's row replaces an earlier one with the same id.
 */
export async function loadBurialDirectory(dir: string): Promise<Burial[]> {
  const names = (await readdir(dir)).filter((name) => name.toLowerCase().endsWith(".csv")).sort();
  const files = await Promise.all(
    names.map(async (name) => parseBurialCsv(await readFile(path.join(dir, name), "utf8"), name)),
  );
  return mergeById(files.flat());
}

export function mergeById(burials: Burial[]): Burial[] {
  const byId = new Map<number, Burial>();
  for (const burial of burials) byId.set(burial.id, burial);
  return [...byId.values()];
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
