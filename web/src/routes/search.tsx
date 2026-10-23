import { useId, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { SearchForm } from "@/components/search-form";
import { usePageTitle } from "@/hooks/use-page-title";
import { Uncertain, UncertainLegend } from "@/components/uncertain";
import { Button, buttonVariants } from "@/components/ui/button";
import { getStats, searchBurials, type BurialHit, type SearchResult } from "@/lib/api";
import { formatAge, formatCitation, formatDate, LOCATION_FIELDS } from "@/lib/format";
import { cn } from "@/lib/utils";

const FILTERS = ["from", "to", "infant", "plat", "section", "block", "lot"] as const;

const focusRing = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q")?.trim() ?? "";
  usePageTitle(q ? `“${q}”` : "All records");

  const results = useQuery({
    queryKey: ["burials", params.toString()],
    queryFn: () => searchBurials(params),
    placeholderData: keepPreviousData,
  });

  const activeFilters = FILTERS.filter((name) => params.get(name));

  return (
    <div className="flex flex-col gap-6">
      <h1 tabIndex={-1} className="font-heading text-3xl font-semibold text-primary outline-none">
        {q ? "Search results" : "Browse records"}
      </h1>
      <SearchForm key={q} />
      <Filters key={activeFilters.map((name) => `${name}=${params.get(name)}`).join("&")} open={activeFilters.length > 0} />

      <section aria-labelledby="results-heading" aria-busy={results.isFetching} className="flex flex-col gap-4">
        <h2 id="results-heading" className="sr-only">
          Results
        </h2>
        {results.isPending ? (
          <p className="flex items-center gap-2 text-muted-foreground" role="status">
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> Searching the ledgers…
          </p>
        ) : results.isError ? (
          <div role="alert" className="rounded-2xl border border-destructive/40 bg-card p-5">
            <p className="font-medium text-destructive">Something went wrong.</p>
            <p className="mt-1 text-muted-foreground">{results.error.message}</p>
            <Button className="mt-3" variant="outline" onClick={() => results.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <Results data={results.data} q={q} hasFilters={activeFilters.length > 0} />
        )}
      </section>
    </div>
  );
}

function Results({ data, q, hasFilters }: { data: SearchResult; q: string; hasFilters: boolean }) {
  const [params] = useSearchParams();
  const first = (data.page - 1) * data.pageSize + 1;
  const last = first + data.items.length - 1;
  const exactCount = data.items.filter((item) => item.matchType === "exact").length;
  const onlyVariants = q && data.total > 0 && data.page === 1 && exactCount === 0;
  const anyUncertain = data.items.some((item) => item.uncertainFields.length > 0);

  if (data.total === 0) return <EmptyState q={q} hasFilters={hasFilters} />;

  return (
    <>
      <div className="flex flex-col gap-1">
        <p role="status" className="font-medium">
          {data.items.length === 0
            ? `No records on page ${data.page}. There ${data.total === 1 ? "is" : "are"} ${data.total} in total.`
            : `${data.totalPages === 1 ? `${data.total}` : `Showing ${first}–${last} of ${data.total}`} ${data.total === 1 ? "record" : "records"}${q ? ` for “${q}”` : ""}`}
        </p>
        {anyUncertain ? <UncertainLegend className="text-sm text-muted-foreground" /> : null}
      </div>

      {onlyVariants ? (
        <p className="rounded-xl border border-border bg-card px-4 py-3">
          No exact match for “{q}”. These names are spelled similarly or use a ledger abbreviation.
        </p>
      ) : null}

      <ol className="flex flex-col gap-3">
        {data.items.map((item) => (
          <li key={item.id}>
            <ResultCard burial={item} />
          </li>
        ))}
      </ol>

      {data.totalPages > 1 ? <Pagination page={data.page} totalPages={data.totalPages} params={params} /> : null}
    </>
  );
}

function ResultCard({ burial }: { burial: BurialHit }) {
  const location = useLocation();
  const uncertain = (field: string) => burial.uncertainFields.includes(field);
  const age = formatAge(burial);
  const plot = LOCATION_FIELDS.filter(([field]) => burial[field]);

  return (
    <article className="relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors focus-within:ring-[3px] focus-within:ring-ring/50 hover:border-primary sm:p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-heading text-xl font-semibold text-primary">
          <Link
            to={`/records/${burial.id}`}
            state={{ fromSearch: location.search }}
            className="outline-none after:absolute after:inset-0 after:rounded-2xl hover:underline"
          >
            <Uncertain uncertain={uncertain("nameAsWritten")} static>
              {burial.nameAsWritten}
            </Uncertain>
          </Link>
        </h3>
        {burial.isInfantOf ? <Tag>Infant</Tag> : null}
        {burial.matchType === "fuzzy" ? <Tag tone="gold">Similar spelling</Tag> : null}
        {burial.matchType === "abbreviation" ? <Tag tone="gold">Abbreviated name</Tag> : null}
      </div>
      <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1 text-sm sm:text-base">
        <dt className="text-muted-foreground">Buried</dt>
        <dd>{burial.burialDate ? formatDate(burial.burialDate) : <NotRecorded />}</dd>
        <dt className="text-muted-foreground">Age</dt>
        <dd>
          {age ? (
            <Uncertain uncertain={uncertain("ageYears") || uncertain("ageMonthsOrDays")} static>
              {age}
            </Uncertain>
          ) : (
            <NotRecorded />
          )}
        </dd>
        <dt className="text-muted-foreground">Location</dt>
        <dd>
          {plot.length ? (
            plot.map(([field, label], index) => (
              <span key={field}>
                {index > 0 ? ", " : null}
                {label}{" "}
                <Uncertain uncertain={uncertain(field)} static>
                  {burial[field]}
                </Uncertain>
              </span>
            ))
          ) : (
            <NotRecorded />
          )}
          {burial.plat ? (
            <span className="text-muted-foreground">
              {" "}
              (plat{" "}
              <Uncertain uncertain={uncertain("plat")} static>
                {burial.plat}
              </Uncertain>
              )
            </span>
          ) : null}
        </dd>
      </dl>
      <p className="text-sm text-muted-foreground">{formatCitation(burial)}</p>
    </article>
  );
}

function Tag({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "gold" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tone === "gold" ? "border-gold text-gold-ink" : "border-primary/40 text-primary",
      )}
    >
      {children}
    </span>
  );
}

