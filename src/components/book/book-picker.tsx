"use client";

import { Loader2, Search } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { searchBooksAction } from "@/app/actions/books";
import { Dialog } from "@/components/ui/dialog";
import type { Book } from "@/lib/types";
import { authorLine } from "@/lib/utils";
import { BookCover } from "./book-cover";

/** Search our catalogue + Open Library and pick a book. */
export function BookPicker({ open, onClose, onPick, title = "Find a book", suggestions = [] }: { open: boolean; onClose: () => void; onPick: (b: Book) => void; title?: string; suggestions?: Book[] }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => {
      start(async () => {
        const res = await searchBooksAction(q);
        if (res.ok) {
          setResults(res.data);
          setError(null);
        } else setError(res.error);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const list = q.trim().length >= 2 ? results ?? [] : suggestions;

  return (
    <Dialog open={open} onClose={onClose} title={title} description="Search by title, author or ISBN.">
      <label className="relative block">
        <span className="sr-only">Search books</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Piranesi, Rooney, 9780…" className="field pl-9" autoComplete="off" />
        {pending && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-faint" />}
      </label>
      {error && <p className="mt-3 text-sm text-burgundy">{error}</p>}
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
        {q.trim().length >= 2 && results && results.length === 0 && !pending && (
          <li className="py-6 text-center text-sm text-ink-soft">No books found for “{q}”. Try the author&rsquo;s surname or an ISBN.</li>
        )}
      </ul>
    </Dialog>
  );
}
