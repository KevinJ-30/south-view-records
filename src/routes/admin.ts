import { createHash, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { isIsoDate, UNCERTAIN_FIELD_NAMES } from "../data/load.js";
import { InvalidRecord, type BurialInput, type BurialRepository } from "../data/types.js";

/** Placeholder sign-in for the admin page. ADMIN_USERNAME and ADMIN_PASSWORD override these. */
export const DEFAULT_ADMIN_USERNAME = "admin";
export const DEFAULT_ADMIN_PASSWORD = "southview-1905";

export type AdminOptions = {
  username: string;
  password: string;
  /** False when records come from CSV files, so edits last only until the server restarts. */
  persistent: boolean;
};

/** Field names that may be marked uncertain. */
const UNCERTAIN_FIELDS = new Set<string>(Object.values(UNCERTAIN_FIELD_NAMES));

/**
 * Routes for /api/admin: add, edit, and delete records. Every request needs HTTP Basic
 * credentials. Mount with app.route("/api/admin", adminRoutes(repo, options)).
 */
export function adminRoutes(repository: BurialRepository, options: AdminOptions) {
  const routes = new Hono();

  routes.onError((error, c) => {
    if (error instanceof InvalidRecord) return c.json({ error: error.message }, 400);
    throw error;
  });

  routes.use("*", requireSignIn(options));

  routes.get("/session", (c) => c.json({ username: options.username, persistent: options.persistent }));

  routes.post("/burials", async (c) => {
    return c.json(await repository.create(parseInput(await readJson(c.req.raw))), 201);
  });

  routes.put("/burials/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    const burial = await repository.update(id, parseInput(await readJson(c.req.raw)));
    if (!burial) return c.json({ error: `No record with id ${id}.` }, 404);
    return c.json(burial);
  });

  routes.delete("/burials/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (!(await repository.remove(id))) return c.json({ error: `No record with id ${id}.` }, 404);
    return c.body(null, 204);
  });

  return routes;
}

/** Answers 401 with JSON, and no WWW-Authenticate header so browsers don't show their own sign-in box. */
function requireSignIn({ username, password }: AdminOptions) {
  return createMiddleware(async (c, next) => {
    const match = /^Basic (.+)$/i.exec(c.req.header("Authorization") ?? "");
    const decoded = match ? Buffer.from(match[1], "base64").toString("utf8") : "";
    const colon = decoded.indexOf(":");
    const ok =
      colon >= 0 && sameSecret(decoded.slice(0, colon), username) && sameSecret(decoded.slice(colon + 1), password);
    if (!ok) return c.json({ error: "Wrong username or password." }, 401);
    await next();
  });
}

/** Constant-time comparison, so response timing doesn't reveal how much of a guess was right. */
function sameSecret(given: string, expected: string): boolean {
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(given), hash(expected));
}

function parseId(id: string): number {
  if (!/^\d+$/.test(id)) throw new InvalidRecord("Record id must be a whole number.");
  return Number(id);
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new InvalidRecord("Send the record as JSON.");
  }
}

/** Validates a record from the admin page. Text is trimmed and blanks become null, as in the CSV loader. */
export function parseInput(body: unknown): BurialInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new InvalidRecord("Send the record as a JSON object.");
  }
  const record = body as Record<string, unknown>;

  const optional = (name: keyof BurialInput) => {
    const value = record[name];
    if (value === undefined || value === null) return null;
    if (typeof value !== "string" && typeof value !== "number") throw new InvalidRecord(`${name} must be text.`);
    return String(value).trim() || null;
  };
  const positive = (name: keyof BurialInput) => {
    const value = optional(name);
    if (value === null || !/^\d+$/.test(value) || Number(value) < 1) {
      throw new InvalidRecord(`${name} must be a whole number of 1 or more.`);
    }
    return Number(value);
  };

  const nameAsWritten = optional("nameAsWritten");
  if (!nameAsWritten) throw new InvalidRecord("nameAsWritten is required.");
  const burialDate = optional("burialDate");
  if (burialDate !== null && !isIsoDate(burialDate)) throw new InvalidRecord("burialDate must be a date like 1905-10-01.");
  if (typeof record.isInfantOf !== "boolean") throw new InvalidRecord("isInfantOf must be true or false.");
  const uncertainFields = record.uncertainFields ?? [];
  if (!Array.isArray(uncertainFields) || uncertainFields.some((name) => !UNCERTAIN_FIELDS.has(name))) {
    throw new InvalidRecord(`uncertainFields may only list ${[...UNCERTAIN_FIELDS].join(", ")}.`);
  }

  return {
    sourcePage: positive("sourcePage"),
    lineOnPage: positive("lineOnPage"),
    entryNo: optional("entryNo"),
    nameAsWritten,
    isInfantOf: record.isInfantOf,
    burialDate,
    ageYears: optional("ageYears"),
    ageMonthsOrDays: optional("ageMonthsOrDays"),
    plat: optional("plat"),
    section: optional("section"),
    block: optional("block"),
    lot: optional("lot"),
    range: optional("range"),
    grave: optional("grave"),
    uncertainFields: [...new Set(uncertainFields as string[])],
    transcriberNote: optional("transcriberNote"),
  };
}
