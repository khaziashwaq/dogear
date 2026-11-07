import { PenLine, Share2 } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Stars } from "@/components/ui/stars";
import { reviewHref } from "@/lib/book-ref";
import type { Quote, ReadingSession, Review, SavedBook, UserBook } from "@/lib/types";
import { excerpt, formatDate } from "@/lib/utils";

const STATUS: Record<string, string> = { read: "Read", reading: "Reading", want_to_read: "Want to read", dnf: "Did not finish" };

/**
 * "Your copy" — the reader's own page for a book, laid out like a page from a
 * reading journal: when you started and finished, your stars, your review,
 * the lines you underlined and the notes you kept in the diary.
 */
export function ReadingJournal({
  book,
  userBook,
  reviews,
  quotes,
  sessions,
}: {
  book: SavedBook;
  userBook: UserBook | null;
  reviews: Review[];
  quotes: Quote[];
  sessions: ReadingSession[];
}) {
  const latest = reviews[0];
  const notes = sessions.filter((s) => s.notes);
  const started = userBook?.startedAt ?? sessions.at(-1)?.startedOn ?? null;
  const finished = userBook?.finishedAt ?? sessions.find((s) => s.finishedOn)?.finishedOn ?? null;
  const reads = sessions.filter((s) => s.status === "finished").length;
  const slug = encodeURIComponent(book.slug);

  return (
    <section aria-labelledby="journal-h" className="paper dogear ruled relative mt-12 px-5 pb-6 pt-5 sm:px-8 sm:pb-8">
      <div aria-hidden className="absolute inset-y-0 left-3 w-px bg-rose/70 sm:left-5" />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="journal-h" className="font-serif text-3xl">Your copy</h2>
        <p className="hand text-xl text-burgundy">{userBook?.status ? STATUS[userBook.status] : "not on your shelves yet"}</p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <div>
          <dt className="meta">started</dt>
          <dd className="font-serif text-lg">{started ? formatDate(started) : "—"}</dd>
        </div>
        <div>
          <dt className="meta">finished</dt>
          <dd className="font-serif text-lg">{finished ? formatDate(finished) : "—"}</dd>
        </div>
        <div>
          <dt className="meta">your rating</dt>
          <dd className="mt-1">{userBook?.rating ? <Stars value={userBook.rating} /> : <span className="font-serif text-lg">—</span>}</dd>
        </div>
        <div>
          <dt className="meta">times read</dt>
          <dd className="font-serif text-lg">{reads || (userBook?.status === "read" ? 1 : 0)}</dd>
        </div>
      </dl>

      {/* review */}
      <div className="mt-7">
        <h3 className="meta">your review</h3>
        {latest ? (
          <div className="mt-2">
            {latest.title && <p className="font-serif text-2xl italic leading-tight">{latest.title}</p>}
            <p className="mt-1 max-w-[62ch] whitespace-pre-line leading-relaxed text-ink/90">{excerpt(latest.body, 360)}</p>
            <p className="meta mt-2 normal-case tracking-normal">
              {formatDate(latest.createdAt)} · {latest.visibility === "public" ? "public" : latest.visibility === "followers" ? "followers only" : "only you"}
              {latest.likesCount ? ` · ${latest.likesCount} ${latest.likesCount === 1 ? "like" : "likes"}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ButtonLink href={`/review/${latest.id}/edit`} variant="paper" size="sm"><PenLine className="size-3.5" /> Edit review</ButtonLink>
              {latest.visibility === "public" && (
                <ButtonLink href={reviewHref(latest, reviews.length > 1)} size="sm"><Share2 className="size-3.5" /> Share review</ButtonLink>
              )}
            </div>
            {reviews.length > 1 && (
              <p className="mt-3 text-sm text-ink-soft">
                Earlier:{" "}
                {reviews.slice(1).map((r, i) => (
                  <span key={r.id}>
                    {i > 0 && ", "}
                    <Link href={reviewHref(r, true)} className="link-underline">{formatDate(r.createdAt)}</Link>
                  </span>
                ))}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="hand text-2xl text-ink-soft">the margins are still blank</p>
            <ButtonLink href={`/review/new?book=${slug}`} size="sm">Write your review</ButtonLink>
          </div>
        )}
      </div>

      {/* quotes */}
      <div className="mt-7">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="meta">lines you underlined</h3>
          <Link href={`/quotes/new?book=${slug}`} className="text-sm text-burgundy hover:underline">Add a highlight</Link>
        </div>
        {quotes.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">Nothing saved from this one yet.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {quotes.map((q) => (
              <li key={q.id}>
                <Link href={q.postId ? `/post/${q.postId}` : `/quotes/${q.id}`} className="group block border-l-2 border-burgundy/40 pl-3">
                  <p className="font-serif text-lg italic leading-snug group-hover:text-burgundy">“{excerpt(q.body, 220)}”</p>
                  {q.page && <p className="meta mt-0.5">p. {q.page}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* notes */}
      <div className="mt-7">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="meta">notes to yourself</h3>
          <Link href="/diary" className="text-sm text-burgundy hover:underline">Diary</Link>
        </div>
        {notes.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">Private notes you add when logging a read show up here. Only you can see them.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {notes.map((s) => (
              <li key={s.id} className="hand text-xl leading-snug">
                <span className="meta mr-2 align-middle">{formatDate(s.finishedOn ?? s.startedOn ?? s.createdAt)}</span>
                {s.notes}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