function NotRecorded() {
  return <span className="text-muted-foreground italic">Not recorded</span>;
}

function EmptyState({ q, hasFilters }: { q: string; hasFilters: boolean }) {
  const [params] = useSearchParams();
  const withoutFilters = new URLSearchParams(q ? { q } : {});
  // Suggest the first few letters of the last word, e.g. "Tolberts" -> "Tolb".
  const lastWord = q.split(/\s+/).at(-1) ?? "";
  const shorter = lastWord.length >= 6 ? lastWord.slice(0, 4) : null;

  return (
    <div role="status" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <p className="font-heading text-xl font-semibold text-primary">
        {q ? `No exact match for “${q}”` : "No records match these filters"}
      </p>
      {q ? (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
          <li>
            Old records often have spelling variations; try fewer letters
            {shorter ? (
              <>
                , like{" "}
                <Link className="text-primary underline underline-offset-4" to={`/search?${new URLSearchParams({ ...Object.fromEntries(params), q: shorter, page: "1" })}`}>
                  {shorter}
                </Link>
              </>
            ) : null}
            .
          </li>
          <li>Search for just the surname. Many first names were written as initials (“B.F.”) or abbreviations (“Wm.”).</li>
          <li>Infants are often listed under a parent’s name, as “Inf. of …”.</li>
        </ul>
      ) : null}
      {hasFilters ? (
        <p>
          <Link className="font-medium text-primary underline underline-offset-4" to={`/search?${withoutFilters}`}>
            Clear the date, plot, and infant filters
          </Link>{" "}
          <span className="text-muted-foreground">and search everything.</span>
        </p>
      ) : null}
    </div>
  );
}

