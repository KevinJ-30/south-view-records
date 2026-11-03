import type { UncertaintyFilter } from "./uncertainty.js";

/**
 * One burial from the grave record ledgers. Every value is kept exactly as
 * transcribed: location and age fields stay strings, blanks become null.
 */
export type Burial = {
  id: number;
  /** Null when the ledger page wasn't recorded in the import. */
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
  /** API field names (e.g. "nameAsWritten", "range") the transcriber was unsure about. */
  uncertainFields: string[];
  transcriberNote: string | null;
};

/**
 * What uncertainFields can name: a Burial field, or "extraMarks" for stray writing,
 * strike-throughs, or overlapping text on the row that make it harder to read.
 */
export type UncertainField = keyof Burial | "extraMarks";

/** A burial as the admin page sends it; the server assigns the id of a new record. */
export type BurialInput = Omit<Burial, "id">;

/** A record that cannot be saved as given. Routes answer it with 400 and the message. */
export class InvalidRecord extends Error {}

export type MatchType = "exact" | "abbreviation" | "fuzzy";

export type BurialHit = Burial & { matchType: MatchType | null };

export type SearchParams = {
  q?: string;
  from?: string;
  to?: string;
  plat?: string;
  section?: string;
  block?: string;
  lot?: string;
  range?: string;
  grave?: string;
  infant?: boolean;
  /** Only records with no burial date. Can't be combined with from or to. */
  undated?: boolean;
  uncertain?: UncertaintyFilter;
  /**
   * Which records by date: "ledger" (the default) hides records dated outside LEDGER_YEARS,
   * and "all" includes them. Only the admin routes set it.
   */
  dates?: "ledger" | "all";
  page: number;
  pageSize: number;
};

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

/** Everything routes need. A Postgres version only has to implement this. */
export interface BurialRepository {
  search(params: SearchParams): Promise<SearchResult>;
  getById(id: number): Promise<Burial | null>;
  stats(): Promise<Stats>;
  /** Adds a record with the next free id. */
  create(input: BurialInput): Promise<Burial>;
  /** Replaces a record; null when no record has that id. */
  update(id: number, input: BurialInput): Promise<Burial | null>;
  /** Deletes a record; false when no record has that id. */
  remove(id: number): Promise<boolean>;
}
