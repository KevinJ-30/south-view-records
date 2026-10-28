import { useId, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { getStats } from "@/lib/api";
import { FILTERS, MONTHS, readFilters, splitDate, type DateBound } from "@/lib/filters";
import { formatDate } from "@/lib/format";
import { UNCERTAINTY_KINDS } from "@/lib/uncertainty";
import { cn } from "@/lib/utils";

const focusRing = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const inputClass = cn(
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground focus-visible:border-ring aria-invalid:border-destructive",
  focusRing,
);

/**
 * Name search with the date, plot, infant, and uncertainty filters behind a large toggle.
 * Submitting goes to /search with the name and filters, starting again from page 1.
 */
export function SearchForm({ size = "default", autoFocus = false }: { size?: "default" | "large"; autoFocus?: boolean }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = useId();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const activeCount = FILTERS.filter((name) => params.get(name)).length;
  const [open, setOpen] = useState(activeCount > 0);
  const [errors, setErrors] = useState<Partial<Record<DateBound, string>>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const stats = useQuery({ queryKey: ["stats"], queryFn: getStats });
  const large = size === "large";
  const field = (name: string) => `${id}-${name}`;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { values, errors: found } = readFilters(new FormData(event.currentTarget));
    const firstError = (["from", "to"] as const).find((bound) => found[bound]);
    if (firstError) {
      // Show the panel before moving focus to the date that needs fixing.
      flushSync(() => {
        setErrors(found);
        setOpen(true);
      });
      document.getElementById(field(`${firstError}Month`))?.focus();
      return;
    }
    setErrors({});
    const next = new URLSearchParams();
    if (query.trim()) next.set("q", query.trim());
    for (const [name, value] of Object.entries(values)) next.set(name, value);
    navigate(`/search?${next}`);
  };

  const clearFilters = () => {
    panelRef.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select").forEach((element) => {
      element.value = "";
    });
    setErrors({});
    if (activeCount > 0) navigate(`/search?${new URLSearchParams(query.trim() ? { q: query.trim() } : {})}`);
  };

  return (
    <form role="search" className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor={field("q")} className={cn("font-medium", large ? "text-lg" : "text-base")}>
          Name of the person
        </label>
        <div className="flex gap-2">
          <input
            id={field("q")}
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus={autoFocus}
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            aria-describedby={field("hint")}
            placeholder="e.g. Tolbert"
            className={cn(
              "min-w-0 flex-1 rounded-xl border border-input bg-card px-4 text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
              large ? "h-14 text-lg" : "h-12 text-base",
            )}
          />
          <Button type="submit" variant="dark" className={cn("rounded-xl px-5", large ? "h-14 text-base" : "h-12")}>
            <SearchIcon aria-hidden="true" />
            Search
          </Button>
        </div>
        <p id={field("hint")} className="text-sm text-muted-foreground">
          A first name, surname, or just part of one. Old spellings and abbreviations like “Jno.” for John are matched
          too. Leave it blank to browse every record.
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        aria-controls={field("filters")}
        onClick={() => setOpen(!open)}
        className={cn(
          "h-auto min-h-14 w-full justify-between rounded-xl bg-card px-5 py-3 text-left text-base whitespace-normal hover:bg-muted",
          open && "rounded-b-none",
        )}
      >
        <span className="flex items-center gap-3">
          <SlidersHorizontalIcon aria-hidden="true" className="size-5 shrink-0" />
          <span>
            Filter by date, plot, or uncertain readings
            {activeCount > 0 ? (
              <span className="ml-2 inline-block rounded-full bg-foreground px-2 py-0.5 text-xs text-background">
                {activeCount} on
              </span>
            ) : null}
          </span>
        </span>
        <ChevronDownIcon aria-hidden="true" className={cn("size-5 transition-transform", open && "rotate-180")} />
      </Button>

      <div
        id={field("filters")}
        ref={panelRef}
        hidden={!open}
        className="-mt-3 flex flex-col gap-6 rounded-b-xl border border-t-0 border-border bg-card px-4 pt-4 pb-5 sm:px-5"
      >
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-medium">Burial date</legend>
          <p className="text-sm text-muted-foreground">
            {stats.data?.earliestDate && stats.data.latestDate
              ? `Records so far run from ${formatDate(stats.data.earliestDate)} to ${formatDate(stats.data.latestDate)}. `
              : null}
            Fill in just a year, or a month and year, to cover the whole period. Records with no date are left out.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DateField bound="from" label="From" field={field} error={errors.from} defaultIso={params.get("from")} />
            <DateField bound="to" label="To" field={field} error={errors.to} defaultIso={params.get("to")} />
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <legend className="mb-2 font-medium">Plot location</legend>
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={field("uncertain")} className="font-medium">
              Uncertain readings
            </label>
            <select id={field("uncertain")} name="uncertain" defaultValue={params.get("uncertain") ?? ""} className={inputClass}>
              <option value="">Include all records</option>
              <option value="any">Anything uncertain</option>
              <option value="none">Nothing uncertain</option>
              <optgroup label="One kind">
                {UNCERTAINTY_KINDS.map((kind) => (
                  <option key={kind.id} value={kind.id}>
                    Uncertain {kind.label.toLowerCase()}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={field("infant")} className="font-medium">
              Infants
            </label>
            <select id={field("infant")} name="infant" defaultValue={params.get("infant") ?? ""} className={inputClass}>
              <option value="">Include everyone</option>
              <option value="yes">Only infants</option>
              <option value="no">Leave out infants</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="dark" className="h-11 px-5">
            Search with these filters
          </Button>
          <Button type="button" variant="ghost" className="h-11 px-4" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Month, day, and year typed separately instead of the browser's date picker. */
function DateField({
  bound,
  label,
  field,
  error,
  defaultIso,
}: {
  bound: DateBound;
  label: string;
  field: (name: string) => string;
  error: string | undefined;
  defaultIso: string | null;
}) {
  const parts = splitDate(defaultIso);
  const errorId = field(`${bound}Error`);
  const invalid = error ? true : undefined;
  const describedBy = error ? errorId : undefined;

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-[1fr_4.5rem_5.5rem] gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={field(`${bound}Month`)} className="text-sm text-muted-foreground">
            Month
          </label>
          <select
            id={field(`${bound}Month`)}
            name={`${bound}Month`}
            defaultValue={parts.month}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={inputClass}
          >
            <option value="">Any</option>
            {MONTHS.map((month, index) => (
              <option key={month} value={String(index + 1)}>
                {month}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={field(`${bound}Day`)} className="text-sm text-muted-foreground">
            Day
          </label>
          <input
            id={field(`${bound}Day`)}
            name={`${bound}Day`}
            inputMode="numeric"
            maxLength={2}
            autoComplete="off"
            defaultValue={parts.day}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={field(`${bound}Year`)} className="text-sm text-muted-foreground">
            Year
          </label>
          <input
            id={field(`${bound}Year`)}
            name={`${bound}Year`}
            inputMode="numeric"
            maxLength={4}
            autoComplete="off"
            defaultValue={parts.year}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={inputClass}
          />
        </div>
      </div>
      {error ? (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
