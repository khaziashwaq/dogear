"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { PageFlip, SearchingRows } from "@/components/ui/searching";
import { cachedBooks, isAbort, searchBooks } from "@/lib/book-search-client";
import type { Book } from "@/lib/types";
import { authorLine } from "@/lib/utils";
import { BookCover } from "./book-cover";

/** Search our catalogue + Open Library and pick a book. */
export function BookPicker({ open, onClose, onPick, title = "Find a book", suggestions = [] }: { open: boolean; onClose: () => void; onPick: (b: Book) => void; title?: string; suggestions?: Book[] }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) return;
    // Searched before this session: rendered straight from the cache below, nothing to fetch.
    if (cachedBooks(q)) return;
    // Aborting on the next keystroke means a slow Open Library answer for "brot" can never replace "brothers".
    const ctrl = new AbortController();
    let full = false;
    const t = setTimeout(async () => {
      setPending(true);
      setError(null);
      // Our own catalogue first (milliseconds), then the full list once Open Library answers. The two run in parallel.
      searchBooks(q, "catalogue", ctrl.signal)
        .then((books) => {
          if (!full) setResults(books);
        })
        .catch(() => {});
      try {
        const books = await searchBooks(q, "all", ctrl.signal);
        full = true;
        setResults(books);
      } catch (e) {
        if (isAbort(e)) return;
        setError(e instanceof Error ? e.message : "Search isn't working right now.");
      }
      setPending(false);
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const searching = q.trim().length >= 2;
  const known = searching ? cachedBooks(q) : undefined;
  const list = searching ? known ?? results ?? [] : suggestions;
  const busy = pending && searching && !known;

  return (
    <Dialog open={open} onClose={onClose} title={title} description="Search by title, author or ISBN.">
      <label className="relative block">
        <span className="sr-only">Search books</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Piranesi, Rooney, 9780…" className="field pl-9 pr-10" autoComplete="off" />
        {busy && list.length > 0 && <PageFlip size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />}
      </label>
      {error && !known && <p className="mt-3 text-sm text-burgundy">{error}</p>}
      {q.trim().length < 2 && suggestions.length > 0 && <p className="meta mt-4">From your shelves</p>}
      <ul className="mt-3 max-h-[50dvh] divide-y divide-line overflow-y-auto">
        {list.map((b) => (
          <li key={b.id ?? b.olWorkId}>
            <button type="button" onClick={() => { onPick(b); onClose(); setQ(""); }} className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-paper-deep">
              <BookCover title={b.title} authors={b.authors} coverUrl={b.coverUrl} size="xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-serif text-lg leading-tight">{b.title}</span>
                <span className="meta block truncate normal-case tracking-normal">{authorLine(b.authors)}{b.publishedYear ? ` · ${b.publishedYear}` : ""}</span>
              </span>
              {!b.id && <span className="meta shrink-0 text-sage-deep">Open Library</span>}
            </button>
          </li>
        ))}
        <SearchingRows active={busy && list.length === 0} placeholders />
        {searching && list.length === 0 && (known || (results && !pending)) && (
          <li className="py-6 text-center text-sm text-ink-soft">No books found for “{q}”. Try the author&rsquo;s surname or an ISBN.</li>
        )}
      </ul>
    </Dialog>
  );
}
