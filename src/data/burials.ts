import path from "node:path";
import { loadBurialDirectory } from "./load.js";
import { matchName, type NameMatch } from "./match.js";
import { matchesUncertainty } from "./uncertainty.js";
import type { Burial, BurialHit, BurialInput, BurialRepository, SearchParams, SearchResult, Stats } from "./types.js";

export const DEFAULT_DATA_DIR = path.resolve(import.meta.dirname, "../../data");

/** Loads every ledger CSV in `dir` into an in-memory repository. */
export async function loadBurials(dir = process.env.BURIALS_DATA_DIR ?? DEFAULT_DATA_DIR): Promise<BurialRepository> {
  return createMemoryRepository(await loadBurialDirectory(dir));
}

/**
 * Years the ledgers cover. Records dated outside them are likely misreadings, so the public
 * site hides them until they're checked; undated records are shown. Keep in sync with web/src/lib/filters.ts.
 */
export const LEDGER_YEARS = { first: 1905, last: 1918 } as const;

export function inLedgerYears(burial: Pick<Burial, "burialDate">): boolean {
  if (!burial.burialDate) return true;
  const year = Number(burial.burialDate.slice(0, 4));
  return year >= LEDGER_YEARS.first && year <= LEDGER_YEARS.last;
}

const MATCH_RANK = { exact: 0, abbreviation: 1, fuzzy: 2 } as const;

/** Ledger reading order: by burial date (undated last), then page and line. */
function compareLedgerOrder(a: Burial, b: Burial): number {
  if (a.burialDate !== b.burialDate) {
    if (a.burialDate === null) return 1;
    if (b.burialDate === null) return -1;
    return a.burialDate < b.burialDate ? -1 : 1;
  }
  if (a.sourcePage !== b.sourcePage) {
    if (a.sourcePage === null) return 1;
    if (b.sourcePage === null) return -1;
    return a.sourcePage - b.sourcePage;
  }
  return a.lineOnPage - b.lineOnPage;
}

function sameValue(actual: string | null, wanted: string | undefined): boolean {
  if (wanted === undefined) return true;
  return (actual ?? "").trim().toLowerCase() === wanted.trim().toLowerCase();
}

export function createMemoryRepository(records: Burial[]): BurialRepository {
  let burials: Burial[] = [];
  let byId = new Map<number, Burial>();
  const replaceAll = (next: Burial[]) => {
    burials = [...next].sort(compareLedgerOrder);
    byId = new Map(burials.map((burial) => [burial.id, burial]));
  };
  replaceAll(records);

  return {
    async search(params: SearchParams): Promise<SearchResult> {
      const query = params.q?.trim() ?? "";
      const hits: { burial: Burial; match: NameMatch | null }[] = [];

      const dates = params.dates ?? "ledger";
      for (const burial of burials) {
        if (dates !== "all" && inLedgerYears(burial) !== (dates === "ledger")) continue;
        if (params.undated && burial.burialDate) continue;
        if (params.from && (!burial.burialDate || burial.burialDate < params.from)) continue;
        if (params.to && (!burial.burialDate || burial.burialDate > params.to)) continue;
        if (params.infant !== undefined && burial.isInfantOf !== params.infant) continue;
        if (params.uncertain && !matchesUncertainty(burial, params.uncertain)) continue;
        if (!sameValue(burial.plat, params.plat)) continue;
        if (!sameValue(burial.section, params.section)) continue;
        if (!sameValue(burial.block, params.block)) continue;
        if (!sameValue(burial.lot, params.lot)) continue;
        if (!sameValue(burial.range, params.range)) continue;
        if (!sameValue(burial.grave, params.grave)) continue;

        const match = query ? matchName(burial.nameAsWritten, query) : null;
        if (query && !match) continue;
        hits.push({ burial, match });
      }

      if (query) {
        // Array.sort is stable, so ties keep ledger order.
        hits.sort((a, b) => MATCH_RANK[a.match!.type] - MATCH_RANK[b.match!.type] || a.match!.score - b.match!.score);
      }

      const start = (params.page - 1) * params.pageSize;
      const items: BurialHit[] = hits
        .slice(start, start + params.pageSize)
        .map(({ burial, match }) => ({ ...burial, matchType: match?.type ?? null }));

      return {
        items,
        total: hits.length,
        page: params.page,
        pageSize: params.pageSize,
        totalPages: Math.max(1, Math.ceil(hits.length / params.pageSize)),
      };
    },

    async getById(id: number): Promise<Burial | null> {
      return byId.get(id) ?? null;
    },

    /** Covers only the records the public site shows. */
    async stats(): Promise<Stats> {
      const shown = burials.filter(inLedgerYears);
      const months = new Map<string, { total: number; infants: number }>();
      const plats = new Map<string, number>();
      const dates = shown.flatMap((burial) => (burial.burialDate ? [burial.burialDate] : [])).sort();

      for (const burial of shown) {
        if (burial.burialDate) {
          const month = burial.burialDate.slice(0, 7);
          const entry = months.get(month) ?? { total: 0, infants: 0 };
          entry.total += 1;
          if (burial.isInfantOf) entry.infants += 1;
          months.set(month, entry);
        }
        const plat = burial.plat ?? "(blank)";
        plats.set(plat, (plats.get(plat) ?? 0) + 1);
      }

      return {
        total: shown.length,
        infants: shown.filter((burial) => burial.isInfantOf).length,
        undated: shown.length - dates.length,
        earliestDate: dates[0] ?? null,
        latestDate: dates.at(-1) ?? null,
        byMonth: [...months].sort(([a], [b]) => (a < b ? -1 : 1)).map(([month, counts]) => ({ month, ...counts })),
        byPlat: [...plats].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([plat, total]) => ({ plat, total })),
        sourcePages: [...new Set(shown.flatMap((burial) => (burial.sourcePage === null ? [] : [burial.sourcePage])))].sort(
          (a, b) => a - b,
        ),
      };
    },

    async create(input: BurialInput): Promise<Burial> {
      const burial = { id: burials.reduce((max, existing) => Math.max(max, existing.id), 0) + 1, ...input };
      replaceAll([...burials, burial]);
      return burial;
    },

    async update(id: number, input: BurialInput): Promise<Burial | null> {
      if (!byId.has(id)) return null;
      const burial = { id, ...input };
      replaceAll(burials.map((existing) => (existing.id === id ? burial : existing)));
      return burial;
    },

    async remove(id: number): Promise<boolean> {
      if (!byId.has(id)) return false;
      replaceAll(burials.filter((existing) => existing.id !== id));
      return true;
    },
  };
}