function Pagination({ page, totalPages, params }: { page: number; totalPages: number; params: URLSearchParams }) {
  const hrefFor = (target: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(target));
    return `/search?${next}`;
  };
  const linkClass = cn(buttonVariants({ variant: "outline" }), "h-11 px-4", focusRing);
  const disabledClass = cn(linkClass, "pointer-events-none opacity-50");

  return (
    <nav aria-label="Pages of results" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link to={hrefFor(page - 1)} className={linkClass}>
          <ChevronLeftIcon aria-hidden="true" /> Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          <ChevronLeftIcon aria-hidden="true" /> Previous
        </span>
      )}
      <span className="text-sm text-muted-foreground" aria-current="page">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link to={hrefFor(page + 1)} className={linkClass}>
          Next <ChevronRightIcon aria-hidden="true" />
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          Next <ChevronRightIcon aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}

function Filters({ open }: { open: boolean }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const stats = useQuery({ queryKey: ["stats"], queryFn: getStats });
  const id = useId();
  const field = (name: string) => `${id}-${name}`;
  const inputClass = cn(
    "h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground focus-visible:border-ring",
    focusRing,
  );
  const minDate = stats.data?.earliestDate ?? "1905-01-01";
  const maxDate = stats.data?.latestDate ?? "1918-12-31";

  return (
    <details open={open} className="group rounded-2xl border border-border bg-card">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 font-medium [&::-webkit-details-marker]:hidden",
          focusRing,
        )}
      >
        Filter by date, plot, or infant
        <ChevronRightIcon aria-hidden="true" className="size-4 transition-transform group-open:rotate-90" />
      </summary>
      <form
        className="flex flex-col gap-4 border-t border-border px-4 pt-4 pb-5"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const next = new URLSearchParams();
          const q = params.get("q");
          if (q) next.set("q", q);
          for (const name of FILTERS) {
            const value = String(form.get(name) ?? "").trim();
            if (value) next.set(name, value);
          }
          navigate(`/search?${next}`);
        }}
      >
        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-medium">Burial date</legend>
          <div className="flex flex-col gap-1">
            <label htmlFor={field("from")} className="text-sm">
              From
            </label>
            <input id={field("from")} name="from" type="date" min={minDate} max={maxDate} defaultValue={params.get("from") ?? ""} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={field("to")} className="text-sm">
              To
            </label>
            <input id={field("to")} name="to" type="date" min={minDate} max={maxDate} defaultValue={params.get("to") ?? ""} className={inputClass} />
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <legend className="mb-2 text-sm font-medium">Plot location</legend>
          <div className="flex flex-col gap-1">
            <label htmlFor={field("plat")} className="text-sm">
              Plat
            </label>
            <select id={field("plat")} name="plat" defaultValue={params.get("plat") ?? ""} className={inputClass}>
              <option value="">Any</option>
              {stats.data?.byPlat.map((plat) => (
                <option key={plat.plat} value={plat.plat}>
                  {plat.plat}
                </option>
              ))}
            </select>
          </div>
          {(["section", "block", "lot"] as const).map((name) => (
            <div key={name} className="flex flex-col gap-1">
              <label htmlFor={field(name)} className="text-sm capitalize">
                {name}
              </label>
              <input id={field(name)} name={name} type="text" defaultValue={params.get(name) ?? ""} className={inputClass} />
            </div>
          ))}
        </fieldset>

        <div className="flex flex-col gap-1 sm:max-w-xs">
          <label htmlFor={field("infant")} className="text-sm font-medium">
            Infants
          </label>
          <select id={field("infant")} name="infant" defaultValue={params.get("infant") ?? ""} className={inputClass}>
            <option value="">Include everyone</option>
            <option value="yes">Only infants</option>
            <option value="no">Leave out infants</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="h-11 px-5">
            Apply filters
          </Button>
          <Link
            to={`/search?${new URLSearchParams(params.get("q") ? { q: params.get("q")! } : {})}`}
            className={cn(buttonVariants({ variant: "ghost" }), "h-11 px-4", focusRing)}
          >
            Clear filters
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Records with no recorded burial date are left out when you filter by date.
        </p>
      </form>
    </details>
  );
}
