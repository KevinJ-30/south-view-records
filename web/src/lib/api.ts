/**
 * Client for the South-View records API (pitch-backend, src/routes/burials.ts).
 * Keep these types in sync with pitch-backend/src/data/types.ts.
 */

export type Burial = {
  id: number;
  sourcePage: number;
  lineOnPage: number;
  entryNo: string | null;
  nameAsWritten: string;
  isInfantOf: boolean;
  burialDate: string | null;
  ageYears: string | null;
  ageMonthsOrDays: string | null;
  plat: string | null;
  section: string | null;
  block: string | null;
  lot: string | null;
  range: string | null;
  grave: string | null;
  /** Names of fields above whose reading is uncertain, e.g. "nameAsWritten", "range". */
  uncertainFields: string[];
  transcriberNote: string | null;
};

export type MatchType = "exact" | "abbreviation" | "fuzzy";

export type BurialHit = Burial & { matchType: MatchType | null };

export type SearchResult = {
  items: BurialHit[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type Stats = {
  total: number;
  infants: number;
  undated: number;
  earliestDate: string | null;
  latestDate: string | null;
  byMonth: { month: string; total: number; infants: number }[];
  byPlat: { plat: string; total: number }[];
  sourcePages: number[];
};

/** Query parameters accepted by GET /api/burials; all optional strings, as in the URL. */
export const SEARCH_PARAMS = ["q", "from", "to", "plat", "section", "block", "lot", "infant", "page", "pageSize"] as const;

/** Empty in development: Vite proxies /api to the backend. */
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function getJson<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { headers: { Accept: "application/json" } });
  } catch {
    throw new ApiError("We couldn't reach the records server. Check your connection and try again.", 0);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? `Request failed (${response.status}).`, response.status);
  }
  return (await response.json()) as T;
}

export function searchBurials(params: URLSearchParams): Promise<SearchResult> {
  const query = new URLSearchParams();
  for (const name of SEARCH_PARAMS) {
    const value = params.get(name)?.trim();
    if (value) query.set(name, value);
  }
  return getJson(`/api/burials?${query}`);
}

export function getBurial(id: string): Promise<Burial> {
  return getJson(`/api/burials/${encodeURIComponent(id)}`);
}

export function getStats(): Promise<Stats> {
  return getJson("/api/stats");
}
