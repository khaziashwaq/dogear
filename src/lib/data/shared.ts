import type { ProfileStats, SavedBook, ShelfQuery, UserBook } from "@/lib/types";
import { computeHistogram } from "./store";

// Pure helpers used by both backends.

export function cleanShelves(shelves: string[]): string[] {
  return [...new Set(shelves.map((s) => s.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40)).filter(Boolean))].slice(0, 20);
}

export function sortShelf(rows: UserBook[], sort: NonNullable<ShelfQuery["sort"]>): UserBook[] {
  const copy = [...rows];
  switch (sort) {
    case "title":
      return copy.sort((a, b) => a.book.title.localeCompare(b.book.title));
    case "author":
      return copy.sort((a, b) => (a.book.authors[0] ?? "").localeCompare(b.book.authors[0] ?? ""));
    case "rating":
      return copy.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    case "year":
      return copy.sort((a, b) => (b.book.publishedYear ?? 0) - (a.book.publishedYear ?? 0));
    default:
      return copy.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }
}

export function compatibilityScore(shared: { a: number | null; b: number | null }[], sharedGenres: number) {
  const rated = shared.filter((s) => s.a != null && s.b != null);
  const agreement = rated.length ? 60 * (1 - rated.reduce((s, r) => s + Math.abs(r.a! - r.b!), 0) / rated.length / 4.5) : 25;
  return Math.round(Math.min(100, Math.max(0, agreement + Math.min(25, shared.length * 5) + Math.min(15, sharedGenres * 5))));
}

export function buildStats(
  year: number,
  shelf: (Pick<UserBook, "status" | "rating" | "finishedAt" | "updatedAt"> & { book: SavedBook })[],
  reviewsCount: number,
  quotesCount: number,
  listsCount: number,
): ProfileStats {
  const read = shelf.filter((u) => u.status === "read");
  const finishedYear = (u: (typeof shelf)[number]) => Number((u.finishedAt ?? u.updatedAt).slice(0, 4));
  const thisYear = read.filter((u) => finishedYear(u) === year);
  const rated = shelf.filter((u) => u.rating != null);
  const byMonth = new Array(12).fill(0);
  thisYear.forEach((u) => (byMonth[Number((u.finishedAt ?? u.updatedAt).slice(5, 7)) - 1] += 1));
  const tally = (items: string[]) => {
    const m = new Map<string, number>();
    items.forEach((i) => m.set(i, (m.get(i) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  return {
    year,
    booksRead: read.length,
    booksReadThisYear: thisYear.length,
    pagesReadThisYear: thisYear.reduce((s, u) => s + (u.book.pageCount ?? 0), 0),
    currentlyReading: shelf.filter((u) => u.status === "reading").length,
    averageRating: rated.length ? Math.round((rated.reduce((s, u) => s + (u.rating ?? 0), 0) / rated.length) * 10) / 10 : null,
    reviewsCount,
    quotesCount,
    listsCount,
    ratingDistribution: computeHistogram(shelf.map((u) => u.rating)),
    byMonth,
    topGenres: tally(read.flatMap((u) => u.book.genres)).slice(0, 5).map(([genre, count]) => ({ genre, count })),
    topAuthors: tally(read.flatMap((u) => u.book.authors)).slice(0, 5).map(([author, count]) => ({ author, count })),
  };
}
