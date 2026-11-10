"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { undoShelfMoveAction } from "@/app/actions/books";
import {
  addSuggestionAction,
  dismissSuggestionAction,
  loadSuggestionsAction,
  restoreSuggestionAction,
} from "@/app/actions/suggestions";
import { BookCover } from "@/components/book/book-cover";
import { Button, buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { bookHref } from "@/lib/book-ref";
import { explain } from "@/lib/suggestions/engine";
import type { Page, Suggestion } from "@/lib/types";
import { authorLine, cn } from "@/lib/utils";

/**
 * The suggestions feed: one book per row, each with the handwritten note that says why
 * (a bookshop's shelf-talker). Vertical on purpose, so every reason gets read.
 */
export function SuggestionList({ initial, compact = false }: { initial: Page<Suggestion>; compact?: boolean }) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [, start] = useTransition();
  const toast = useToast();
  const reduce = useReducedMotion();

  const putBack = (s: Suggestion, at: number) =>
    setItems((xs) => (xs.some((x) => x.id === s.id) ? xs : [...xs.slice(0, at), s, ...xs.slice(at)]));

  const dismiss = (s: Suggestion) => {
    const at = items.findIndex((x) => x.id === s.id);
    setItems((xs) => xs.filter((x) => x.id !== s.id));
    start(async () => {
      const res = await dismissSuggestionAction(s.id);
      if (!res.ok) {
        putBack(s, at);
        return toast(res.error, "error");
      }
      toast(`${s.book.title} won't be suggested again`, "default", {
        label: "Undo",
        onClick: async () => {
          const r = await restoreSuggestionAction(s.id);
          if (r.ok) putBack(s, at);
          else toast(r.error, "error");
        },
      });
    });
  };

  const add = (s: Suggestion) => {
    const at = items.findIndex((x) => x.id === s.id);
    setBusy(s.id);
    start(async () => {
      const res = await addSuggestionAction(s.id);
      setBusy(null);
      if (!res.ok) return toast(res.error, "error");
      setItems((xs) => xs.filter((x) => x.id !== s.id));
      const { undo, alreadyShelved } = res.data;
      toast(alreadyShelved ? `${s.book.title} is already on your shelves` : `Added ${s.book.title} to Want to Read`, "default",
        undo
          ? {
              label: "Undo",
              onClick: async () => {
                const [u, r] = await Promise.all([undoShelfMoveAction(undo), restoreSuggestionAction(s.id)]);
                if (u.ok && r.ok) putBack(s, at);
                else toast(!u.ok ? u.error : !r.ok ? r.error : "Couldn't undo that", "error");
              },
            }
          : undefined,
      );
    });
  };

  const more = () =>
    startLoading(async () => {
      const res = await loadSuggestionsAction(cursor);
      if (!res.ok) return toast(res.error, "error");
      setItems((xs) => [...xs, ...res.data.items.filter((n) => !xs.some((x) => x.id === n.id))]);
      setCursor(res.data.nextCursor);
    });

  if (items.length === 0) {
    return (
      <p className="hand py-6 text-2xl text-ink-soft">
        That&rsquo;s everything for now. Add a few more books and new suggestions will turn up.
      </p>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-line border-y border-line">
        <AnimatePresence initial={false}>
          {items.map((s) => (
            <motion.li
              key={s.id}
              layout={!reduce}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.22 } }}
              className="overflow-hidden"
            >
              <SuggestionRow s={s} compact={compact} busy={busy === s.id} onAdd={() => add(s)} onDismiss={() => dismiss(s)} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {cursor && !compact && (
        <div className="mt-8 flex justify-center">
          <Button variant="paper" onClick={more} disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Show more suggestions
          </Button>
        </div>
      )}
    </div>
  );
}

function SuggestionRow({ s, compact, busy, onAdd, onDismiss }: { s: Suggestion; compact: boolean; busy: boolean; onAdd: () => void; onDismiss: () => void }) {
  const b = s.book;
  const href = bookHref(b);
  const [primary, secondary] = s.reasons;
  const topics = (b.subjects.length ? b.subjects : b.genres).slice(0, 3);
  return (
    <article className={cn("grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 sm:gap-x-8", compact ? "py-5" : "py-7 sm:py-9")}>
      <Link href={href} className="block self-start transition-transform hover:-translate-y-1 focus-visible:-translate-y-1" tabIndex={-1} aria-hidden>
        <BookCover title={b.title} authors={b.authors} coverUrl={b.coverUrl} size={compact ? "sm" : "md"} />
      </Link>

      <div className="min-w-0">
        <h3 className={cn("font-serif leading-tight", compact ? "text-xl" : "text-2xl sm:text-3xl")}>
          <Link href={href} className="hover:text-burgundy">{b.title}</Link>
        </h3>
        <p className="mt-1 text-sm text-ink-soft">
          <span className="italic">{authorLine(b.authors)}</span>
          {b.publishedYear ? <span>, {b.publishedYear < 0 ? `${-b.publishedYear} BCE` : b.publishedYear}</span> : null}
        </p>
        {topics.length > 0 && <p className="mt-1 text-xs text-sage-deep">{topics.map((t, i) => (i === 0 ? t.charAt(0).toUpperCase() + t.slice(1) : t.toLowerCase())).join(", ")}</p>}

        {primary && (
          // The shelf-talker: why this book, in a bookseller's hand.
          <div className="relative mt-4 max-w-xl -rotate-[0.4deg] border-l-2 border-burgundy/60 bg-butter/45 px-4 py-2.5">
            <p className="hand text-xl leading-snug text-ink sm:text-[1.4rem]">{explain(primary)}</p>
            {secondary && !compact && <p className="mt-0.5 text-[0.8125rem] text-ink-soft">{explain(secondary)}</p>}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button size="sm" onClick={onAdd} disabled={busy} aria-label={`Add ${b.title} to Want to Read`}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            Want to read
          </Button>
          <Link href={href} className={buttonClass("ghost", "sm", "px-2")}>View book</Link>
          <button type="button" onClick={onDismiss} className="text-[0.8125rem] text-ink-faint underline-offset-4 hover:text-burgundy hover:underline" aria-label={`Not interested in ${b.title}`}>
            Not for me
          </button>
        </div>
      </div>
    </article>
  );
}
