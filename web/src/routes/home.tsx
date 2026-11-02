import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import logo from "@/assets/south-view-logo.png";
import { SearchForm } from "@/components/search-form";
import { usePageTitle } from "@/hooks/use-page-title";
import { getStats } from "@/lib/api";
import { formatMonth, formatPages } from "@/lib/format";
import { cn } from "@/lib/utils";

const focusRing = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** "1905-10" -> the /search URL for every burial that month. */
function monthSearch(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `/search?${new URLSearchParams({ from: `${month}-01`, to: `${month}-${lastDay}` })}`;
}

export function HomePage() {
  usePageTitle(null);
  const stats = useQuery({ queryKey: ["stats"], queryFn: getStats });

  return (
    <div className="flex flex-col gap-10 pt-4 sm:pt-10">
      <div className="flex flex-col items-center gap-6 text-center">
        <img src={logo} alt="South-View Burial Records Index" className="w-44 sm:w-56" />
        <div className="flex flex-col gap-3">
          <h1 tabIndex={-1} className="font-heading text-3xl font-semibold text-foreground outline-none sm:text-4xl">
            Find a burial record
          </h1>
          <p className="mx-auto max-w-xl text-base text-muted-foreground sm:text-lg">
            Search transcriptions of South-View Cemetery’s handwritten grave record ledgers, 1905–1918. Every name is
            shown exactly as the clerk wrote it.
          </p>
        </div>
      </div>

      <SearchForm size="large" />

      {stats.data ? (
        <section aria-labelledby="coverage" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="coverage" className="font-heading text-lg font-semibold text-foreground">
            What’s transcribed so far
          </h2>
          <p className="mt-1 text-muted-foreground">
            {stats.data.total} burials from ledger {formatPages(stats.data.sourcePages)}. More pages are being added.
          </p>
          <ul className="mt-3 flex flex-col gap-1">
            {stats.data.byMonth.map((month) => (
              <li key={month.month} className="border-b border-border last:border-0">
                <Link
                  to={monthSearch(month.month)}
                  className={cn("flex justify-between gap-4 rounded py-1 hover:bg-muted", focusRing)}
                >
                  <span className="text-foreground underline underline-offset-4">{formatMonth(month.month)}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {month.total} {month.total === 1 ? "burial" : "burials"}
                  </span>
                </Link>
              </li>
            ))}
            {stats.data.undated ? (
              <li>
                <Link
                  to="/search?undated=yes"
                  className={cn("flex justify-between gap-4 rounded py-1 hover:bg-muted", focusRing)}
                >
                  <span className="text-foreground underline underline-offset-4">Date not recorded</span>
                  <span className="text-muted-foreground tabular-nums">
                    {stats.data.undated} {stats.data.undated === 1 ? "burial" : "burials"}
                  </span>
                </Link>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
