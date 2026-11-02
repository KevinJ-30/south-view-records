import { Hono } from "hono";
import { inLedgerYears } from "../data/burials.js";
import { isIsoDate } from "../data/load.js";
import type { BurialRepository, SearchParams } from "../data/types.js";
import { UNCERTAINTY_FILTERS, type UncertaintyFilter } from "../data/uncertainty.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export class BadRequest extends Error {}

/** Routes for /api/burials and /api/stats. Mount with app.route("/api", burialRoutes(repo)). */
export function burialRoutes(repository: BurialRepository) {
  const routes = new Hono();

  routes.onError((error, c) => {
    if (error instanceof BadRequest) return c.json({ error: error.message }, 400);
    throw error;
  });

  routes.get("/burials", async (c) => {
    return c.json(await repository.search(parseSearch(new URL(c.req.url).searchParams)));
  });

  routes.get("/burials/:id", async (c) => {
    const id = c.req.param("id");
    if (!/^\d+$/.test(id)) return c.json({ error: "Record id must be a whole number." }, 400);
    const burial = await repository.getById(Number(id));
    if (!burial || !inLedgerYears(burial)) return c.json({ error: `No record with id ${id}.` }, 404);
    return c.json(burial);
  });

  routes.get("/stats", async (c) => {
    return c.json(await repository.stats());
  });

  return routes;
}

export function parseSearch(query: URLSearchParams): SearchParams {
  const text = (name: string) => query.get(name)?.trim() || undefined;

  const date = (name: string) => {
    const value = text(name);
    if (value !== undefined && !isIsoDate(value)) throw new BadRequest(`${name} must be a real date like 1905-10-01.`);
    return value;
  };

  const positive = (name: string, fallback: number, max = Infinity) => {
    const value = text(name);
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(value) || Number(value) < 1) throw new BadRequest(`${name} must be a whole number of 1 or more.`);
    return Math.min(Number(value), max);
  };

  let infant: boolean | undefined;
  const infantValue = text("infant")?.toLowerCase();
  if (infantValue === "yes" || infantValue === "true") infant = true;
  else if (infantValue === "no" || infantValue === "false") infant = false;
  else if (infantValue !== undefined) throw new BadRequest("infant must be yes or no.");

  const uncertain = text("uncertain")?.toLowerCase();
  if (uncertain !== undefined && !UNCERTAINTY_FILTERS.includes(uncertain as UncertaintyFilter)) {
    throw new BadRequest(`uncertain must be one of ${UNCERTAINTY_FILTERS.join(", ")}.`);
  }

  const from = date("from");
  const to = date("to");
  if (from && to && from > to) throw new BadRequest("from must be on or before to.");

  return {
    q: text("q"),
    from,
    to,
    plat: text("plat"),
    section: text("section"),
    block: text("block"),
    lot: text("lot"),
    infant,
    uncertain: uncertain as UncertaintyFilter | undefined,
    page: positive("page", 1),
    pageSize: positive("pageSize", DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}
