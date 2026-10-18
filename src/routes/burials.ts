import { Hono } from "hono";
import type { BurialRepository, SearchParams } from "../data/types.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

class BadRequest extends Error {}

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
    if (!burial) return c.json({ error: `No record with id ${id}.` }, 404);
    return c.json(burial);
  });

  routes.get("/stats", async (c) => {
    return c.json(await repository.stats());
  });

  return routes;
}

function parseSearch(query: URLSearchParams): SearchParams {
  const text = (name: string) => query.get(name)?.trim() || undefined;

  const date = (name: string) => {
    const value = text(name);
    if (value !== undefined && !ISO_DATE.test(value)) throw new BadRequest(`${name} must be a date like 1905-10-01.`);
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

  return {
    q: text("q"),
    from: date("from"),
    to: date("to"),
    plat: text("plat"),
    section: text("section"),
    block: text("block"),
    lot: text("lot"),
    infant,
    page: positive("page", 1),
    pageSize: positive("pageSize", DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}
