import type { ProfileStats, ReadingRecap, SavedBook, ShelfQuery, UserBook } from "@/lib/types";
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

type StatsShelfRow = Pick<UserBook, "bookId" | "status" | "rating" | "finishedAt" | "updatedAt"> & { book: SavedBook };
type StatsSession = { bookId: string; status: string; startedOn: string | null; finishedOn: string | null; isReread: boolean };

/**
 * Same rules as public.reading_stats: completions come from the diary sessions the viewer may
 * see (a reader's own), plus Read-shelf books with no such entry that year; everything but the
 * all-time counts is scoped to the year; pages only for books with a page count.
 */
export function buildStats(
  year: number,
  shelf: StatsShelfRow[],
  sessions: StatsSession[],
  counts: { reviews: number; quotes: number; lists: number },
): ProfileStats {
  const inYear = (d: string | null) => Boolean(d && Number(d.slice(0, 4)) === year);
  const diary = sessions.filter((x) => x.status === "finished" && inYear(x.finishedOn)).map((x) => ({ bookId: x.bookId, day: x.finishedOn!, reread: x.isReread }));
  const inDiary = new Set(diary.map((d) => d.bookId));
  // Dated Read books only: an undated one counts all-time, never in a year by guesswork.
  const shelfOnly = shelf
    .filter((u) => u.status === "read" && u.finishedAt && inYear(u.finishedAt) && !inDiary.has(u.bookId))
    .map((u) => ({ bookId: u.bookId, day: u.finishedAt!.slice(0, 10), reread: false }));
  const done = [...diary, ...shelfOnly];
  const byId = new Map(shelf.map((u) => [u.bookId, u]));
  const books = [...new Set(done.map((d) => d.bookId))].map((id) => byId.get(id)).filter((u): u is StatsShelfRow => Boolean(u));
  const byMonth = new Array(12).fill(0);
  done.forEach((d) => (byMonth[Number(d.day.slice(5, 7)) - 1] += 1));
  const tally = (items: string[]) => {
    const m = new Map<string, number>();
    items.forEach((i) => m.set(i, (m.get(i) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const rated = books.filter((u) => u.rating != null);
  const paged = books.filter((u) => u.book.pageCount != null);
  return {
    year,
    booksRead: shelf.filter((u) => u.status === "read").length,
    booksReadThisYear: done.length,
    distinctBooksThisYear: books.length,
    rereadsThisYear: done.filter((d) => d.reread).length,
    sessionsThisYear: sessions.filter((x) => inYear(x.startedOn) || inYear(x.finishedOn)).length,
    pagesReadThisYear: paged.reduce((s, u) => s + (u.book.pageCount ?? 0), 0),
    booksWithPagesThisYear: paged.length,
    currentlyReading: shelf.filter((u) => u.status === "reading").length,
    averageRating: rated.length ? Math.round((rated.reduce((s, u) => s + (u.rating ?? 0), 0) / rated.length) * 10) / 10 : null,
    reviewsCount: counts.reviews,
    quotesCount: counts.quotes,
    listsCount: counts.lists,
    ratingDistribution: computeHistogram(books.map((u) => u.rating)),
    byMonth,
    topGenres: tally(books.flatMap((u) => u.book.genres)).slice(0, 5).map(([genre, count]) => ({ genre, count })),
    topAuthors: tally(books.flatMap((u) => u.book.authors)).slice(0, 5).map(([author, count]) => ({ author, count })),
  };
}

type RecapShelfRow = Pick<UserBook, "bookId" | "status" | "rating" | "isFavourite" | "finishedAt" | "updatedAt"> & { book: SavedBook };
type RecapQuote = { id: string; bookId: string; body: string; createdAt: string; likes: number };

/** Same rules as public.reading_recap (a year, or one month of it). */
export function buildRecap(
  year: number,
  month: number | null,
  shelf: RecapShelfRow[],
  sessions: StatsSession[],
  quotes: RecapQuote[],
): ReadingRecap {
  const inPeriod = (d: string | null) => Boolean(d && Number(d.slice(0, 4)) === year && (month == null || Number(d.slice(5, 7)) === month));
  const diary = sessions.filter((x) => x.status === "finished" && inPeriod(x.finishedOn)).map((x) => ({ bookId: x.bookId, day: x.finishedOn!.slice(0, 10), reread: x.isReread }));
  const inDiary = new Set(diary.map((d) => d.bookId));
  const shelfOnly = shelf
    .filter((u) => u.status === "read" && u.finishedAt && inPeriod(u.finishedAt) && !inDiary.has(u.bookId))
    .map((u) => ({ bookId: u.bookId, day: u.finishedAt!.slice(0, 10), reread: false }));
  const done = [...diary, ...shelfOnly];
  const byId = new Map(shelf.map((u) => [u.bookId, u]));
  const last = new Map<string, string>();
  done.forEach((d) => last.set(d.bookId, (last.get(d.bookId) ?? "") > d.day ? last.get(d.bookId)! : d.day));
  const books = [...last.keys()].map((id) => byId.get(id)).filter((u): u is RecapShelfRow => Boolean(u));
  const top = (items: string[]) => {
    const m = new Map<string, number>();
    items.forEach((i) => m.set(i, (m.get(i) ?? 0) + 1));
    const [name, count] = [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [];
    return name ? { name, count: count! } : null;
  };
  const rb = (b: SavedBook) => ({ id: b.id, slug: b.slug, title: b.title, authors: b.authors, coverUrl: b.coverUrl });
  const rated = books.filter((u) => u.rating != null);
  const fav = [...rated].sort((a, b) => b.rating! - a.rating! || Number(b.isFavourite) - Number(a.isFavourite) || (last.get(b.bookId)! > last.get(a.bookId)! ? 1 : -1))[0];
  const byMonth = new Array(12).fill(0);
  done.forEach((d) => (byMonth[Number(d.day.slice(5, 7)) - 1] += 1));
  const busiest = byMonth.reduce((best, n, i) => (n > best.count ? { month: i + 1, count: n } : best), { month: 0, count: 0 });
  const periodQuotes = quotes.filter((q) => inPeriod(q.createdAt));
  const perBook = new Map<string, number>();
  periodQuotes.forEach((q) => perBook.set(q.bookId, (perBook.get(q.bookId) ?? 0) + 1));
  const [hlId, hlCount] = [...perBook.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  const hlBook = hlId ? shelf.find((u) => u.bookId === hlId)?.book : undefined;
  const loved = periodQuotes.filter((q) => q.likes > 0).sort((a, b) => b.likes - a.likes || (b.createdAt > a.createdAt ? 1 : -1))[0];
  const paged = books.filter((u) => u.book.pageCount != null);
  return {
    year, month,
    completions: done.length,
    distinctBooks: books.length,
    rereads: done.filter((d) => d.reread).length,
    pages: paged.reduce((s, u) => s + (u.book.pageCount ?? 0), 0),
    booksWithPages: paged.length,
    averageRating: rated.length ? Math.round((rated.reduce((s, u) => s + u.rating!, 0) / rated.length) * 10) / 10 : null,
    byMonth,
    favouriteBook: fav ? { ...rb(fav.book), rating: fav.rating! } : null,
    topAuthor: top(books.flatMap((u) => u.book.authors)),
    topGenre: top(books.flatMap((u) => u.book.genres)),
    busiestMonth: busiest.count ? busiest : null,
    mostHighlighted: hlBook && hlCount ? { ...rb(hlBook), count: hlCount } : null,
    lovedLine: loved ? { quoteId: loved.id, body: loved.body, title: byId.get(loved.bookId)?.book.title ?? shelf.find((u) => u.bookId === loved.bookId)?.book.title ?? "", likes: loved.likes } : null,
    annotations: periodQuotes.length,
    timeline: done
      .map((d) => ({ ...rb(byId.get(d.bookId)!.book), day: d.day, rating: byId.get(d.bookId)?.rating ?? null, reread: d.reread }))
      .sort((a, b) => (a.day === b.day ? a.title.localeCompare(b.title) : a.day < b.day ? -1 : 1)),
  };
}

/** Same scoring as public.similar_readers. */
export function similarityScore(o: { sharedBooks: number; diff: number | null; sharedAuthors: number; sharedGenres: number; sharedFavourites: number }) {
  return Math.round(
    35 * Math.min(1, o.sharedBooks / 5) +
      (o.diff == null ? 0 : 25 * (1 - o.diff / 4.5)) +
      15 * Math.min(1, o.sharedAuthors / 2) +
      15 * Math.min(1, o.sharedGenres / 3) +
      10 * Math.min(1, o.sharedFavourites),
  );
}
