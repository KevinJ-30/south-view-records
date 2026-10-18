/**
 * One burial from the grave record ledgers. Every value is kept exactly as
 * transcribed: location and age fields stay strings, blanks become null.
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
  /** API field names (e.g. "nameAsWritten", "range") the transcriber was unsure about. */
  uncertainFields: string[];
  transcriberNote: string | null;
};

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
  infant?: boolean;
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
}
