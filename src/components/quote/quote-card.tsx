import Link from "next/link";
import { bookHref } from "@/lib/book-ref";
import type { Quote } from "@/lib/types";
import { authorLine, cn, hash } from "@/lib/utils";

const TONES = [
  { card: "bg-rose/35", mark: "text-burgundy", tape: "tape" },
  { card: "bg-sage/35", mark: "text-sage-deep", tape: "tape tape-rose" },
  { card: "bg-butter/55", mark: "text-burgundy", tape: "tape tape-sage" },
  { card: "bg-card", mark: "text-rose-deep", tape: "tape" },
];

/** The shareable quote card: big quote marks, serif passage, handwritten note. */
export function QuoteCard({ quote, className, size = "md", linkBook = true }: { quote: Quote; className?: string; size?: "md" | "lg"; linkBook?: boolean }) {
  const t = TONES[hash(quote.id) % TONES.length];
  const long = quote.body.length > 220;
  return (
    <figure className={cn("relative border border-line px-6 pb-6 pt-9 shadow-[var(--shadow-paper)]", t.card, className)}>
      <div className={cn(t.tape, "-top-3 left-6 -rotate-3")} aria-hidden />
      <span aria-hidden className={cn("absolute left-4 top-1 font-serif text-7xl leading-none", t.mark)}>“</span>
      <blockquote className={cn("relative font-serif italic leading-snug text-ink", size === "lg" ? "text-3xl sm:text-4xl" : long ? "text-lg" : "text-2xl")}>
        {quote.body}
      </blockquote>
      <figcaption className="mt-4 flex items-baseline justify-between gap-3">
        <span className="meta">
          {linkBook ? (
            <Link href={bookHref(quote.book)} className="link-underline text-ink">{quote.book.title}</Link>
          ) : (
            <span className="text-ink">{quote.book.title}</span>
          )}
          <span className="normal-case tracking-normal"> — {authorLine(quote.book.authors)}</span>
        </span>
        {quote.page && <span className="meta shrink-0">p. {quote.page}</span>}
      </figcaption>
      {quote.commentary && <p className="hand mt-3 text-xl text-burgundy">{quote.commentary}</p>}
    </figure>
  );
}
