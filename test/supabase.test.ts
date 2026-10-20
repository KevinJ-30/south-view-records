import { describe, expect, it } from "vitest";
import { rowToBurial, type BurialRow } from "../src/data/supabase.js";

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
