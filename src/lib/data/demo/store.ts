import "server-only";
import type {
  BookInput,
  BookReader,
  BookStats,
  Comment,
  Compatibility,
  ListInput,
  Notification,
  Page,
  Post,
  Profile,
  ProfilePatch,
  ProfileStats,
  Quote,
  QuoteInput,
  ReadingList,
  ReadingListDetail,
  ReadingSession,
  Recommendation,
  Review,
  ReviewInput,
  SavedBook,
  SessionInput,
  ShelfQuery,
  ShelfStatus,
  ShelfSummary,
  UpdatePostInput,
  UserBook,
  Visibility,
} from "@/lib/types";
import { normaliseRating, slugify } from "@/lib/utils";
import { AuthError, NotFoundError, ValidationError, computeHistogram, type DataStore } from "../store";
import { buildStats, cleanShelves, compatibilityScore, sortShelf } from "../shared";
import {
  getDemoDB,
  newId,
  pushNotification,
  saveDemoDB,
  type BookRow,
  type DemoDB,
  type ListRow,
  type PostRow,
  type QuoteRow,
  type ReviewRow,
  type UserBookRow,
} from "./db";

const nowIso = () => new Date().toISOString();

function encodeCursor(p: { createdAt: string; id: string }) {
  return `${p.createdAt}|${p.id}`;
}
function beforeCursor(cursor: string | null) {
  if (!cursor) return () => true;
  const [createdAt, id] = cursor.split("|");
  return (p: { createdAt: string; id: string }) => p.createdAt < createdAt || (p.createdAt === createdAt && p.id < id);
}
const byNewest = (a: { createdAt: string; id: string }, b: { createdAt: string; id: string }) =>
  a.createdAt === b.createdAt ? (a.id < b.id ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1;

/**
 * Demo backend: same contract and the same permission rules as the Supabase
 * schema + RLS, implemented over an in-memory, file-persisted dataset.
 */
export class DemoStore implements DataStore {
  readonly mode = "demo" as const;
  private db: DemoDB;

  constructor(readonly viewerId: string | null) {
    this.db = getDemoDB();
  }

  // ── internals ───────────────────────────────────────────────────────
  private me(): string {
    if (!this.viewerId) throw new AuthError();
    return this.viewerId;
  }
  private commit() {
    saveDemoDB();
  }
  private follows(a: string, b: string) {
    return this.db.follows.some((f) => f.followerId === a && f.followingId === b);
  }
  private canView(ownerId: string, vis: Visibility) {
    if (vis === "public") return true;
    if (!this.viewerId) return false;
    if (ownerId === this.viewerId) return true;
    return vis === "followers" && this.follows(this.viewerId, ownerId);
  }

  private profile(id: string): Profile {
    const row = this.db.profiles.find((p) => p.id === id);
    if (!row) throw new NotFoundError("Reader not found");
    return {
      ...row,
      followersCount: this.db.follows.filter((f) => f.followingId === id).length,
      followingCount: this.db.follows.filter((f) => f.followerId === id).length,
    };
  }
  private book(id: string): SavedBook {
    const row = this.db.books.find((b) => b.id === id);
    if (!row) throw new NotFoundError("Book not found");
    return toBook(row);
  }
  private postIdFor(field: "reviewId" | "quoteId" | "listId", id: string) {
    return this.db.posts.find((p) => p[field] === id)?.id ?? null;
  }
  private review(row: ReviewRow): Review {
    return { ...row, postId: this.postIdFor("reviewId", row.id), author: this.profile(row.userId), book: this.book(row.bookId) };
  }
  private quote(row: QuoteRow): Quote {
    return { ...row, postId: this.postIdFor("quoteId", row.id), author: this.profile(row.userId), book: this.book(row.bookId) };
  }
  private listSummary(row: ListRow): ReadingList {
    const books = this.db.listBooks.filter((lb) => lb.listId === row.id).sort((a, b) => a.position - b.position);
    return {
      ...row,
      followersCount: this.db.listFollows.filter((f) => f.listId === row.id).length,
      bookCount: books.length,
      postId: this.postIdFor("listId", row.id),
      owner: this.profile(row.userId),
      preview: books.slice(0, 5).map((lb) => this.book(lb.bookId)),
      viewerFollows: Boolean(this.viewerId && this.db.listFollows.some((f) => f.listId === row.id && f.userId === this.viewerId)),
    };
  }
  private userBook(row: UserBookRow): UserBook {
    return { ...row, book: this.book(row.bookId) };
  }
  private visiblePost(p: PostRow) {
    if (!this.canView(p.userId, p.visibility)) return false;
    if (p.repostOfId) {
      const o = this.db.posts.find((x) => x.id === p.repostOfId);
      return Boolean(o && this.canView(o.userId, o.visibility));
    }
    return true;
  }
  private hydratePost(p: PostRow, depth = 0): Post {
    const reviewRow = p.reviewId ? this.db.reviews.find((r) => r.id === p.reviewId) : null;
    const quoteRow = p.quoteId ? this.db.quotes.find((q) => q.id === p.quoteId) : null;
    const listRow = p.listId ? this.db.lists.find((l) => l.id === p.listId) : null;
    const original = p.repostOfId && depth === 0 ? this.db.posts.find((x) => x.id === p.repostOfId) : null;
    const v = this.viewerId;
    return {
      id: p.id, userId: p.userId, kind: p.kind, body: p.body, progressPages: p.progressPages, progressPercent: p.progressPercent,
      visibility: p.visibility, createdAt: p.createdAt,
      likesCount: this.db.likes.filter((l) => l.postId === p.id).length,
      commentsCount: this.db.comments.filter((c) => c.postId === p.id).length,
      repostsCount: this.db.posts.filter((x) => x.repostOfId === p.id).length,
      author: this.profile(p.userId),
      book: p.bookId ? this.book(p.bookId) : null,
      review: reviewRow ? this.review(reviewRow) : null,
      quote: quoteRow ? this.quote(quoteRow) : null,
      list: listRow ? this.listSummary(listRow) : null,
      repostOf: original ? this.hydratePost(original, 1) : null,
      viewer: {
        liked: Boolean(v && this.db.likes.some((l) => l.postId === p.id && l.userId === v)),
        bookmarked: Boolean(v && this.db.bookmarks.some((l) => l.postId === p.id && l.userId === v)),
        reposted: Boolean(v && this.db.posts.some((x) => x.repostOfId === p.id && x.userId === v)),
      },
    };
  }
  private page(rows: PostRow[], cursor: string | null, limit: number): Page<Post> {
    const sorted = rows.filter(beforeCursor(cursor)).sort(byNewest);
    const slice = sorted.slice(0, limit);
    return {
      items: slice.map((p) => this.hydratePost(p)),
      nextCursor: sorted.length > limit ? encodeCursor(slice[slice.length - 1]) : null,
    };
  }
  private ensureUserBook(bookId: string): UserBookRow {
    const me = this.me();
    this.book(bookId);
    let row = this.db.userBooks.find((u) => u.userId === me && u.bookId === bookId);
    if (!row) {
      row = {
        id: newId(), userId: me, bookId, status: null, rating: null, isFavourite: false, favouritedAt: null, shelves: [],
        progressPages: null, startedAt: null, finishedAt: null, createdAt: nowIso(), updatedAt: nowIso(),
      };
      this.db.userBooks.push(row);
    }
    return row;
  }
  private ownList(id: string): ListRow {
    const row = this.db.lists.find((l) => l.id === id);
    if (!row || row.userId !== this.me()) throw new NotFoundError("List not found");
    return row;
  }

  // ── profiles & graph ────────────────────────────────────────────────
  async getProfileById(id: string) {
    return this.db.profiles.some((p) => p.id === id) ? this.profile(id) : null;
  }
  async getProfileByUsername(username: string) {
    const row = this.db.profiles.find((p) => p.username?.toLowerCase() === username.toLowerCase());
    return row ? this.profile(row.id) : null;
  }
  async isUsernameAvailable(username: string) {
    return !this.db.profiles.some((p) => p.username?.toLowerCase() === username.toLowerCase() && p.id !== this.viewerId);
  }
  async updateProfile(patch: ProfilePatch) {
    const me = this.me();
    const row = this.db.profiles.find((p) => p.id === me)!;
    if (patch.username !== undefined && patch.username !== row.username && !(await this.isUsernameAvailable(patch.username ?? ""))) {
      throw new ValidationError("That username is taken.");
    }
    Object.assign(row, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
    this.commit();
    return this.profile(me);
  }
  async searchProfiles(q: string, limit = 20) {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return this.db.profiles
      .filter((p) => p.onboarded && (p.username?.includes(needle) || p.displayName.toLowerCase().includes(needle)))
      .slice(0, limit)
      .map((p) => this.profile(p.id));
  }
  async suggestedReaders(limit = 8) {
    const me = this.viewerId ? this.db.profiles.find((p) => p.id === this.viewerId) : null;
    const genres = new Set(me?.favouriteGenres ?? []);
    return this.db.profiles
      .filter((p) => p.onboarded && p.id !== this.viewerId && !(this.viewerId && this.follows(this.viewerId, p.id)))
      .map((p) => ({ p: this.profile(p.id), overlap: p.favouriteGenres.filter((g) => genres.has(g)).length }))
      .sort((a, b) => b.overlap - a.overlap || b.p.followersCount - a.p.followersCount)
      .slice(0, limit)
      .map((x) => x.p);
  }
  async isFollowing(targetId: string) {
    return Boolean(this.viewerId && this.follows(this.viewerId, targetId));
  }
  async follow(targetId: string) {
    const me = this.me();
    if (me === targetId || this.follows(me, targetId)) return;
    this.profile(targetId);
    this.db.follows.push({ followerId: me, followingId: targetId, createdAt: nowIso() });
    pushNotification(this.db, { recipientId: targetId, actorId: me, kind: "follow", postId: null, commentId: null, listId: null, recommendationId: null });
    this.commit();
  }
  async unfollow(targetId: string) {
    const me = this.me();
    this.db.follows = this.db.follows.filter((f) => !(f.followerId === me && f.followingId === targetId));
    this.commit();
  }
  async listFollowers(userId: string) {
    return this.db.follows.filter((f) => f.followingId === userId).sort(byNewestFollow).map((f) => this.profile(f.followerId));
  }
  async listFollowing(userId: string) {
    return this.db.follows.filter((f) => f.followerId === userId).sort(byNewestFollow).map((f) => this.profile(f.followingId));
  }
  async followingIds() {
    if (!this.viewerId) return [];
    return this.db.follows.filter((f) => f.followerId === this.viewerId).map((f) => f.followingId);
  }

  // ── catalogue ───────────────────────────────────────────────────────
  async getBookById(id: string) {
    const row = this.db.books.find((b) => b.id === id);
    return row ? toBook(row) : null;
  }
  async getBookBySlug(slug: string) {
    const row = this.db.books.find((b) => b.slug === slug);
    return row ? toBook(row) : null;
  }
  async getBookByOlWorkId(olWorkId: string) {
    const row = this.db.books.find((b) => b.olWorkId === olWorkId);
    return row ? toBook(row) : null;
  }
  async upsertBook(input: BookInput) {
    this.me();
    const existing = this.db.books.find(
      (b) => (input.olWorkId && b.olWorkId === input.olWorkId) || (input.isbn13 && b.isbn13 === input.isbn13),
    );
    if (existing) return toBook(existing);
    let slug = slugify(`${input.title} ${input.authors[0] ?? ""}`);
    if (this.db.books.some((b) => b.slug === slug)) slug = `${slug}-${input.olWorkId?.toLowerCase() ?? newId().slice(0, 6)}`;
    const row: BookRow = { ...input, id: newId(), slug, createdAt: nowIso() };
    this.db.books.push(row);
    this.commit();
    return toBook(row);
  }
  async searchBooks(q: string, limit = 20) {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return this.db.books
      .filter((b) => b.title.toLowerCase().includes(needle) || b.authors.some((a) => a.toLowerCase().includes(needle)) || b.isbn13 === needle)
      .slice(0, limit)
      .map(toBook);
  }
  async booksByGenre(genre: string, limit = 24) {
    return this.db.books.filter((b) => b.genres.includes(genre)).slice(0, limit).map(toBook);
  }
  async booksByMood(mood: string, limit = 24) {
    return this.db.books.filter((b) => b.moods.includes(mood)).slice(0, limit).map(toBook);
  }
  async trendingBooks(limit = 12) {
    const since = Date.now() - 30 * 86_400_000;
    const counts = new Map<string, number>();
    for (const ub of this.db.userBooks) if (new Date(ub.updatedAt).getTime() > since) counts.set(ub.bookId, (counts.get(ub.bookId) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => this.book(id));
  }
  async recentlyReviewedBooks(limit = 12) {
    const seen = new Set<string>();
    const out: SavedBook[] = [];
    for (const r of [...this.db.reviews].filter((r) => r.visibility === "public").sort(byNewest)) {
      if (seen.has(r.bookId)) continue;
      seen.add(r.bookId);
      out.push(this.book(r.bookId));
      if (out.length >= limit) break;
    }
    return out;
  }
  async getBookStats(bookId: string): Promise<BookStats> {
    const rows = this.db.userBooks.filter((u) => u.bookId === bookId);
    const rated = rows.filter((r) => r.rating != null);
    return {
      avgRating: rated.length ? Math.round((rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length) * 100) / 100 : null,
      ratingsCount: rated.length,
      readersCount: rows.filter((r) => r.status === "read").length,
      readingCount: rows.filter((r) => r.status === "reading").length,
      wantCount: rows.filter((r) => r.status === "want_to_read").length,
      histogram: computeHistogram(rows.map((r) => r.rating)),
    };
  }
  async getBookReaders(bookId: string, limit = 24): Promise<BookReader[]> {
    return this.db.userBooks
      .filter((u) => u.bookId === bookId && u.status)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, limit)
      .map((u) => ({ profile: this.profile(u.userId), status: u.status, rating: u.rating, updatedAt: u.updatedAt }));
  }

  // ── shelves ─────────────────────────────────────────────────────────
  async getUserBook(bookId: string) {
    if (!this.viewerId) return null;
    const row = this.db.userBooks.find((u) => u.userId === this.viewerId && u.bookId === bookId);
    return row ? this.userBook(row) : null;
  }
  async setShelfStatus(bookId: string, status: ShelfStatus | null) {
    const row = this.ensureUserBook(bookId);
    const prev = row.status;
    row.status = status;
    row.updatedAt = nowIso();
    const today = nowIso().slice(0, 10);
    if (status === "reading" && prev !== "reading") {
      row.startedAt = today;
      row.finishedAt = null;
      const reread = prev === "read";
      this.db.sessions.push({ id: newId(), userId: row.userId, bookId, status: "reading", startedOn: today, finishedOn: null, isReread: reread, notes: null, createdAt: nowIso() });
      this.db.posts.push(blankPost(row.userId, "started", bookId));
    }
    if ((status === "read" || status === "dnf") && prev !== status) {
      if (status === "read") row.finishedAt = today;
      const open = this.db.sessions.filter((s) => s.userId === row.userId && s.bookId === bookId && s.status === "reading").sort(byNewest)[0];
      if (open) {
        open.status = status === "read" ? "finished" : "abandoned";
        open.finishedOn = today;
      } else if (status === "read") {
        this.db.sessions.push({ id: newId(), userId: row.userId, bookId, status: "finished", startedOn: null, finishedOn: today, isReread: false, notes: null, createdAt: nowIso() });
      }
      if (status === "read") this.db.posts.push(blankPost(row.userId, "finished", bookId));
    }
    if (status === null && !row.isFavourite && row.rating == null && row.shelves.length === 0) {
      this.db.userBooks = this.db.userBooks.filter((u) => u.id !== row.id);
      this.commit();
      return null;
    }
    this.commit();
    return this.userBook(row);
  }
  async setRating(bookId: string, rating: number | null) {
    const row = this.ensureUserBook(bookId);
    row.rating = normaliseRating(rating);
    row.updatedAt = nowIso();
    this.commit();
    return this.userBook(row);
  }
  async setFavourite(bookId: string, favourite: boolean) {
    const row = this.ensureUserBook(bookId);
    row.isFavourite = favourite;
    row.favouritedAt = favourite ? nowIso() : null;
    row.updatedAt = nowIso();
    this.commit();
    return this.userBook(row);
  }
  async setCustomShelves(bookId: string, shelves: string[]) {
    const row = this.ensureUserBook(bookId);
    row.shelves = cleanShelves(shelves);
    row.updatedAt = nowIso();
    this.commit();
    return this.userBook(row);
  }
  async setProgress(bookId: string, pages: number | null) {
    const row = this.ensureUserBook(bookId);
    row.progressPages = pages;
    row.updatedAt = nowIso();
    this.commit();
    return this.userBook(row);
  }
  async getShelf(userId: string, query: ShelfQuery) {
    let rows = this.db.userBooks.filter((u) => u.userId === userId);
    if (query.status) rows = rows.filter((u) => u.status === query.status);
    if (query.favourites) rows = rows.filter((u) => u.isFavourite);
    if (query.shelf) rows = rows.filter((u) => u.shelves.includes(query.shelf!));
    if (!query.status && !query.favourites && !query.shelf) rows = rows.filter((u) => u.status);
    return sortShelf(rows.map((r) => this.userBook(r)), query.sort ?? "recent");
  }
  async getShelfSummary(userId: string): Promise<ShelfSummary> {
    const rows = this.db.userBooks.filter((u) => u.userId === userId);
    const custom = new Map<string, number>();
    rows.forEach((r) => r.shelves.forEach((s) => custom.set(s, (custom.get(s) ?? 0) + 1)));
    return {
      counts: {
        want_to_read: rows.filter((r) => r.status === "want_to_read").length,
        reading: rows.filter((r) => r.status === "reading").length,
        read: rows.filter((r) => r.status === "read").length,
        dnf: rows.filter((r) => r.status === "dnf").length,
        favourites: rows.filter((r) => r.isFavourite).length,
      },
      custom: [...custom.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }
  async getFavouriteBooks(userId: string, limit = 4) {
    return this.db.userBooks
      .filter((u) => u.userId === userId && u.isFavourite)
      .sort((a, b) => ((a.favouritedAt ?? "") < (b.favouritedAt ?? "") ? 1 : -1))
      .slice(0, limit)
      .map((u) => this.book(u.bookId));
  }

  // ── diary ───────────────────────────────────────────────────────────
  async listSessions(bookId?: string): Promise<ReadingSession[]> {
    if (!this.viewerId) return [];
    return this.db.sessions
      .filter((s) => s.userId === this.viewerId && (!bookId || s.bookId === bookId))
      .sort((a, b) => ((a.finishedOn ?? a.startedOn ?? a.createdAt) < (b.finishedOn ?? b.startedOn ?? b.createdAt) ? 1 : -1))
      .map((s) => ({ ...s, book: this.book(s.bookId) }));
  }
  async addSession(input: SessionInput) {
    const me = this.me();
    this.book(input.bookId);
    if (input.startedOn && input.finishedOn && input.finishedOn < input.startedOn) throw new ValidationError("Finish date can't be before the start date.");
    const row = { id: newId(), userId: me, ...input, createdAt: nowIso() };
    this.db.sessions.push(row);
    const ub = this.ensureUserBook(input.bookId);
    if (input.status === "finished") {
      ub.status = "read";
      ub.finishedAt = input.finishedOn ?? ub.finishedAt;
    } else if (input.status === "reading") ub.status = "reading";
    else if (input.status === "abandoned" && ub.status !== "read") ub.status = "dnf";
    ub.startedAt = input.startedOn ?? ub.startedAt;
    ub.updatedAt = nowIso();
    this.commit();
    return { ...row, book: this.book(row.bookId) };
  }
  async deleteSession(id: string) {
    const me = this.me();
    this.db.sessions = this.db.sessions.filter((s) => !(s.id === id && s.userId === me));
    this.commit();
  }

  // ── reviews ─────────────────────────────────────────────────────────
  async getReview(id: string) {
    const row = this.db.reviews.find((r) => r.id === id);
    return row && this.canView(row.userId, row.visibility) ? this.review(row) : null;
  }
  async listReviewsForBook(bookId: string, limit = 20) {
    return this.db.reviews.filter((r) => r.bookId === bookId && this.canView(r.userId, r.visibility)).sort(byNewest).slice(0, limit).map((r) => this.review(r));
  }
  async listReviewsByUser(userId: string, limit = 50) {
    return this.db.reviews.filter((r) => r.userId === userId && this.canView(r.userId, r.visibility)).sort(byNewest).slice(0, limit).map((r) => this.review(r));
  }
  async createReview(input: ReviewInput) {
    const me = this.me();
    this.book(input.bookId);
    const row: ReviewRow = { id: newId(), userId: me, ...input, rating: normaliseRating(input.rating), createdAt: nowIso(), updatedAt: nowIso() };
    this.db.reviews.push(row);
    this.db.posts.push({ ...blankPost(me, "review", input.bookId), reviewId: row.id, visibility: row.visibility });
    if (row.rating != null) {
      const ub = this.ensureUserBook(input.bookId);
      ub.rating = row.rating;
      if (!ub.status) ub.status = "read";
      ub.updatedAt = nowIso();
    }
    this.commit();
    return this.review(row);
  }
  async updateReview(id: string, input: ReviewInput) {
    const me = this.me();
    const row = this.db.reviews.find((r) => r.id === id && r.userId === me);
    if (!row) throw new NotFoundError("Review not found");
    Object.assign(row, { ...input, bookId: row.bookId, rating: normaliseRating(input.rating), updatedAt: nowIso() });
    this.db.posts.filter((p) => p.reviewId === id).forEach((p) => (p.visibility = row.visibility));
    if (row.rating != null) {
      const ub = this.ensureUserBook(row.bookId);
      ub.rating = row.rating;
    }
    this.commit();
    return this.review(row);
  }
  async deleteReview(id: string) {
    const me = this.me();
    const row = this.db.reviews.find((r) => r.id === id && r.userId === me);
    if (!row) return;
    this.db.reviews = this.db.reviews.filter((r) => r.id !== id);
    this.removePosts((p) => p.reviewId === id);
    this.commit();
  }

  // ── quotes ──────────────────────────────────────────────────────────
  async getQuote(id: string) {
    const row = this.db.quotes.find((q) => q.id === id);
    return row && this.canView(row.userId, row.visibility) ? this.quote(row) : null;
  }
  async listQuotesForBook(bookId: string, limit = 20) {
    return this.db.quotes.filter((q) => q.bookId === bookId && this.canView(q.userId, q.visibility)).sort(byNewest).slice(0, limit).map((q) => this.quote(q));
  }
  async listQuotesByUser(userId: string, limit = 60) {
    return this.db.quotes.filter((q) => q.userId === userId && this.canView(q.userId, q.visibility)).sort(byNewest).slice(0, limit).map((q) => this.quote(q));
  }
  async createQuote(input: QuoteInput) {
    const me = this.me();
    this.book(input.bookId);
    const row: QuoteRow = { id: newId(), userId: me, ...input, createdAt: nowIso() };
    this.db.quotes.push(row);
    this.db.posts.push({ ...blankPost(me, "quote", input.bookId), quoteId: row.id, visibility: row.visibility });
    this.commit();
    return this.quote(row);
  }
  async updateQuote(id: string, input: QuoteInput) {
    const me = this.me();
    const row = this.db.quotes.find((q) => q.id === id && q.userId === me);
    if (!row) throw new NotFoundError("Quote not found");
    Object.assign(row, { ...input, bookId: row.bookId });
    this.db.posts.filter((p) => p.quoteId === id).forEach((p) => (p.visibility = row.visibility));
    this.commit();
    return this.quote(row);
  }
  async deleteQuote(id: string) {
    const me = this.me();
    if (!this.db.quotes.some((q) => q.id === id && q.userId === me)) return;
    this.db.quotes = this.db.quotes.filter((q) => q.id !== id);
    this.removePosts((p) => p.quoteId === id);
    this.commit();
  }

  // ── lists ───────────────────────────────────────────────────────────
  async getList(id: string): Promise<ReadingListDetail | null> {
    const row = this.db.lists.find((l) => l.id === id);
    if (!row || !this.canView(row.userId, row.visibility)) return null;
    const books = this.db.listBooks
      .filter((lb) => lb.listId === id)
      .sort((a, b) => a.position - b.position)
      .map((lb) => ({ bookId: lb.bookId, position: lb.position, note: lb.note, imageUrl: lb.imageUrl, book: this.book(lb.bookId) }));
    return { ...this.listSummary(row), books };
  }
  async listListsByUser(userId: string) {
    return this.db.lists.filter((l) => l.userId === userId && this.canView(l.userId, l.visibility)).sort(byUpdated).map((l) => this.listSummary(l));
  }
  async listListsForBook(bookId: string, limit = 8) {
    const ids = new Set(this.db.listBooks.filter((lb) => lb.bookId === bookId).map((lb) => lb.listId));
    return this.db.lists.filter((l) => ids.has(l.id) && this.canView(l.userId, l.visibility)).sort(byUpdated).slice(0, limit).map((l) => this.listSummary(l));
  }
  async popularLists(limit = 8) {
    return this.db.lists
      .filter((l) => l.visibility === "public" && this.db.listBooks.some((lb) => lb.listId === l.id))
      .map((l) => {
        const s = this.listSummary(l);
        const likes = s.postId ? this.db.likes.filter((x) => x.postId === s.postId).length : 0;
        return { s, score: s.followersCount * 2 + likes };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.s);
  }
  async followedLists() {
    if (!this.viewerId) return [];
    const ids = new Set(this.db.listFollows.filter((f) => f.userId === this.viewerId).map((f) => f.listId));
    return this.db.lists.filter((l) => ids.has(l.id) && this.canView(l.userId, l.visibility)).map((l) => this.listSummary(l));
  }
  async createList(input: ListInput) {
    const me = this.me();
    const row: ListRow = { id: newId(), userId: me, ...input, createdAt: nowIso(), updatedAt: nowIso() };
    this.db.lists.push(row);
    this.db.posts.push({ ...blankPost(me, "list", null), listId: row.id, visibility: row.visibility });
    this.commit();
    return this.listSummary(row);
  }
  async updateList(id: string, input: ListInput) {
    const row = this.ownList(id);
    Object.assign(row, input, { updatedAt: nowIso() });
    this.db.posts.filter((p) => p.listId === id).forEach((p) => (p.visibility = row.visibility));
    this.commit();
    return this.listSummary(row);
  }
  async deleteList(id: string) {
    this.ownList(id);
    this.db.lists = this.db.lists.filter((l) => l.id !== id);
    this.db.listBooks = this.db.listBooks.filter((lb) => lb.listId !== id);
    this.db.listFollows = this.db.listFollows.filter((f) => f.listId !== id);
    this.db.notifications = this.db.notifications.filter((n) => n.listId !== id);
    this.removePosts((p) => p.listId === id);
    this.commit();
  }
  async addBookToList(listId: string, bookId: string, note: string | null) {
    const list = this.ownList(listId);
    this.book(bookId);
    if (this.db.listBooks.some((lb) => lb.listId === listId && lb.bookId === bookId)) return;
    const max = Math.max(-1, ...this.db.listBooks.filter((lb) => lb.listId === listId).map((lb) => lb.position));
    this.db.listBooks.push({ listId, bookId, position: max + 1, note, imageUrl: null, addedAt: nowIso() });
    list.updatedAt = nowIso();
    this.commit();
  }
  async updateListBook(listId: string, bookId: string, note: string | null, imageUrl: string | null) {
    this.ownList(listId);
    const row = this.db.listBooks.find((lb) => lb.listId === listId && lb.bookId === bookId);
    if (!row) throw new NotFoundError();
    row.note = note;
    row.imageUrl = imageUrl;
    this.commit();
  }
  async removeBookFromList(listId: string, bookId: string) {
    this.ownList(listId);
    this.db.listBooks = this.db.listBooks.filter((lb) => !(lb.listId === listId && lb.bookId === bookId));
    this.commit();
  }
  async reorderList(listId: string, bookIds: string[]) {
    this.ownList(listId);
    bookIds.forEach((bookId, i) => {
      const row = this.db.listBooks.find((lb) => lb.listId === listId && lb.bookId === bookId);
      if (row) row.position = i;
    });
    this.commit();
  }
  async followList(listId: string) {
    const me = this.me();
    const list = this.db.lists.find((l) => l.id === listId);
    if (!list || !this.canView(list.userId, list.visibility)) throw new NotFoundError("List not found");
    if (this.db.listFollows.some((f) => f.listId === listId && f.userId === me)) return;
    this.db.listFollows.push({ userId: me, listId, createdAt: nowIso() });
    pushNotification(this.db, { recipientId: list.userId, actorId: me, kind: "list_follow", postId: null, commentId: null, listId, recommendationId: null });
    this.commit();
  }
  async unfollowList(listId: string) {
    const me = this.me();
    this.db.listFollows = this.db.listFollows.filter((f) => !(f.listId === listId && f.userId === me));
    this.commit();
  }

  // ── posts & feed ────────────────────────────────────────────────────
  async getFeed(tab: "following" | "discover", cursor: string | null, limit = 12) {
    let rows: PostRow[];
    if (tab === "following") {
      const me = this.me();
      const ids = new Set([me, ...(await this.followingIds())]);
      rows = this.db.posts.filter((p) => ids.has(p.userId) && this.visiblePost(p));
    } else {
      rows = this.db.posts.filter((p) => p.visibility === "public" && p.userId !== this.viewerId && this.visiblePost(p));
    }
    return this.page(rows, cursor, limit);
  }
  async getUserPosts(userId: string, cursor: string | null, limit = 12) {
    return this.page(this.db.posts.filter((p) => p.userId === userId && this.visiblePost(p)), cursor, limit);
  }
  async getBookPosts(bookId: string, limit = 12) {
    return this.page(this.db.posts.filter((p) => p.bookId === bookId && p.kind !== "review" && this.visiblePost(p)), null, limit).items;
  }
  async getPost(id: string) {
    const row = this.db.posts.find((p) => p.id === id);
    return row && this.visiblePost(row) ? this.hydratePost(row) : null;
  }
  async createPost(input: UpdatePostInput) {
    const me = this.me();
    if (!input.body.trim()) throw new ValidationError("Say something first.");
    if (input.bookId) this.book(input.bookId);
    const row: PostRow = {
      ...blankPost(me, input.kind, input.bookId), body: input.body.trim(), progressPages: input.progressPages,
      progressPercent: input.progressPercent, visibility: input.visibility,
    };
    this.db.posts.push(row);
    if (input.bookId && input.progressPages != null) {
      const ub = this.ensureUserBook(input.bookId);
      ub.progressPages = input.progressPages;
      if (!ub.status) ub.status = "reading";
      ub.updatedAt = nowIso();
    }
    this.commit();
    return this.hydratePost(row);
  }
  async deletePost(id: string) {
    const me = this.me();
    const row = this.db.posts.find((p) => p.id === id && p.userId === me);
    if (!row) return;
    // Deleting a shareable entity's post deletes the entity too (mirrors ON DELETE CASCADE from the entity side).
    if (row.reviewId) return this.deleteReview(row.reviewId);
    if (row.quoteId) return this.deleteQuote(row.quoteId);
    if (row.listId) return this.deleteList(row.listId);
    this.removePosts((p) => p.id === id);
    this.commit();
  }
  private removePosts(pred: (p: PostRow) => boolean) {
    const doomed = new Set(this.db.posts.filter(pred).map((p) => p.id));
    // cascade to reposts of the doomed posts
    this.db.posts.filter((p) => p.repostOfId && doomed.has(p.repostOfId)).forEach((p) => doomed.add(p.id));
    this.db.posts = this.db.posts.filter((p) => !doomed.has(p.id));
    this.db.likes = this.db.likes.filter((l) => !doomed.has(l.postId));
    this.db.bookmarks = this.db.bookmarks.filter((l) => !doomed.has(l.postId));
    this.db.comments = this.db.comments.filter((c) => !doomed.has(c.postId));
    this.db.notifications = this.db.notifications.filter((n) => !n.postId || !doomed.has(n.postId));
  }
  private requireVisiblePost(id: string) {
    const p = this.db.posts.find((x) => x.id === id);
    if (!p || !this.visiblePost(p)) throw new NotFoundError("Post not found");
    return p;
  }
  async like(postId: string) {
    const me = this.me();
    const p = this.requireVisiblePost(postId);
    if (this.db.likes.some((l) => l.postId === postId && l.userId === me)) return;
    this.db.likes.push({ userId: me, postId, createdAt: nowIso() });
    pushNotification(this.db, { recipientId: p.userId, actorId: me, kind: "like", postId, commentId: null, listId: null, recommendationId: null });
    this.commit();
  }
  async unlike(postId: string) {
    const me = this.me();
    this.db.likes = this.db.likes.filter((l) => !(l.postId === postId && l.userId === me));
    this.commit();
  }
  async bookmark(postId: string) {
    const me = this.me();
    this.requireVisiblePost(postId);
    if (this.db.bookmarks.some((l) => l.postId === postId && l.userId === me)) return;
    this.db.bookmarks.push({ userId: me, postId, createdAt: nowIso() });
    this.commit();
  }
  async unbookmark(postId: string) {
    const me = this.me();
    this.db.bookmarks = this.db.bookmarks.filter((l) => !(l.postId === postId && l.userId === me));
    this.commit();
  }
  async repost(postId: string) {
    const me = this.me();
    const p = this.requireVisiblePost(postId);
    const target = p.repostOfId ? this.requireVisiblePost(p.repostOfId) : p;
    if (target.visibility !== "public") throw new ValidationError("Only public posts can be reposted.");
    if (target.userId === me) throw new ValidationError("You can't repost your own post.");
    if (this.db.posts.some((x) => x.repostOfId === target.id && x.userId === me)) return;
    this.db.posts.push({ ...blankPost(me, "repost", null), repostOfId: target.id });
    pushNotification(this.db, { recipientId: target.userId, actorId: me, kind: "repost", postId: target.id, commentId: null, listId: null, recommendationId: null });
    this.commit();
  }
  async unrepost(postId: string) {
    const me = this.me();
    this.removePosts((p) => p.userId === me && p.repostOfId === postId);
    this.commit();
  }
  async listBookmarks(cursor: string | null, limit = 12): Promise<Page<Post>> {
    const me = this.me();
    const marks = this.db.bookmarks.filter((b) => b.userId === me).map((b) => ({ ...b, id: b.postId })).filter(beforeCursor(cursor)).sort(byNewest);
    const visible = marks.filter((m) => {
      const p = this.db.posts.find((x) => x.id === m.postId);
      return p && this.visiblePost(p);
    });
    const slice = visible.slice(0, limit);
    return {
      items: slice.map((m) => this.hydratePost(this.db.posts.find((x) => x.id === m.postId)!)),
      nextCursor: visible.length > limit ? encodeCursor(slice[slice.length - 1]) : null,
    };
  }

  // ── comments ────────────────────────────────────────────────────────
  async listComments(postId: string): Promise<Comment[]> {
    const p = this.db.posts.find((x) => x.id === postId);
    if (!p || !this.visiblePost(p)) return [];
    const rows = this.db.comments.filter((c) => c.postId === postId).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    const toComment = (c: (typeof rows)[number]): Comment => ({ ...c, author: this.profile(c.userId), replies: [] });
    const top = rows.filter((c) => !c.parentId).map(toComment);
    const byId = new Map(top.map((c) => [c.id, c]));
    for (const r of rows.filter((c) => c.parentId)) byId.get(r.parentId!)?.replies.push(toComment(r));
    return top;
  }
  async addComment(postId: string, body: string, parentId: string | null) {
    const me = this.me();
    const p = this.requireVisiblePost(postId);
    const text = body.trim();
    if (!text) throw new ValidationError("Comment can't be empty.");
    if (text.length > 2000) throw new ValidationError("Comments are limited to 2,000 characters.");
    let parent = parentId ? this.db.comments.find((c) => c.id === parentId && c.postId === postId) : null;
    if (parent?.parentId) parent = this.db.comments.find((c) => c.id === parent!.parentId) ?? parent; // keep one level of nesting
    const row = { id: newId(), postId, userId: me, parentId: parent?.id ?? null, body: text, createdAt: nowIso() };
    this.db.comments.push(row);
    if (parent && parent.userId !== me) {
      pushNotification(this.db, { recipientId: parent.userId, actorId: me, kind: "reply", postId, commentId: row.id, listId: null, recommendationId: null });
    }
    if (p.userId !== me && p.userId !== parent?.userId) {
      pushNotification(this.db, { recipientId: p.userId, actorId: me, kind: "comment", postId, commentId: row.id, listId: null, recommendationId: null });
    }
    this.commit();
    return { ...row, author: this.profile(me), replies: [] };
  }
  async deleteComment(id: string) {
    const me = this.me();
    const c = this.db.comments.find((x) => x.id === id);
    if (!c) return;
    const p = this.db.posts.find((x) => x.id === c.postId);
    if (c.userId !== me && p?.userId !== me) throw new AuthError("You can only delete your own comments.");
    const doomed = new Set([id, ...this.db.comments.filter((x) => x.parentId === id).map((x) => x.id)]);
    this.db.comments = this.db.comments.filter((x) => !doomed.has(x.id));
    this.db.notifications = this.db.notifications.filter((n) => !n.commentId || !doomed.has(n.commentId));
    this.commit();
  }

  // ── notifications & passes ──────────────────────────────────────────
  async listNotifications(limit = 50): Promise<Notification[]> {
    const me = this.me();
    return this.db.notifications
      .filter((n) => n.recipientId === me)
      .sort(byNewest)
      .slice(0, limit)
      .map((n) => {
        const post = n.postId ? this.db.posts.find((p) => p.id === n.postId) : null;
        const list = n.listId ? this.db.lists.find((l) => l.id === n.listId) : null;
        const comment = n.commentId ? this.db.comments.find((c) => c.id === n.commentId) : null;
        const rec = n.recommendationId ? this.db.recommendations.find((r) => r.id === n.recommendationId) : null;
        return {
          id: n.id, kind: n.kind, actor: this.profile(n.actorId), postId: n.postId, postExcerpt: post ? this.postExcerpt(post) : null,
          listId: n.listId, listTitle: list?.title ?? null, commentBody: comment?.body ?? null,
          recommendation: rec ? this.recommendation(rec) : null, readAt: n.readAt, createdAt: n.createdAt,
        };
      });
  }
  private postExcerpt(p: PostRow): string {
    if (p.reviewId) {
      const r = this.db.reviews.find((x) => x.id === p.reviewId);
      return r ? `your review of ${this.book(r.bookId).title}` : "your review";
    }
    if (p.quoteId) {
      const q = this.db.quotes.find((x) => x.id === p.quoteId);
      return q ? `“${q.body.slice(0, 60)}${q.body.length > 60 ? "…" : ""}”` : "your quote";
    }
    if (p.listId) {
      const l = this.db.lists.find((x) => x.id === p.listId);
      return l ? `your list “${l.title}”` : "your list";
    }
    if (p.bookId) return `your post about ${this.book(p.bookId).title}`;
    return "your post";
  }
  private recommendation(r: DemoDB["recommendations"][number]): Recommendation {
    return {
      id: r.id, sender: this.profile(r.senderId), recipient: this.profile(r.recipientId), book: this.book(r.bookId),
      message: r.message, parentId: r.parentId, seenAt: r.seenAt, createdAt: r.createdAt,
    };
  }
  async unreadNotificationCount() {
    if (!this.viewerId) return 0;
    return this.db.notifications.filter((n) => n.recipientId === this.viewerId && !n.readAt).length;
  }
  async markNotificationsRead() {
    const me = this.me();
    const t = nowIso();
    this.db.notifications.forEach((n) => {
      if (n.recipientId === me && !n.readAt) n.readAt = t;
    });
    this.db.recommendations.forEach((r) => {
      if (r.recipientId === me && !r.seenAt) r.seenAt = t;
    });
    this.commit();
  }
  async sendRecommendation(recipientId: string, bookId: string, message: string | null, parentId: string | null) {
    const me = this.me();
    if (recipientId === me) throw new ValidationError("You can't pass a book to yourself.");
    this.profile(recipientId);
    this.book(bookId);
    const parent = parentId ? this.db.recommendations.find((r) => r.id === parentId && r.recipientId === me) : null;
    const row = { id: newId(), senderId: me, recipientId, bookId, message: message?.trim() || null, parentId: parent?.id ?? null, seenAt: null, createdAt: nowIso() };
    this.db.recommendations.push(row);
    pushNotification(this.db, { recipientId, actorId: me, kind: "recommendation", postId: null, commentId: null, listId: null, recommendationId: row.id });
    this.commit();
    return this.recommendation(row);
  }
  async listRecommendationsReceived(limit = 30) {
    const me = this.me();
    return this.db.recommendations.filter((r) => r.recipientId === me).sort(byNewest).slice(0, limit).map((r) => this.recommendation(r));
  }

  // ── stats ───────────────────────────────────────────────────────────
  async getProfileStats(userId: string, year: number): Promise<ProfileStats> {
    const shelf = this.db.userBooks.filter((u) => u.userId === userId);
    return buildStats(
      year,
      shelf.map((u) => ({ ...u, book: this.book(u.bookId) })),
      this.db.reviews.filter((r) => r.userId === userId && this.canView(userId, r.visibility)).length,
      this.db.quotes.filter((q) => q.userId === userId && this.canView(userId, q.visibility)).length,
      this.db.lists.filter((l) => l.userId === userId && this.canView(userId, l.visibility)).length,
    );
  }
  async compatibility(otherId: string): Promise<Compatibility | null> {
    if (!this.viewerId || otherId === this.viewerId) return null;
    const mine = this.db.userBooks.filter((u) => u.userId === this.viewerId && u.status && u.status !== "want_to_read");
    const theirs = new Map(this.db.userBooks.filter((u) => u.userId === otherId && u.status && u.status !== "want_to_read").map((u) => [u.bookId, u]));
    const me = this.db.profiles.find((p) => p.id === this.viewerId)!;
    const other = this.db.profiles.find((p) => p.id === otherId);
    if (!other) return null;
    const shared = mine.filter((m) => theirs.has(m.bookId)).map((m) => ({ a: m.rating, b: theirs.get(m.bookId)!.rating }));
    const sharedGenres = me.favouriteGenres.filter((g) => other.favouriteGenres.includes(g));
    return { score: compatibilityScore(shared, sharedGenres.length), sharedBooks: shared.length, sharedGenres };
  }
}

// ── pure helpers (shared with the Supabase store) ──────────────────────
export function toBook(row: BookRow): SavedBook {
  return {
    id: row.id, slug: row.slug, title: row.title, subtitle: row.subtitle, authors: row.authors, description: row.description,
    coverUrl: row.coverUrl, isbn13: row.isbn13, isbn10: row.isbn10, olWorkId: row.olWorkId, olEditionId: row.olEditionId,
    publishedYear: row.publishedYear, publisher: row.publisher, pageCount: row.pageCount, language: row.language,
    genres: row.genres, moods: row.moods,
  };
}

function blankPost(userId: string, kind: PostRow["kind"], bookId: string | null): PostRow {
  return {
    id: newId(), userId, kind, bookId, reviewId: null, quoteId: null, listId: null, repostOfId: null, body: null,
    progressPages: null, progressPercent: null, visibility: "public", createdAt: nowIso(),
  };
}

const byUpdated = (a: { updatedAt: string }, b: { updatedAt: string }) => (a.updatedAt < b.updatedAt ? 1 : -1);
const byNewestFollow = (a: { createdAt: string }, b: { createdAt: string }) => (a.createdAt < b.createdAt ? 1 : -1);

