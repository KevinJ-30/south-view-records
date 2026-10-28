import { useId, useState, type FormEvent } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { Link } from "react-router";
import { usePageTitle } from "@/hooks/use-page-title";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  createBurial,
  deleteBurial,
  getAdminSession,
  searchBurials,
  updateBurial,
  type AdminCredentials,
  type AdminSession,
  type Burial,
  type BurialInput,
} from "@/lib/api";
import { formatCitation, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Where the admin page lives. Nothing links here; change it to move the page.
 * This only keeps the page out of sight: the sign-in is what protects the records.
 */
export const ADMIN_PATH = "/manage-7f3k9q";

const STORAGE_KEY = "south-view-admin";
const PAGE_SIZE = 25;

const focusRing = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const inputClass = cn(
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground focus-visible:border-ring",
  focusRing,
);

/** Credentials stay in this tab only, and are dropped when it closes. */
function loadCredentials(): AdminCredentials | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdminCredentials) : null;
  } catch {
    return null;
  }
}

function saveCredentials(credentials: AdminCredentials | null) {
  try {
    if (credentials) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the admin signs in again after a reload.
  }
}

export function AdminPage() {
  usePageTitle("Manage records");
  const [credentials, setCredentials] = useState(loadCredentials);
  const session = useQuery({
    queryKey: ["admin-session", credentials],
    queryFn: async () => {
      try {
        const result = await getAdminSession(credentials!);
        saveCredentials(credentials);
        return result;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) saveCredentials(null);
        throw error;
      }
    },
    enabled: credentials !== null,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });
  const wrongPassword = session.error instanceof ApiError && session.error.status === 401 ? session.error.message : null;

  const signOut = () => {
    saveCredentials(null);
    setCredentials(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 tabIndex={-1} className="font-heading text-3xl font-semibold text-foreground outline-none">
        Manage records
      </h1>
      {credentials === null || wrongPassword !== null ? (
        <SignInForm error={wrongPassword} onSignIn={setCredentials} />
      ) : session.isPending ? (
        <p role="status" className="flex items-center gap-2 text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> Signing in…
        </p>
      ) : session.isError ? (
        <div role="alert" className="rounded-2xl border border-destructive/40 bg-card p-5">
          <p className="font-medium text-destructive">Couldn’t sign in.</p>
          <p className="mt-1 text-muted-foreground">{session.error.message}</p>
          <Button className="mt-3" variant="outline" onClick={() => session.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <Dashboard credentials={credentials} session={session.data} onSignOut={signOut} />
      )}
    </div>
  );
}

function SignInForm({ error, onSignIn }: { error: string | null; onSignIn: (credentials: AdminCredentials) => void }) {
  const id = useId();
  return (
    <form
      className="flex max-w-sm flex-col gap-4 rounded-2xl border border-border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSignIn({ username: String(form.get("username") ?? ""), password: String(form.get("password") ?? "") });
      }}
    >
      <h2 className="font-heading text-xl font-semibold text-foreground">Sign in</h2>
      {error ? (
        <p role="alert" className="font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-username`} className="text-sm font-medium">
          Username
        </label>
        <input id={`${id}-username`} name="username" autoComplete="username" required className={inputClass} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-password`} className="text-sm font-medium">
          Password
        </label>
        <input
          id={`${id}-password`}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>
      <Button type="submit" className="h-11 px-5">
        Sign in
      </Button>
    </form>
  );
}

function Dashboard({
  credentials,
  session,
  onSignOut,
}: {
  credentials: AdminCredentials;
  session: AdminSession;
  onSignOut: () => void;
}) {
  const [editing, setEditing] = useState<Burial | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{session.username}</span>
        </p>
        <Button variant="ghost" onClick={onSignOut}>
          Sign out
        </Button>
      </div>

      {session.persistent ? null : (
        <p role="note" className="rounded-xl border border-gold bg-card px-4 py-3">
          The server is reading records from CSV files, so changes made here are lost when it restarts. Set
          SUPABASE_URL and SUPABASE_KEY on the server to save them.
        </p>
      )}

      <p role="status" className="empty:hidden rounded-xl border border-primary/40 bg-card px-4 py-3">
        {notice}
      </p>

      {editing ? (
        <RecordEditor
          key={editing === "new" ? "new" : editing.id}
          credentials={credentials}
          burial={editing === "new" ? null : editing}
          onDone={(message) => {
            setEditing(null);
            setNotice(message);
          }}
        />
      ) : (
        <RecordList
          credentials={credentials}
          onEdit={(burial) => {
            setNotice(null);
            setEditing(burial);
          }}
          onAdd={() => {
            setNotice(null);
            setEditing("new");
          }}
          onNotice={setNotice}
        />
      )}
    </>
  );
}

/** Refetches everything that shows records, here and on the public pages. */
function useInvalidateRecords() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["burials"] }),
      queryClient.invalidateQueries({ queryKey: ["burial"] }),
      queryClient.invalidateQueries({ queryKey: ["stats"] }),
    ]);
}

function RecordList({
  credentials,
  onEdit,
  onAdd,
  onNotice,
}: {
  credentials: AdminCredentials;
  onEdit: (burial: Burial) => void;
  onAdd: () => void;
  onNotice: (message: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (q) params.set("q", q);
  const results = useQuery({
    queryKey: ["burials", params.toString()],
    queryFn: () => searchBurials(params),
    placeholderData: keepPreviousData,
  });
  const invalidate = useInvalidateRecords();
  /** Records ticked for deletion, kept while paging so a selection can span pages. */
  const [selected, setSelected] = useState<Map<number, Burial>>(new Map());
  const remove = useMutation({
    // One request per record; failures are reported without stopping the rest.
    mutationFn: async (burials: Burial[]) => {
      const results = await Promise.allSettled(burials.map((burial) => deleteBurial(credentials, burial.id)));
      return burials.flatMap((burial, index) => {
        const result = results[index];
        return result.status === "rejected" ? [{ burial, reason: (result.reason as Error).message }] : [];
      });
    },
    onSuccess: async (failed, burials) => {
      await invalidate();
      const deleted = burials.filter((burial) => !failed.some((failure) => failure.burial.id === burial.id));
      setSelected((current) => {
        const next = new Map(current);
        for (const burial of deleted) next.delete(burial.id);
        return next;
      });
      if (deleted.length) {
        onNotice(
          deleted.length === 1
            ? `Deleted “${deleted[0].nameAsWritten}” (record #${deleted[0].id}).`
            : `Deleted ${deleted.length} records.`,
        );
      }
      if (failed.length) throw new Error(failed.map((f) => `“${f.burial.nameAsWritten}”: ${f.reason}`).join("; "));
    },
  });

  const toggle = (burial: Burial, on: boolean) =>
    setSelected((current) => {
      const next = new Map(current);
      if (on) next.set(burial.id, burial);
      else next.delete(burial.id);
      return next;
    });

  const confirmDelete = (burials: Burial[]) => {
    const names = burials.slice(0, 5).map((burial) => `• ${burial.nameAsWritten} (#${burial.id})`);
    if (burials.length > 5) names.push(`• and ${burials.length - 5} more`);
    const message =
      burials.length === 1
        ? `Delete “${burials[0].nameAsWritten}” (record #${burials[0].id})? This can’t be undone.`
        : `Delete these ${burials.length} records? This can’t be undone.\n\n${names.join("\n")}`;
    if (window.confirm(message)) remove.mutate(burials);
  };

  return (
    <section aria-labelledby={`${id}-heading`} aria-busy={results.isFetching} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-heading`} className="font-heading text-xl font-semibold text-foreground">
          Records
        </h2>
        <Button className="h-11 px-5" onClick={onAdd}>
          <PlusIcon aria-hidden="true" /> Add a record
        </Button>
      </div>

      <form
        role="search"
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setQ(draft.trim());
          setPage(1);
          setSelected(new Map());
        }}
      >
        <label htmlFor={`${id}-q`} className="sr-only">
          Search by name
        </label>
        <input
          id={`${id}-q`}
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search by name"
          autoComplete="off"
          className={cn(inputClass, "flex-1")}
        />
        <Button type="submit" variant="outline" className="h-11 px-4">
          <SearchIcon aria-hidden="true" /> Search
        </Button>
      </form>

      {remove.isError ? (
        <p role="alert" className="font-medium text-destructive">
          Couldn’t delete: {remove.error.message}
        </p>
      ) : null}

      {results.isPending ? (
        <p role="status" className="flex items-center gap-2 text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> Loading records…
        </p>
      ) : results.isError ? (
        <div role="alert" className="rounded-2xl border border-destructive/40 bg-card p-5">
          <p className="text-muted-foreground">{results.error.message}</p>
          <Button className="mt-3" variant="outline" onClick={() => results.refetch()}>
            Try again
          </Button>
        </div>
      ) : results.data.total === 0 ? (
        <p className="text-muted-foreground">{q ? `No records match “${q}”.` : "There are no records yet."}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {results.data.total} {results.data.total === 1 ? "record" : "records"}
            {q ? ` for “${q}”` : ""}
          </p>
          <SelectionBar
            pageItems={results.data.items}
            selected={selected}
            pending={remove.isPending}
            onSelectPage={(on) =>
              setSelected((current) => {
                const next = new Map(current);
                for (const burial of results.data.items) {
                  if (on) next.set(burial.id, burial);
                  else next.delete(burial.id);
                }
                return next;
              })
            }
            onClear={() => setSelected(new Map())}
            onDelete={() => confirmDelete([...selected.values()])}
          />
          <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
            {results.data.items.map((burial) => (
              <li
                key={burial.id}
                className={cn(
                  "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3",
                  selected.has(burial.id) && "bg-muted/60",
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.has(burial.id)}
                  onChange={(event) => toggle(burial, event.target.checked)}
                  aria-label={`Select ${burial.nameAsWritten} (#${burial.id})`}
                  className="size-5 shrink-0 accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/records/${burial.id}`}
                    className={cn("font-medium break-words text-foreground underline-offset-4 hover:underline", focusRing)}
                  >
                    {burial.nameAsWritten}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    #{burial.id} · {burial.burialDate ? formatDate(burial.burialDate) : "No date"} ·{" "}
                    {formatCitation(burial)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => onEdit(burial)}>
                    <PencilIcon aria-hidden="true" /> Edit<span className="sr-only"> {burial.nameAsWritten}</span>
                  </Button>
                  <Button variant="destructive" disabled={remove.isPending} onClick={() => confirmDelete([burial])}>
                    <Trash2Icon aria-hidden="true" /> Delete<span className="sr-only"> {burial.nameAsWritten}</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {results.data.totalPages > 1 ? (
            <nav aria-label="Pages of records" className="flex items-center justify-between gap-3">
              <Button variant="outline" className="h-11 px-4" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeftIcon aria-hidden="true" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {results.data.page} of {results.data.totalPages}
              </span>
              <Button
                variant="outline"
                className="h-11 px-4"
                disabled={page >= results.data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next <ChevronRightIcon aria-hidden="true" />
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}

/** "Select all on this page", the selection count, and the bulk delete button. */
function SelectionBar({
  pageItems,
  selected,
  pending,
  onSelectPage,
  onClear,
  onDelete,
}: {
  pageItems: Burial[];
  selected: Map<number, Burial>;
  pending: boolean;
  onSelectPage: (on: boolean) => void;
  onClear: () => void;
  onDelete: () => void;
}) {
  const onPage = pageItems.filter((burial) => selected.has(burial.id)).length;
  const allOnPage = pageItems.length > 0 && onPage === pageItems.length;
  const offPage = selected.size - onPage;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2">
      <label className="flex items-center gap-3 py-1">
        <input
          type="checkbox"
          checked={allOnPage}
          ref={(element) => {
            if (element) element.indeterminate = onPage > 0 && !allOnPage;
          }}
          onChange={(event) => onSelectPage(event.target.checked)}
          className="size-5 accent-primary"
        />
        Select all on this page
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {selected.size > 0 ? (
          <>
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {selected.size} selected{offPage > 0 ? ` (${offPage} on other pages)` : ""}
            </span>
            <Button variant="ghost" onClick={onClear}>
              Clear
            </Button>
          </>
        ) : null}
        <Button variant="destructive" disabled={selected.size === 0 || pending} onClick={onDelete}>
          {pending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <Trash2Icon aria-hidden="true" />}
          Delete selected
        </Button>
      </div>
    </div>
  );
}

type FieldSpec = {
  name: keyof BurialInput;
  label: string;
  type?: "text" | "number" | "date";
  required?: boolean;
  hint?: string;
  /** Whether the transcriber can mark this value as an uncertain reading. */
  uncertain?: boolean;
};

const FIELD_GROUPS: { title: string; fields: FieldSpec[] }[] = [
  {
    title: "Person",
    fields: [
      { name: "nameAsWritten", label: "Name as written", required: true, uncertain: true },
      { name: "burialDate", label: "Burial date", type: "date", uncertain: true },
      { name: "ageYears", label: "Age in years", hint: "A whole number from 0 to 130", uncertain: true },
      { name: "ageMonthsOrDays", label: "Age in months or days", hint: "e.g. “3 months”, “7 days”", uncertain: true },
    ],
  },
  {
    title: "Plot location",
    fields: [
      { name: "plat", label: "Plat", hint: "Capital letters and digits, e.g. VR", uncertain: true },
      { name: "section", label: "Section", hint: "A whole number, 1 or more", uncertain: true },
      { name: "block", label: "Block", hint: "A whole number, 1 or more", uncertain: true },
      { name: "lot", label: "Lot", hint: "As written; can be a word, e.g. Hunter", uncertain: true },
      { name: "range", label: "Range", hint: "Capital letters only, e.g. B", uncertain: true },
      { name: "grave", label: "Grave", hint: "A whole number, 1 or more", uncertain: true },
    ],
  },
  {
    title: "Ledger source",
    fields: [
      { name: "sourcePage", label: "Ledger page", type: "number", required: true },
      { name: "lineOnPage", label: "Line on page", type: "number", required: true },
      { name: "entryNo", label: "Entry number", hint: "A whole number, 1 or more", uncertain: true },
    ],
  },
];

function RecordEditor({
  credentials,
  burial,
  onDone,
}: {
  credentials: AdminCredentials;
  burial: Burial | null;
  onDone: (message: string | null) => void;
}) {
  const id = useId();
  const invalidate = useInvalidateRecords();
  const save = useMutation({
    mutationFn: (input: BurialInput) =>
      burial ? updateBurial(credentials, burial.id, input) : createBurial(credentials, input),
    onSuccess: async (saved) => {
      await invalidate();
      onDone(`Saved “${saved.nameAsWritten}” (record #${saved.id}).`);
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: keyof BurialInput) => String(form.get(name) ?? "").trim() || null;
    save.mutate({
      sourcePage: Number(form.get("sourcePage")),
      lineOnPage: Number(form.get("lineOnPage")),
      entryNo: text("entryNo"),
      nameAsWritten: text("nameAsWritten") ?? "",
      isInfantOf: form.get("isInfantOf") === "on",
      burialDate: text("burialDate"),
      ageYears: text("ageYears"),
      ageMonthsOrDays: text("ageMonthsOrDays"),
      // The table only takes capitals here, so "b" is saved as "B".
      plat: text("plat")?.toUpperCase() ?? null,
      section: text("section"),
      block: text("block"),
      lot: text("lot"),
      range: text("range")?.toUpperCase() ?? null,
      grave: text("grave"),
      uncertainFields: form.getAll("uncertain").map(String),
      transcriberNote: text("transcriberNote"),
    });
  };

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4">
      <h2 id={`${id}-heading`} className="font-heading text-xl font-semibold text-foreground">
        {burial ? `Edit record #${burial.id}` : "Add a record"}
      </h2>
      <form className="flex flex-col gap-5" onSubmit={onSubmit}>
        {FIELD_GROUPS.map((group) => (
          <fieldset key={group.title} className="rounded-2xl border border-border bg-card p-5">
            <legend className="px-1 font-heading text-lg font-semibold text-foreground">{group.title}</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {group.fields.map((field) => (
                <Field key={field.name} field={field} burial={burial} />
              ))}
              {group.title === "Person" ? (
                <label className="flex items-center gap-2 sm:col-span-2">
                  <input type="checkbox" name="isInfantOf" defaultChecked={burial?.isInfantOf ?? false} className="size-4" />
                  Infant of a parent (listed as “Inf. of …”)
                </label>
              ) : null}
            </div>
          </fieldset>
        ))}

        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-note`} className="text-sm font-medium">
            Transcriber’s note
          </label>
          <textarea
            id={`${id}-note`}
            name="transcriberNote"
            rows={3}
            defaultValue={burial?.transcriberNote ?? ""}
            className={cn(inputClass, "h-auto py-2")}
          />
        </div>

        {save.isError ? (
          <p role="alert" className="font-medium text-destructive">
            Couldn’t save: {save.error.message}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="h-11 px-5" disabled={save.isPending}>
            {save.isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
            {burial ? "Save changes" : "Add record"}
          </Button>
          <Button type="button" variant="ghost" className="h-11 px-4" onClick={() => onDone(null)}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}

function Field({ field, burial }: { field: FieldSpec; burial: Burial | null }) {
  const id = useId();
  const value = burial?.[field.name];
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {field.label}
        {field.required ? <RequiredMark /> : null}
      </label>
      <input
        id={id}
        name={field.name}
        type={field.type ?? "text"}
        min={field.type === "number" ? 1 : undefined}
        required={field.required}
        defaultValue={value === null || value === undefined ? "" : String(value)}
        aria-describedby={field.hint ? `${id}-hint` : undefined}
        className={inputClass}
      />
      {field.hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {field.hint}
        </p>
      ) : null}
      {field.uncertain ? (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="uncertain"
            value={field.name}
            defaultChecked={burial?.uncertainFields.includes(field.name) ?? false}
            className="size-4"
          />
          Uncertain reading<span className="sr-only"> of {field.label.toLowerCase()}</span>
        </label>
      ) : null}
    </div>
  );
}

function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      {" "}
      *
    </span>
  );
}
