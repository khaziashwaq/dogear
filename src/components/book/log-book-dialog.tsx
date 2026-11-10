"use client";

import { Feather, Highlighter, NotebookPen } from "lucide-react";
import { useId, useState, useTransition, type ReactNode } from "react";
import { logBookAction } from "@/app/actions/books";
import { BookCover } from "@/components/book/book-cover";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { StarInput } from "@/components/ui/stars";
import { useToast } from "@/components/ui/toast";
import { VisibilitySelect } from "@/components/ui/visibility-select";
import { bookRef } from "@/lib/book-ref";
import type { Book, LogBookResult, SavedBook, UserBook, Visibility } from "@/lib/types";
import { authorLine, cn } from "@/lib/utils";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** One optional part of the log, folded away until the reader wants it. */
function Extra({ icon, label, open, onOpen, children }: { icon: ReactNode; label: string; open: boolean; onOpen: () => void; children: ReactNode }) {
  if (open) return <div className="border-t border-line pt-4">{children}</div>;
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-2 border-t border-line py-3 text-left text-sm text-ink-soft hover:text-ink">
      {icon}
      {label}
    </button>
  );
}

/**
 * "I finished this." Date, re-read and stars up front; a review, a favourite line and private
 * notes one tap away. Saves in one go (diary, Read shelf, rating, and whatever was added), and
 * shares to the feed only when asked.
 */
export function LogBookDialog({
  open,
  onClose,
  book,
  userBook,
  defaultReread,
  onLogged,
  onJustShelve,
}: {
  open: boolean;
  onClose: () => void;
  book: Book | SavedBook;
  userBook?: UserBook | null;
  defaultReread?: boolean;
  onLogged: (r: { book: SavedBook; result: LogBookResult; userBook: UserBook | null }) => void;
  /** Offered when the dialog was opened by moving the book to Read: move it without logging. */
  onJustShelve?: () => void;
}) {
  const id = useId();
  const [date, setDate] = useState(today);
  const [reread, setReread] = useState(Boolean(defaultReread));
  const [rating, setRating] = useState<number | null>(userBook?.rating ?? null);
  const [show, setShow] = useState({ review: false, quote: false, notes: false });
  const [review, setReview] = useState({ title: "", body: "", spoilers: false });
  const [quote, setQuote] = useState({ body: "", page: "" });
  const [notes, setNotes] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [share, setShare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  const hasPublic = Boolean(review.body.trim() || quote.body.trim() || share);

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await logBookAction(bookRef(book), {
        finishedOn: date || null,
        rating,
        reread,
        notes: notes || null,
        review: review.body.trim() ? { title: review.title || null, body: review.body, containsSpoilers: review.spoilers } : null,
        quote: quote.body.trim() ? { body: quote.body, page: quote.page || null } : null,
        visibility,
        share,
      });
      if (!res.ok) return setError(res.error);
      toast(`Logged ${book.title}${res.data.result.reviewId ? " with your review" : ""}`);
      onLogged(res.data);
      onClose();
    });

  return (
    <Dialog open={open} onClose={onClose} title={`Finished ${book.title}?`} description="Log it in your diary. Everything below the stars is optional.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-5"
      >
        <div className="flex gap-4">
          <BookCover title={book.title} authors={book.authors} coverUrl={book.coverUrl} size="sm" />
          <div className="min-w-0 flex-1 space-y-3">
            <p className="meta normal-case tracking-normal">{authorLine(book.authors)}</p>
            <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
              <label className="block">
                <span className="meta mb-1 block">Finished on</span>
                <input type="date" className="field h-10 w-auto py-1" value={date} max={today()} onChange={(e) => setDate(e.target.value)} required />
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input type="checkbox" className="size-4 accent-burgundy" checked={reread} onChange={(e) => setReread(e.target.checked)} />
                I&rsquo;ve read it before
              </label>
            </div>
          </div>
        </div>

        <div>
          <span className="meta mb-1 block" id={`${id}-stars`}>Your rating</span>
          <StarInput value={rating} onChange={setRating} size="lg" label="Your rating" />
        </div>

        <div>
          <Extra icon={<Feather className="size-4" />} label="Write a review" open={show.review} onOpen={() => setShow((s) => ({ ...s, review: true }))}>
            <label className="block">
              <span className="meta mb-1 block">Review</span>
              <input className="field mb-2" placeholder="A title, if you like" maxLength={140} value={review.title} onChange={(e) => setReview((r) => ({ ...r, title: e.target.value }))} />
              <textarea className="field min-h-28" maxLength={20000} placeholder="What stayed with you?" value={review.body} onChange={(e) => setReview((r) => ({ ...r, body: e.target.value }))} autoFocus />
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" className="size-4 accent-burgundy" checked={review.spoilers} onChange={(e) => setReview((r) => ({ ...r, spoilers: e.target.checked }))} />
              Contains spoilers
            </label>
          </Extra>
          <Extra icon={<Highlighter className="size-4" />} label="Save a line you loved" open={show.quote} onOpen={() => setShow((s) => ({ ...s, quote: true }))}>
            <label className="block">
              <span className="meta mb-1 block">Favourite line</span>
              <textarea className="field min-h-20 font-serif text-lg italic" maxLength={2000} value={quote.body} onChange={(e) => setQuote((q) => ({ ...q, body: e.target.value }))} autoFocus />
            </label>
            <label className="mt-2 inline-flex items-center gap-2 text-sm">
              <span className="meta">p.</span>
              <input className="field h-9 w-20 py-1" maxLength={20} value={quote.page} onChange={(e) => setQuote((q) => ({ ...q, page: e.target.value }))} aria-label="Page" />
            </label>
          </Extra>
          <Extra icon={<NotebookPen className="size-4" />} label="Notes to yourself" open={show.notes} onOpen={() => setShow((s) => ({ ...s, notes: true }))}>
            <label className="block">
              <span className="meta mb-1 block">Notes to yourself <span className="normal-case tracking-normal text-ink-faint">— only you see these</span></span>
              <textarea className="field hand min-h-20 text-xl" maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} autoFocus />
            </label>
          </Extra>
        </div>

        <div className="space-y-3 border-t border-line pt-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-burgundy" checked={share} onChange={(e) => setShare(e.target.checked)} />
            Tell my followers I finished it
          </label>
          <div className={cn("flex flex-wrap items-center gap-3 transition-opacity", !hasPublic && "opacity-50")}>
            <span className="meta">Who can see the review, line and post</span>
            <VisibilitySelect value={visibility} onChange={setVisibility} compact />
          </div>
        </div>

        {error && <p role="alert" className="text-sm text-burgundy">{error}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {onJustShelve ? (
            <Button variant="ghost" onClick={() => (onClose(), onJustShelve())} disabled={pending}>
              Just put it on Read
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={pending}>{pending ? "Logging…" : "Log book"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
