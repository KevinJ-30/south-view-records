import { useId, useState } from "react";
import { SearchIcon } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Name search. Submitting goes to /search, keeping any filters already in the URL
 * and starting again from page 1.
 */
export function SearchForm({ size = "default", autoFocus = false }: { size?: "default" | "large"; autoFocus?: boolean }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = useId();
  const [query, setQuery] = useState(params.get("q") ?? "");

  return (
    <form
      role="search"
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const next = new URLSearchParams(params);
        next.delete("page");
        if (query.trim()) next.set("q", query.trim());
        else next.delete("q");
        navigate(`/search?${next}`);
      }}
    >
      <label htmlFor={`${id}-q`} className={cn("font-medium", size === "large" ? "text-lg" : "text-base")}>
        Name of the person
      </label>
      <div className="flex gap-2">
        <input
          id={`${id}-q`}
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          aria-describedby={`${id}-hint`}
          placeholder="e.g. Tolbert"
          className={cn(
            "min-w-0 flex-1 rounded-xl border border-input bg-card px-4 text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            size === "large" ? "h-14 text-lg" : "h-12 text-base",
          )}
        />
        <Button type="submit" className={cn("rounded-xl px-5", size === "large" ? "h-14 text-base" : "h-12")}>
          <SearchIcon aria-hidden="true" />
          Search
        </Button>
      </div>
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        A first name, surname, or just part of one. Old spellings and abbreviations like “Jno.” for John are matched
        too.
      </p>
    </form>
  );
}
