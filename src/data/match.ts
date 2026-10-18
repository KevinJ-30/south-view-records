import { NAME_ABBREVIATIONS } from "./abbreviations.js";
import type { MatchType } from "./types.js";

export type NameMatch = { type: MatchType; score: number };

const ALIASES = new Map<string, string[]>();
for (const group of NAME_ABBREVIATIONS) {
  for (const form of group) ALIASES.set(form, group);
}

/** Lowercase, strip accents and punctuation, collapse spaces: "Jno. W. Amos" -> "jno w amos". */
export function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return value ? value.split(" ") : [];
}

function forms(token: string): string[] {
  return ALIASES.get(token) ?? [token];
}

/** Edits allowed before a token stops counting as a spelling variant. */
function maxEdits(length: number): number {
  if (length < 4) return 0;
  if (length < 7) return 1;
  return 2;
}

/**
 * Compares a query against a name as written. Never alters either value.
 * Tiers, best first: "exact" (substring or every word starts the same),
 * "abbreviation" (Jno. <-> John), "fuzzy" (small spelling differences).
 * Lower score ranks higher within a tier.
 */
export function matchName(name: string, query: string): NameMatch | null {
  const q = normalize(query);
  const n = normalize(name);
  if (!q || !n) return null;

  if (n === q) return { type: "exact", score: 0 };
  if (n.startsWith(q) || n.includes(` ${q}`)) return { type: "exact", score: 1 };
  if (n.includes(q)) return { type: "exact", score: 2 };

  const nameTokens = tokens(n);
  let type: MatchType = "exact";
  let score = 3;
  for (const qt of tokens(q)) {
    const best = matchToken(qt, nameTokens);
    if (!best) return null;
    if (rank(best.type) > rank(type)) type = best.type;
    score += best.score;
  }
  return { type, score };
}

function matchToken(qt: string, nameTokens: string[]): NameMatch | null {
  let best: NameMatch | null = null;
  const consider = (candidate: NameMatch) => {
    if (!best || rank(candidate.type) < rank(best.type) || (candidate.type === best.type && candidate.score < best.score)) {
      best = candidate;
    }
  };

  for (const nt of nameTokens) {
    if (nt.startsWith(qt)) {
      consider({ type: "exact", score: 0 });
      continue;
    }
    // Only tokens in an abbreviation group have other forms: "jo" reaches "jno" via "john",
    // and "jno" reaches "johnie" via "john".
    const nameForms = forms(nt);
    const queryForms = forms(qt);
    if (
      (nameForms.length > 1 && (nameForms.includes(qt) || (qt.length >= 2 && nameForms.some((form) => form.startsWith(qt))))) ||
      (queryForms.length > 1 && queryForms.some((form) => nt.startsWith(form)))
    ) {
      consider({ type: "abbreviation", score: 0 });
      continue;
    }
    const limit = maxEdits(qt.length);
    if (limit === 0) continue;
    for (const form of nameForms) {
      const distance = editDistance(qt, form, limit);
      if (distance <= limit) consider({ type: "fuzzy", score: distance });
    }
  }
  return best;
}

function rank(type: MatchType): number {
  return type === "exact" ? 0 : type === "abbreviation" ? 1 : 2;
}

/** Optimal string alignment distance (Levenshtein plus adjacent swaps), stopping early past `limit`. */
export function editDistance(a: string, b: string, limit = Infinity): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  const rows = Array.from({ length: a.length + 1 }, (_, i) => {
    const row = new Array<number>(b.length + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, rows[i - 2][j - 2] + 1);
      }
      rows[i][j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) return limit + 1;
  }
  return rows[a.length][b.length];
}
