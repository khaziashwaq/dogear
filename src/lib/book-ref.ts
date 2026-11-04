import type { Book } from "@/lib/types";

/** Client-safe: build the reference server actions use to resolve (or add) a book. */
export function bookRef(book: Book) {
  if (book.id) return { id: book.id };
  const { id: _id, slug: _slug, ...fallback } = book;
  void _id;
  void _slug;
  return { olWorkId: book.olWorkId, fallback };
}

export function bookHref(book: Pick<Book, "slug" | "olWorkId">) {
  if (book.slug) return `/book/${book.slug}`;
  if (book.olWorkId) return `/book/${book.olWorkId}`;
  return "/discover";
}
