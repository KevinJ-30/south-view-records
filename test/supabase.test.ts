import { describe, expect, it } from "vitest";
import { burialToRow, rowToBurial, splitAgeUnderOneYear, type BurialRow } from "../src/data/supabase.js";
import { InvalidRecord } from "../src/data/types.js";

const row: BurialRow = {
  index_record: 6,
  ledger_page: 6,
  line_on_page: 6,
  entry_number: 868,
  name_as_written: "Jno. Harris",
  is_infant_of_parent: false,
  burial_date: "1905-10-11",
  age_years: 93,
  age_months: null,
  age_days: null,
  plat: "VR",
  section: 1,
  block: 3,
  lot: 23,
  range: "B",
  grave: 1,
  uncertain_fields: ["name", "lot"],
  transcriber_note: "Plat code struck through",
};

describe("rowToBurial", () => {
  it("maps a database row to a Burial", () => {
    expect(rowToBurial(row)).toEqual({
      id: 6,
      sourcePage: 6,
      lineOnPage: 6,
      entryNo: "868",
      nameAsWritten: "Jno. Harris",
      isInfantOf: false,
      burialDate: "1905-10-11",
      ageYears: "93",
      ageMonthsOrDays: null,
      plat: "VR",
      section: "1",
      block: "3",
      lot: "23",
      range: "B",
      grave: "1",
      uncertainFields: ["nameAsWritten", "lot"],
      transcriberNote: "Plat code struck through",
    });
  });

  it("turns missing values into null and writes under-a-year ages like the ledger", () => {
    const burial = rowToBurial({
      ...row,
      entry_number: null,
      range: null,
      age_years: null,
      age_days: 7,
      uncertain_fields: undefined,
      transcriber_note: null,
    });
    expect(burial.entryNo).toBeNull();
    expect(burial.range).toBeNull();
    expect(burial.ageYears).toBeNull();
    expect(burial.ageMonthsOrDays).toBe("7 days");
    expect(burial.uncertainFields).toEqual([]);
  });
});

describe("burialToRow", () => {
  it("round-trips through rowToBurial", () => {
    const burial = rowToBurial(row);
    const { id, ...input } = burial;
    const written = burialToRow(input);
    expect(written.uncertain_fields).toEqual(["name", "lot"]);
    expect(rowToBurial({ index_record: id, ...written })).toEqual(burial);
  });

  it("splits ages under a year back into months and days", () => {
    expect(splitAgeUnderOneYear("1 month 2 days")).toEqual({ age_months: 1, age_days: 2 });
    expect(splitAgeUnderOneYear("7 days")).toEqual({ age_months: null, age_days: 7 });
    expect(splitAgeUnderOneYear("3")).toEqual({ age_months: 3, age_days: null });
    expect(() => splitAgeUnderOneYear("about a week")).toThrow(InvalidRecord);
  });

  it("rejects numbers the table can't store", () => {
    const { id: _, ...input } = rowToBurial(row);
    expect(() => burialToRow({ ...input, ageYears: "abt. 40" })).toThrow(InvalidRecord);
  });
});
