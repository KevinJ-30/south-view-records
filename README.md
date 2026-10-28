# South-View backend

API for the South-View burial records index.
On this branch the frontend ([pitch-frontend](https://github.com/lmc-3403-ocr/pitch-frontend))
lives in `web/`, so both deploy together as one Vercel project.

## Deploy on Vercel

`vercel.json` does the setup: pnpm installs both packages, `web/` is built as the
static site, and `api/index.ts` serves every `/api/*` request with the same Hono app as
`pnpm dev`. In the Vercel project, leave the root directory as the repo root and add
`SUPABASE_URL` and `SUPABASE_KEY` under Environment Variables. Without them the API
serves the CSVs in `data/`.

Run the frontend locally with `pnpm --filter ./web dev` (it proxies `/api` to `pnpm dev`).

## Run it

Needs [Node.js](https://nodejs.org) 22+ and pnpm (`corepack enable` sets it up).

```sh
pnpm install
pnpm dev        # http://localhost:8080
pnpm test
```

Records load from every `*.csv` in `data/` when the server starts. With `SUPABASE_URL` and `SUPABASE_KEY` set (see `.env.example`), records load from the
Supabase `burial_records` table instead, and are re-read every minute.

## Admin page

Records can be added, edited, and deleted at the unlinked path `ADMIN_PATH` in
`web/src/routes/admin.tsx`. The sign-in comes from `ADMIN_USERNAME` and `ADMIN_PASSWORD`
(placeholder defaults are in `src/routes/admin.ts`; set real ones in Vercel). Edits are
written to Supabase, so `SUPABASE_KEY` must be allowed to write `burial_records` (the
service role key, or RLS policies that allow it). With CSV files, edits last only until restart.

## Adding ledger pages

Drop more CSV files with the same columns into `data/` and restart. Files load in
filename order and rows are keyed by `id`, so loading a file twice never duplicates
records, and a later file with the same `id` replaces the earlier row (for
corrections). A file with wrong columns or a bad value stops startup with the file
name and line number.

Columns: `id, source_page, line_on_page, entry_no, name_as_written, is_infant_of,
burial_date, age_years, age_months_or_days, plat, section, block, lot, range, grave,
uncertain_fields, transcriber_note`. Values are never corrected. Set
`BURIALS_DATA_DIR` to load from a different folder.

## API

All responses are JSON. Errors are `{ "error": "message" }` with status 400 or 404.

### `GET /api/burials`

| Param | Meaning |
| --- | --- |
| `q` | Name search: case-insensitive, partial, ledger abbreviations (`Jno.` ↔ John), and close spellings |
| `from`, `to` | Burial date range, `YYYY-MM-DD`, inclusive. Undated records are left out when either is set |
| `plat`, `section`, `block`, `lot` | Exact match on the text as written, case-insensitive (`lot=Hunter`) |
| `infant` | `yes` or `no` |
| `page`, `pageSize` | Default 1 and 20; `pageSize` max 100 |

```json
{ "items": [Burial & { "matchType": "exact" | "abbreviation" | "fuzzy" | null }],
  "total": 83, "page": 1, "pageSize": 20, "totalPages": 5 }
```

With `q`, results are ranked exact, then abbreviation, then fuzzy matches.
Otherwise, and for ties, results are in date order (undated last), then by ledger page and line.

### `GET /api/burials/:id`

One `Burial`:

```json
{ "id": 6, "sourcePage": 6, "lineOnPage": 6, "entryNo": "868",
  "nameAsWritten": "Jno. Harris", "isInfantOf": false, "burialDate": "1905-10-11",
  "ageYears": "93", "ageMonthsOrDays": null, "plat": "VR", "section": "1",
  "block": "3", "lot": "23", "range": "B", "grave": "1",
  "uncertainFields": ["nameAsWritten", "lot"], "transcriberNote": "Plat code struck through" }
```

Blank values are `null`. Location and age values are always strings. `uncertainFields`
uses the API field names above.

### `GET /api/stats`

`{ total, infants, undated, earliestDate, latestDate, byMonth: [{ month, total, infants }], byPlat: [{ plat, total }], sourcePages }`

### Admin: `/api/admin/*`

Every request needs HTTP Basic credentials (`401` otherwise). `GET /session` checks them.
`POST /burials` adds a record (body: a `Burial` without `id`; the next id is assigned),
`PUT /burials/:id` replaces one, `DELETE /burials/:id` removes one (`204`).

## Code layout

- `src/app.ts`: builds the Hono app. `src/index.ts` serves it on port 8080; `api/index.ts` is the Vercel function.
- `src/data/types.ts`: `Burial` and the `BurialRepository` interface (`search`, `getById`, `stats`).
- `src/data/burials.ts`: the in-memory repository. A database version only needs to implement the same interface.
- `src/data/supabase.ts`: reads `burial_records` from Supabase and maps rows to `Burial` (`index_record` is the record id).
- `src/data/load.ts`: CSV parsing and validation.
- `src/data/match.ts`, `src/data/abbreviations.ts`: name matching. Add abbreviations to the list as they turn up.
- `src/routes/burials.ts`: HTTP routes and parameter validation.
- `src/routes/admin.ts`: the signed-in add/edit/delete routes and record validation.
