import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** Plain GET form → /search. Works without JavaScript. */
export function SearchBox({ defaultValue, className, autoFocus }: { defaultValue?: string; className?: string; autoFocus?: boolean }) {
  return (
    <form action="/search" role="search" className={cn("relative", className)}>
      <label htmlFor="q" className="sr-only">Search books, readers and lists</label>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
      <input id="q" name="q" defaultValue={defaultValue} autoFocus={autoFocus} placeholder="Search books, authors, readers…" className="field pl-9" autoComplete="off" />
    </form>
  );
}
