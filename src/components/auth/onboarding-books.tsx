"use client";

import { Check, Loader2, Search, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { searchBooksAction, searchCatalogueAction, setShelfStatusAction } from "@/app/actions/books";
import { BookCover } from "@/components/book/book-cover";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { bookRef } from "@/lib/book-ref";
import type { Book, SavedBook } from "@/lib/types";
import { authorLine, cn } from "@/lib/utils";

const keyOf = (b: Book) => b.id ?? b.olWorkId ?? `${b.title}|${b.authors[0]}`;

/**
 * An onboarding step that fills a shelf: search (our catalogue first, then Open Library), tap a
 * book to shelve it — saved straight away, so leaving halfway loses nothing — tap again to undo.
 */
export function OnboardingBooks({
  status,
  step,
  title,
  blurb,
  target,
  starter,
  onBack,
  onNext,
}: {
  status: "read" | "want_to_read";
  step: string;
  title: string;
  blurb: string;
  /** How many we encourage (never required). */
  target: number;
  /** What to search for before the reader types: e.g. a favourite author. */
  starter: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Book[]>([]);
  const [searching, setSearching] = useState(false);
  const [added, setAdded] = useState<Map<string, SavedBook>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const toast = useToast();
  const latest = useRef(0);
  const query = q.trim().length >= 2 ? q.trim() : starter;

  useEffect(() => {
    if (query.length < 2) return;
    const t = setTimeout(async () => {
      const id = ++latest.current;
      let full = false;
      setSearching(true);
      searchCatalogueAction(query).then((r) => id === latest.current && !full && r.ok && r.data.length && setResults(r.data));
      const res = await searchBooksAction(query);
      full = true;
      if (id !== latest.current) return;
      setSearching(false);
      if (res.ok) setResults(res.data.slice(0, 12));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const toggle = (b: Book) => {
    const k = keyOf(b);
    const on = added.get(k);
    setBusy(k);
    start(async () => {
      const res = await setShelfStatusAction(on ? { id: on.id } : bookRef(b), on ? null : status, {});
      setBusy(null);
      if (!res.ok) return toast(res.error, "error");
      setAdded((m) => {
        const n = new Map(m);
        if (on) n.delete(k);
        else n.set(k, res.data.book);
        return n;
      });
    });
  };

  const count = added.size;
  return (
    <div className="space-y-5">
      <div>
        <p className="meta text-burgundy">{step}</p>
        <h1 className="mt-1 text-4xl">{title}</h1>
        <p className="mt-1 text-sm text-ink-soft">{blurb}</p>
      </div>

      <label className="relative block">
        <span className="sr-only">Search books</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
        <input className="field pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, author or ISBN" autoComplete="off" />
        {searching && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-faint" />}
      </label>
      {q.trim().length < 2 && starter && <p className="meta -mt-2 normal-case tracking-normal">Starting with {starter}</p>}

      <ul className="grid max-h-[46dvh] grid-cols-3 gap-x-3 gap-y-4 overflow-y-auto pr-1 sm:grid-cols-4" aria-live="polite">
        {results.map((b) => {
          const k = keyOf(b);
          const on = added.has(k);
          return (
            <li key={k}>
              <button
                type="button"
                onClick={() => toggle(b)}
                disabled={busy === k}
                aria-pressed={on}
                aria-label={`${on ? "Remove" : "Add"} ${b.title} by ${authorLine(b.authors)}`}
                className="group relative block w-full text-left"
              >
                <span className={cn("relative block transition-transform group-hover:-translate-y-1", on && "-translate-y-1")}>
                  <BookCover title={b.title} authors={b.authors} coverUrl={b.coverUrl} size="fill" />
                  <span
                    className={cn(
                      "absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full border shadow-sm transition-colors",
                      on ? "border-burgundy bg-burgundy text-paper" : "border-line-strong bg-card/90 text-ink-soft group-hover:text-ink",
                    )}
                  >
                    {busy === k ? <Loader2 className="size-3.5 animate-spin" /> : on ? <Check className="size-3.5" /> : <span className="text-base leading-none">+</span>}
                  </span>
                </span>
                <span className="mt-1.5 line-clamp-2 block font-serif text-sm leading-tight">{b.title}</span>
                <span className="meta block truncate normal-case tracking-normal">{b.authors[0]}</span>
              </button>
            </li>
          );
        })}
        {!searching && results.length === 0 && (
          <li className="col-span-full py-6 text-center text-sm text-ink-soft">Search for a book you know.</li>
        )}
      </ul>

      {count > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3" aria-label="Added so far">
          {[...added.entries()].map(([k, b]) => (
            <span key={k} className="inline-flex items-center gap-1 border border-line-strong bg-card py-0.5 pl-2 pr-1 text-xs">
              {b.title}
              <button type="button" onClick={() => toggle(b)} aria-label={`Remove ${b.title}`} className="p-0.5 text-ink-faint hover:text-burgundy">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <div className="flex items-center gap-3">
          <span className="hand text-xl text-ink-soft" aria-live="polite">
            {count >= target ? "lovely ✓" : `${count} of ${target}`}
          </span>
          <Button size="lg" onClick={onNext}>{count ? "Next →" : "Skip for now →"}</Button>
        </div>
      </div>
    </div>
  );
}
