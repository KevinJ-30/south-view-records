import { beforeEach, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { loadBurials } from "../src/data/burials.js";
import type { Burial, BurialInput, BurialRepository } from "../src/data/types.js";
import { adminRoutes } from "../src/routes/admin.js";

let repository: BurialRepository;
let api: Hono;

beforeEach(async () => {
  repository = await loadBurials();
  api = adminRoutes(repository, { username: "clerk", password: "ledger", persistent: false });
});

const signIn = (username = "clerk", password = "ledger") => ({
  Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
});

const input: BurialInput = {
  sourcePage: 8,
  lineOnPage: 1,
  entryNo: "990",
  nameAsWritten: "Thos. Example",
  isInfantOf: false,
  burialDate: "1905-12-01",
  ageYears: "40",
  ageMonthsOrDays: null,
  plat: "VR",
  section: "1",
  block: "1",
  lot: "5",
  range: "A",
  grave: "20",
  uncertainFields: ["nameAsWritten"],
  transcriberNote: null,
};

function send(method: string, path: string, body?: unknown, headers: Record<string, string> = signIn()) {
  return api.request(path, {
    method,
    headers: { ...headers, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("admin sign-in", () => {
  it("rejects missing or wrong credentials without a browser sign-in prompt", async () => {
    for (const headers of [{}, signIn("clerk", "wrong"), signIn("someone", "ledger"), { Authorization: "Bearer x" }]) {
      const response = await send("GET", "/session", undefined, headers);
      expect(response.status).toBe(401);
      expect(response.headers.get("WWW-Authenticate")).toBeNull();
    }
    expect((await send("DELETE", "/burials/1", undefined, {})).status).toBe(401);
    expect(await repository.getById(1)).not.toBeNull();
  });

  it("accepts the right credentials", async () => {
    const response = await send("GET", "/session");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ username: "clerk", persistent: false });
  });
});

describe("admin record changes", () => {
  it("adds a record with the next id", async () => {
    const response = await send("POST", "/burials", input);
    expect(response.status).toBe(201);
    const created: Burial = await response.json();
    expect(created).toEqual({ id: 84, ...input });
    expect(await repository.getById(84)).toEqual(created);
    expect((await repository.search({ q: "Example", page: 1, pageSize: 20 })).total).toBe(1);
  });

  it("edits a record and trims blanks to null", async () => {
    const response = await send("PUT", "/burials/6", { ...input, nameAsWritten: "  Jno. Harris Sr. ", range: " " });
    expect(response.status).toBe(200);
    const burial = await repository.getById(6);
    expect(burial).toMatchObject({ id: 6, nameAsWritten: "Jno. Harris Sr.", range: null });
  });

  it("deletes a record", async () => {
    expect((await send("DELETE", "/burials/6")).status).toBe(204);
    expect(await repository.getById(6)).toBeNull();
    expect((await send("DELETE", "/burials/6")).status).toBe(404);
  });

  it("answers 404 for an unknown record", async () => {
    expect((await send("PUT", "/burials/9999", input)).status).toBe(404);
  });

  it("rejects invalid records", async () => {
    const bad = [
      { ...input, nameAsWritten: " " },
      { ...input, sourcePage: 0 },
      { ...input, lineOnPage: "two" },
      { ...input, burialDate: "Oct 1905" },
      { ...input, isInfantOf: "no" },
      { ...input, uncertainFields: ["shoeSize"] },
      [input],
    ];
    for (const body of bad) {
      const response = await send("POST", "/burials", body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(await response.json()).toHaveProperty("error");
    }
    const notJson = await api.request("/burials", { method: "POST", headers: signIn(), body: "{" });
    expect(notJson.status).toBe(400);
    expect((await repository.stats()).total).toBe(83);
  });
});
