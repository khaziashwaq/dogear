import type { Book } from "@/lib/types";

/** Client-safe: build the reference server actions use to resolve (or add) a book. */
export function bookRef(book: Book) {
  if (book.id) return { id: book.id };
  const { id: _id, slug: _slug, ...fallback } = book;
  void _id;
  void _slug;
  return { olWorkId: book.olWorkId, fallback };
}

export function bookHref(book: Pick<Book, "slug" | "olWorkId"> & { olEditionId?: string | null }) {
  if (book.slug) return `/book/${book.slug}`;
  // Keep the edition the reader found (e.g. Penguin Classics) rather than the work's first edition.
  if (book.olWorkId) return `/book/${book.olWorkId}${book.olEditionId ? `?edition=${book.olEditionId}` : ""}`;
  return "/discover";
}

/**
 * The public, shareable page for a review: /u/<username>/reviews/<book-slug>.
 * A reader may review a book more than once (re-reads); the clean URL shows the
 * latest, and `pin` adds ?r=<id> to point at a specific one.
 */
export function reviewHref(review: { id: string; author: { username: string | null }; book: { slug: string } }, pin = false) {
  const base = `/u/${review.author.username}/reviews/${review.book.slug}`;
  return pin ? `${base}?r=${review.id}` : base;
}
