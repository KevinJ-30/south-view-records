import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_DATA_DIR } from "../src/data/burials.js";
import { CSV_COLUMNS, loadBurialDirectory, parseBurialCsv } from "../src/data/load.js";

const SEED = path.join(DEFAULT_DATA_DIR, "south-view-1905-sample.csv");
const HEADER = CSV_COLUMNS.join(",");

async function seedText() {
  return readFile(SEED, "utf8");
}

describe("parseBurialCsv", () => {
  it("loads every seed row exactly as written", async () => {
    const burials = parseBurialCsv(await seedText(), "seed.csv");
    expect(burials).toHaveLength(83);

    const byId = new Map(burials.map((b) => [b.id, b]));
    expect(byId.get(23)?.nameAsWritten).toBe("Charls Cartwright");
    expect(byId.get(10)).toMatchObject({
      sourcePage: 6,
      entryNo: "872",
      burialDate: "1905-10-12",
      ageYears: "40",
      plat: "VR",
      section: "1",
      block: "1",
      lot: "5",
      range: "J",
      grave: "15",
    });
    expect(byId.get(5)).toMatchObject({ isInfantOf: true, ageMonthsOrDays: "7 days", ageYears: null });
    expect(byId.get(56)?.lot).toBe("Hunter");
    expect(byId.get(80)?.lot).toBe("Club");
  });

  it("keeps blanks as null and quoted notes intact", async () => {
    const byId = new Map(parseBurialCsv(await seedText(), "seed.csv").map((b) => [b.id, b]));
    expect(byId.get(41)).toMatchObject({
      entryNo: null,
      transcriberNote: 'Listed under margin note "By Cert." [?]; no entry number',
    });
    expect(byId.get(42)).toMatchObject({ burialDate: null, range: null });
  });

  it("maps uncertain field names to API field names", async () => {
    const byId = new Map(parseBurialCsv(await seedText(), "seed.csv").map((b) => [b.id, b]));
    expect(byId.get(6)?.uncertainFields).toEqual(["nameAsWritten", "lot"]);
    expect(byId.get(51)?.uncertainFields).toEqual(["nameAsWritten", "ageYears", "range"]);
    expect(byId.get(10)?.uncertainFields).toEqual([]);
  });

  it("rejects a file with the wrong columns", () => {
    expect(() => parseBurialCsv("id,name\n1,X\n", "bad.csv")).toThrow(/bad\.csv, line 1: expected columns/);
  });

  it("names the file and line of a bad value", () => {
    const row = "1,6,1,862,B.F. Simpson,maybe,1905-10-10,38,,VR,1,1,5,M,16,,";
    expect(() => parseBurialCsv(`${HEADER}\n${row}\n`, "page6.csv")).toThrow(/page6\.csv, line 2: is_infant_of/);
    const badDate = "1,6,1,862,B.F. Simpson,no,1905-13-40,38,,VR,1,1,5,M,16,,";
    expect(() => parseBurialCsv(`${HEADER}\n${badDate}\n`, "page6.csv")).toThrow(/burial_date/);
  });
});

describe("loadBurialDirectory", () => {
  it("is idempotent: loading the same rows twice does not duplicate them", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "burials-"));
    const text = await seedText();
    await writeFile(path.join(dir, "a.csv"), text);
    await writeFile(path.join(dir, "b.csv"), text);
    expect(await loadBurialDirectory(dir)).toHaveLength(83);
  });

  it("adds new pages and lets a later file replace a row by id", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "burials-"));
    await writeFile(path.join(dir, "01-seed.csv"), await seedText());
    await writeFile(
      path.join(dir, "02-page8.csv"),
      [
        HEADER,
        "84,8,1,957,New Person,no,1905-12-01,30,,VR,1,1,5,A,20,,",
        "10,6,10,872,Hattie Tolbert,no,1905-10-12,41,,VR,1,1,5,J,15,age_years,Re-checked",
      ].join("\n"),
    );
    const burials = await loadBurialDirectory(dir);
    expect(burials).toHaveLength(84);
    expect(burials.find((b) => b.id === 10)).toMatchObject({ ageYears: "41", transcriberNote: "Re-checked" });
  });
});
