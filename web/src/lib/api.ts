/**
 * Client for the South-View records API (pitch-backend, src/routes/burials.ts).
 * Keep these types in sync with pitch-backend/src/data/types.ts.
 */

export type Burial = {
  id: number;
  /** Null when the ledger page wasn't recorded. */
  sourcePage: number | null;
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
export const SEARCH_PARAMS = ["q", "from", "to", "plat", "section", "block", "lot", "range", "grave", "infant", "undated", "uncertain", "page", "pageSize"] as const;

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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers: { Accept: "application/json", ...init.headers } });
  } catch {
    throw new ApiError("We couldn't reach the records server. Check your connection and try again.", 0);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? `Request failed (${response.status}).`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function searchBurials(params: URLSearchParams): Promise<SearchResult> {
  const query = new URLSearchParams();
  for (const name of SEARCH_PARAMS) {
    const value = params.get(name)?.trim();
    if (value) query.set(name, value);
  }
  return request(`/api/burials?${query}`);
}

export function getBurial(id: string): Promise<Burial> {
  return request(`/api/burials/${encodeURIComponent(id)}`);
}

export function getStats(): Promise<Stats> {
  return request("/api/stats");
}

/** A burial as the admin page sends it; the server assigns the id of a new record. */
export type BurialInput = Omit<Burial, "id">;

export type AdminCredentials = { username: string; password: string };

/** `persistent` is false when the server reads CSV files, so edits are lost when it restarts. */
export type AdminSession = { username: string; persistent: boolean };

function adminRequest<T>(credentials: AdminCredentials, path: string, method = "GET", body?: BurialInput): Promise<T> {
  // btoa only takes Latin-1, so encode the credentials as UTF-8 bytes first.
  const bytes = new TextEncoder().encode(`${credentials.username}:${credentials.password}`);
  const headers: Record<string, string> = { Authorization: `Basic ${btoa(String.fromCharCode(...bytes))}` };
  if (body) headers["Content-Type"] = "application/json";
  return request(`/api/admin${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

/**
 * Like searchBurials, but includes records the public site hides because their date is outside
 * the ledger years; `outsideOnly` lists just those.
 */
export function searchAdminBurials(
  credentials: AdminCredentials,
  params: URLSearchParams,
  outsideOnly: boolean,
): Promise<SearchResult> {
  const query = new URLSearchParams();
  for (const name of SEARCH_PARAMS) {
    const value = params.get(name)?.trim();
    if (value) query.set(name, value);
  }
  if (outsideOnly) query.set("dates", "outside");
  return adminRequest(credentials, `/burials?${query}`);
}

/** Checks the credentials; fails with status 401 when they are wrong. */
export function getAdminSession(credentials: AdminCredentials): Promise<AdminSession> {
  return adminRequest(credentials, "/session");
}

export function createBurial(credentials: AdminCredentials, input: BurialInput): Promise<Burial> {
  return adminRequest(credentials, "/burials", "POST", input);
}

export function updateBurial(credentials: AdminCredentials, id: number, input: BurialInput): Promise<Burial> {
  return adminRequest(credentials, `/burials/${id}`, "PUT", input);
}

export function deleteBurial(credentials: AdminCredentials, id: number): Promise<void> {
  return adminRequest(credentials, `/burials/${id}`, "DELETE");
}
