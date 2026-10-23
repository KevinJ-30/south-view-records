# South-View frontend

Search site for the South-View Cemetery burial records index (React, Vite, Tailwind).

## Run it

Start [pitch-backend](https://github.com/lmc-3403-ocr/pitch-backend) first (port 8080), then:

```sh
pnpm install
pnpm dev        # http://localhost:5173
```

In development, Vite forwards `/api` to `http://localhost:8080`. For a deployed build,
set `VITE_API_BASE_URL` to the backend's address.

```sh
pnpm build      # type-check and build to dist/
pnpm lint
```

## Pages

| Path | Page |
| --- | --- |
| `/` | Home: name search and what's transcribed so far |
| `/search?q=…&from=…&to=…&plat=…&section=…&block=…&lot=…&infant=yes|no&page=…` | Results with filters and paging. The URL is the state, so results can be bookmarked and shared |
| `/records/:id` | Every field of one record, uncertain readings, transcriber note, and ledger citation |

The API types live in `src/lib/api.ts` and must match `pitch-backend/src/data/types.ts`.

## Display rules

- Names and values are shown exactly as transcribed, never corrected.
- Fields listed in a record's `uncertainFields` get a dotted gold underline (`.uncertain`).
  On record pages it is a button that explains "Uncertain reading" on hover, focus, or tap.
- Plat codes are shown as written; their meaning is not yet known.
- Brand colors come from the logo: green `#1F3A2E`, gold `#B08A3E` (decorative only;
  use `gold-ink` `#7A5C22` for text), cream `#F4EFE4`.
