import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import { Link, useLocation, useParams } from "react-router";
import { usePageTitle } from "@/hooks/use-page-title";
import { RecordUncertainty, Uncertain } from "@/components/uncertain";
import { ApiError, getBurial, type Burial } from "@/lib/api";
import { formatCitation, formatDate, LOCATION_FIELDS } from "@/lib/format";

export function RecordPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const fromSearch = (location.state as { fromSearch?: string } | null)?.fromSearch;
  const record = useQuery({ queryKey: ["burial", id], queryFn: () => getBurial(id), retry: false });
  const notFound = record.error instanceof ApiError && record.error.status === 404;
  usePageTitle(record.data?.nameAsWritten ?? (record.isPending ? null : "Record not found"));

  return (
    <div className="flex flex-col gap-6">
      <Link
        to={fromSearch !== undefined ? `/search${fromSearch}` : "/search"}
        className="inline-flex w-fit items-center gap-1.5 rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        {fromSearch !== undefined ? "Back to results" : "Search all records"}
      </Link>

      {/* One <h1> element across loading, error, and loaded states keeps keyboard focus on it. */}
      <h1 tabIndex={-1} className="font-heading text-3xl font-semibold break-words text-foreground outline-none sm:text-4xl">
        {record.isPending ? (
          "Loading record…"
        ) : record.isError ? (
          notFound ? "Record not found" : "Something went wrong"
        ) : (
          <Uncertain uncertain={record.data.uncertainFields.includes("nameAsWritten")} field="nameAsWritten">
            {record.data.nameAsWritten}
          </Uncertain>
        )}
      </h1>

      {record.isPending ? (
        <p role="status" className="flex items-center gap-2 text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> Loading record…
        </p>
      ) : record.isError ? (
        <p role="alert" className="text-muted-foreground">
          {notFound ? "This record may have been renumbered. Try searching for the name instead." : record.error.message}
        </p>
      ) : (
        <RecordDetail burial={record.data} />
      )}
    </div>
  );
}

function RecordDetail({ burial }: { burial: Burial }) {
  const uncertain = (field: keyof Burial) => burial.uncertainFields.includes(field);
  const value = (field: keyof Burial) => {
    const raw = burial[field];
    if (raw === null || raw === "") return <NotRecorded uncertain={uncertain(field)} />;
    const shown = field === "burialDate" ? formatDate(String(raw)) : String(raw);
    return (
      <Uncertain uncertain={uncertain(field)} field={field}>
        {shown}
      </Uncertain>
    );
  };

  return (
    <article className="flex flex-col gap-6">
      <header className="-mt-4 flex flex-col gap-2">
        <div aria-hidden="true" className="h-0.5 w-16 bg-gold" />
        <p className="text-lg">
          {burial.burialDate ? `Buried ${formatDate(burial.burialDate)}` : "Burial date not recorded"}
        </p>
        <p className="text-muted-foreground">
          Source: <cite className="not-italic">{formatCitation(burial)}</cite>
        </p>
      </header>

      <RecordUncertainty burial={burial} />

      {burial.transcriberNote ? (
        <section aria-labelledby="note" className="rounded-2xl border border-border bg-card px-5 py-4">
          <h2 id="note" className="text-sm font-medium text-muted-foreground">
            Transcriber’s note
          </h2>
          <p className="mt-1">{burial.transcriberNote}</p>
        </section>
      ) : null}

      <Section title="Person">
        <Row label="Name as written">{value("nameAsWritten")}</Row>
        <Row label="Infant of a parent">{burial.isInfantOf ? "Yes" : "No"}</Row>
        <Row label="Burial date">{value("burialDate")}</Row>
        <Row label="Age in years">{value("ageYears")}</Row>
        <Row label="Age in months or days">{value("ageMonthsOrDays")}</Row>
      </Section>

      <Section
        title="Plot location"
        description="Plat codes are shown as written in the ledger; their meaning is not yet known."
      >
        <Row label="Plat">{value("plat")}</Row>
        {LOCATION_FIELDS.map(([field, label]) => (
          <Row key={field} label={label}>
            {value(field)}
          </Row>
        ))}
      </Section>

      <Section title="Ledger source">
        <Row label="Ledger page">{burial.sourcePage}</Row>
        <Row label="Line on page">{burial.lineOnPage}</Row>
        <Row label="Entry number">{value("entryNo")}</Row>
        <Row label="Index record">#{burial.id}</Row>
      </Section>
    </article>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const id = `section-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-border bg-card p-5">
      <h2 id={id} className="font-heading text-xl font-semibold text-foreground">
        {title}
      </h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-[12rem_1fr]">{children}</dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-subgrid border-b border-border py-2 last:border-0 sm:col-span-2">
      <dt className="text-sm text-muted-foreground sm:text-base">{label}</dt>
      <dd className="text-base">{children}</dd>
    </div>
  );
}

function NotRecorded({ uncertain }: { uncertain: boolean }) {
  return (
    <span className="text-muted-foreground italic">
      {uncertain ? "Not recorded (marked uncertain by the transcriber)" : "Not recorded"}
    </span>
  );
}
