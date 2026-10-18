import { beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { loadBurials } from "../src/data/burials.js";
import { burialRoutes } from "../src/routes/burials.js";
import type { Burial, SearchResult, Stats } from "../src/data/types.js";

let api: Hono;

beforeAll(async () => {
  api = burialRoutes(await loadBurials());
});

async function search(query: string): Promise<SearchResult> {
  const response = await api.request(`/burials?${query}`);
  expect(response.status).toBe(200);
  return response.json();
}

const names = (result: SearchResult) => result.items.map((item) => item.nameAsWritten);

describe("GET /burials search", () => {
  it("finds a name case-insensitively", async () => {
    const result = await search("q=hattie%20TOLBERT");
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ id: 10, nameAsWritten: "Hattie Tolbert", matchType: "exact" });
  });

  it("matches part of a name", async () => {
    expect(names(await search("q=tolb"))).toEqual(["Hattie Tolbert"]);
    expect(names(await search("q=dupre"))).toEqual(["Lucy Dupree", "Gus Dupree"]);
  });

  it("matches words in any order", async () => {
    expect(names(await search("q=Tolbert%20Hattie"))).toEqual(["Hattie Tolbert"]);
  });

  it("finds variant spellings as fuzzy matches", async () => {
    const result = await search("q=Duprey");
    expect(names(result)).toEqual(["Lucy Dupree", "Gus Dupree"]);
    expect(result.items.every((item) => item.matchType === "fuzzy")).toBe(true);

    expect(names(await search("q=Charles%20Cartwright"))).toContain("Charls Cartwright");
    expect(names(await search("q=Russell"))).toContain("Rusell Martin");
  });

  it("expands ledger abbreviations and ranks exact matches first", async () => {
    const result = await search("q=John");
    expect(result.items[0]).toMatchObject({ nameAsWritten: "Johnie Cunningham", matchType: "exact" });
    const abbreviated = result.items.filter((item) => item.matchType === "abbreviation").map((item) => item.nameAsWritten);
    expect(abbreviated).toEqual(expect.arrayContaining(["Jno. Harris", "Jno. W. Amos", "Inf. of Jno. Weeks"]));

    expect(names(await search("q=Jno"))).toContain("Johnie Cunningham");
    expect(names(await search("q=william"))).toEqual(expect.arrayContaining(["Wm. Marshal", "Wm. Leland", "Willie Williams"]));
  });

  it("does not fuzzy-match very short queries", async () => {
    const result = await search("q=Ann");
    expect(result.items.every((item) => item.matchType === "exact")).toBe(true);
  });

  it("returns nothing for an unrelated name", async () => {
    const result = await search("q=zzzzqq");
    expect(result).toMatchObject({ total: 0, items: [], totalPages: 1 });
  });

  it("filters by date range and infant", async () => {
    const october = await search("infant=yes&from=1905-10-01&to=1905-10-31");
    expect(october.total).toBe(9);
    expect(october.items.every((item) => item.isInfantOf && item.burialDate!.startsWith("1905-10"))).toBe(true);

    expect((await search("infant=yes")).total).toBe(17);
    expect((await search("infant=no")).total).toBe(66);
  });

  it("filters by location fields as text", async () => {
    expect(names(await search("lot=hunter"))).toEqual(["Lizzie Hunter"]);
    const section2 = await search("section=2&pageSize=100");
    expect(section2.total).toBeGreaterThan(0);
    expect(section2.items.every((item) => item.section === "2")).toBe(true);
    const lot = await search("section=1&block=1&lot=5&pageSize=100");
    expect(lot.items.every((item) => item.section === "1" && item.block === "1" && item.lot === "5")).toBe(true);
  });

  it("combines a name search with filters", async () => {
    expect(names(await search("q=wilson&infant=yes"))).toEqual(["Inf. of William Wilson", "Inf. of H. Wilson"]);
  });

  it("paginates in ledger order with undated records last", async () => {
    const first = await search("pageSize=10");
    expect(first).toMatchObject({ total: 83, page: 1, pageSize: 10, totalPages: 9 });
    expect(first.items[0].nameAsWritten).toBe("B.F. Simpson");

    const last = await search("pageSize=10&page=9");
    expect(last.items).toHaveLength(3);
    expect(last.items.at(-1)?.nameAsWritten).toBe("Inf. of Mattie Allen");

    expect((await search("page=20")).items).toEqual([]);
    expect((await search("pageSize=5000")).pageSize).toBe(100);
  });

  it("rejects malformed parameters", async () => {
    for (const query of ["from=Oct%201905", "to=1905-1-5", "page=0", "pageSize=abc", "infant=maybe"]) {
      const response = await api.request(`/burials?${query}`);
      expect(response.status, query).toBe(400);
      expect(await response.json()).toHaveProperty("error");
    }
  });
});

describe("GET /burials/:id", () => {
  it("returns every field of one record", async () => {
    const response = await api.request("/burials/6");
    expect(response.status).toBe(200);
    const burial: Burial = await response.json();
    expect(burial).toEqual({
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

  it("returns 404 and 400 for missing or bad ids", async () => {
    expect((await api.request("/burials/9999")).status).toBe(404);
    expect((await api.request("/burials/abc")).status).toBe(400);
  });
});

describe("GET /stats", () => {
  it("counts burials by month", async () => {
    const stats: Stats = await (await api.request("/stats")).json();
    expect(stats).toMatchObject({ total: 83, infants: 17, undated: 1, earliestDate: "1905-10-10", latestDate: "1905-11-29" });
    expect(stats.byMonth.map((m) => m.month)).toEqual(["1905-10", "1905-11"]);
    expect(stats.byMonth[0].infants).toBe(9);
    expect(stats.byMonth.reduce((sum, m) => sum + m.total, 0)).toBe(82);
    expect(stats.byPlat[0]).toEqual({ plat: "VR", total: 62 });
    expect(stats.sourcePages).toEqual([6, 7]);
  });
});
