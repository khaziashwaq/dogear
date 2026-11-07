import { Lock, Users } from "lucide-react";
import Link from "next/link";
import { BookCover } from "@/components/book/book-cover";
import { Avatar } from "@/components/profile/avatar";
import { bookHref } from "@/lib/book-ref";
import type { Quote } from "@/lib/types";
import { authorLine, cn, formatDate } from "@/lib/utils";

/**
 * An annotation, set like a marked page in a second-hand book: the passage in serif
 * under the reader's own highlighter, their thoughts pencilled in the margin, the
 * book it came from, and the tags they filed it under.
 */
export function AnnotationCard({
  quote,
  className,
  size = "md",
  linkBook = true,
  showAuthor = false,
  href,
}: {
  quote: Quote;
  className?: string;
  size?: "md" | "lg";
  linkBook?: boolean;
  /** Show who marked it and when (feeds, the Marginalia page). */
  showAuthor?: boolean;
  /** Make the passage a link (to the annotation's page). */
  href?: string;
}) {
  const len = quote.body.length;
  const passageSize =
    size === "lg"
      ? len < 140 ? "text-3xl sm:text-4xl leading-[1.35]" : len < 360 ? "text-2xl sm:text-[1.7rem] leading-[1.45]" : "text-xl leading-[1.55]"
      : len < 90 ? "text-2xl leading-[1.4]" : len < 260 ? "text-xl leading-[1.5]" : "text-[1.05rem] leading-[1.6]";
  const passage = (
    <blockquote className={cn("font-serif text-ink", passageSize)}>
      <span className={cn("marker", `hl-${quote.highlight}`)}>{quote.body}</span>
    </blockquote>
  );

  return (
    <figure className={cn("paper relative px-5 pb-5 pt-4 sm:px-6", className)}>
      {/* where it's from */}
      <figcaption className="mb-4 flex items-start gap-3">
        {linkBook ? (
          <Link href={bookHref(quote.book)} className="shrink-0" tabIndex={-1} aria-hidden>
            <BookCover title={quote.book.title} authors={quote.book.authors} coverUrl={quote.book.coverUrl} size="xs" />
          </Link>
        ) : (
          <BookCover title={quote.book.title} authors={quote.book.authors} coverUrl={quote.book.coverUrl} size="xs" />
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          {linkBook ? (
            <Link href={bookHref(quote.book)} className="line-clamp-2 font-serif text-base leading-tight hover:text-burgundy">{quote.book.title}</Link>
          ) : (
            <p className="line-clamp-2 font-serif text-base leading-tight">{quote.book.title}</p>
          )}
          <p className="meta truncate normal-case tracking-normal">{authorLine(quote.book.authors)}</p>
        </div>
        {quote.page && <span className="shrink-0 pt-0.5 font-mono text-xs text-ink-soft">p. {quote.page}</span>}
      </figcaption>

      {href ? (
        <Link href={href} className="block rounded-[1px] focus-visible:outline-offset-4">{passage}</Link>
      ) : (
        passage
      )}

      {quote.commentary && (
        <p className="hand mt-4 border-l-2 border-burgundy/25 pl-3 text-xl leading-[1.15] text-burgundy sm:text-[1.35rem]">{quote.commentary}</p>
      )}

      {quote.tags.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-1" aria-label="Tags">
          {quote.tags.map((t) => (
            <li key={t}>
              <Link href={`/marginalia?tag=${encodeURIComponent(t)}`} className="font-mono text-xs text-ink-soft hover:text-burgundy">#{t}</Link>
            </li>
          ))}
        </ul>
      )}

      {(showAuthor || quote.isDraft || quote.visibility !== "public") && (
        <div className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-sm">
          {showAuthor && quote.author && (
            <Link href={`/u/${quote.author.username}`} className="flex min-w-0 items-center gap-2 hover:text-burgundy">
              <Avatar profile={quote.author} size="xs" />
              <span className="truncate">{quote.author.displayName || `@${quote.author.username}`}</span>
            </Link>
          )}
          {showAuthor && quote.createdAt && <span className="meta shrink-0 normal-case tracking-normal">{formatDate(quote.createdAt)}</span>}
          <span className="ml-auto flex shrink-0 items-center gap-2">
            {quote.isDraft && <span className="meta rounded-full bg-butter px-2 py-0.5 text-ink">draft</span>}
            {quote.visibility === "followers" && <span className="meta inline-flex items-center gap-1"><Users className="size-3" aria-hidden />followers</span>}
            {quote.visibility === "private" && <span className="meta inline-flex items-center gap-1"><Lock className="size-3" aria-hidden />only you</span>}
          </span>
        </div>
      )}
    </figure>
  );
}

/** Kept for existing callers: a quote is an annotation. */
export const QuoteCard = AnnotationCard;
