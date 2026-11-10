import type {
  MarginaliaQuery,
  Book,
  BookInput,
  BookReader,
  BookStats,
  Comment,
  Compatibility,
  FeedFilter,
  Invite,
  InvitePreview,
  ListSort,
  ReadingRecap,
  SimilarReader,
  ListInput,
  LogBookInput,
  LogBookResult,
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
  Relationship,
  ReportInput,
  Review,
  ReviewInput,
  SavedBook,
  SessionInput,
  ShelfMove,
  ShelfMoveOptions,
  ShelfQuery,
  ShelfStatus,
  ShelfSummary,
  ShelfUndo,
  UpdatePostInput,
  UserBook,
} from "@/lib/types";

/**
 * The single contract every backend implements.
 *
 * A store is created per request and bound to the current viewer (or none).
 * Implementations MUST enforce visibility: anything the viewer may not see is
 * simply absent. In Supabase this is guaranteed by Row Level Security; the demo
 * store mirrors the same rules in code.
 *
 * Mutating methods throw `AuthError` when there is no viewer.
 */
export interface DataStore {
  readonly mode: "supabase" | "demo";
  readonly viewerId: string | null;

  // ── profiles & graph ───────────────────────────────────────────────
  getProfileById(id: string): Promise<Profile | null>;
  getProfileByUsername(username: string): Promise<Profile | null>;
  isUsernameAvailable(username: string): Promise<boolean>;
  updateProfile(patch: ProfilePatch): Promise<Profile>;
  searchProfiles(q: string, limit?: number): Promise<Profile[]>;
  suggestedReaders(limit?: number): Promise<Profile[]>;
  isFollowing(targetId: string): Promise<boolean>;
  follow(targetId: string): Promise<void>;
  unfollow(targetId: string): Promise<void>;
  listFollowers(userId: string): Promise<Profile[]>;
  listFollowing(userId: string): Promise<Profile[]>;
  followingIds(): Promise<string[]>;

  // ── catalogue ──────────────────────────────────────────────────────
  getBookById(id: string): Promise<SavedBook | null>;
  getBookBySlug(slug: string): Promise<SavedBook | null>;
  getBookByOlWorkId(olWorkId: string): Promise<SavedBook | null>;
  /** Insert-or-return, de-duplicated by Open Library work id, then ISBN-13. */
  upsertBook(input: BookInput): Promise<SavedBook>;
  searchBooks(q: string, limit?: number): Promise<SavedBook[]>;
  booksByGenre(genre: string, limit?: number): Promise<SavedBook[]>;
  booksByMood(mood: string, limit?: number): Promise<SavedBook[]>;
  trendingBooks(limit?: number): Promise<SavedBook[]>;
  recentlyReviewedBooks(limit?: number): Promise<SavedBook[]>;
  getBookStats(bookId: string): Promise<BookStats>;
  getBookReaders(bookId: string, limit?: number): Promise<BookReader[]>;

  // ── shelves ────────────────────────────────────────────────────────
  getUserBook(bookId: string): Promise<UserBook | null>;
  /** Atomic: the shelf entry, the reading diary and (only with `share`) a feed post. */
  setShelfStatus(bookId: string, status: ShelfStatus | null, opts?: ShelfMoveOptions): Promise<ShelfMove>;
  /** Put back what a recent move changed (within 15 minutes). */
  undoShelfMove(undo: ShelfUndo): Promise<UserBook | null>;
  /** One imported book (e.g. from Goodreads): shelf, rating, date, custom shelves; a diary entry for a dated read. */
  importShelfEntry(input: { bookId: string; status: ShelfStatus; rating: number | null; finishedOn: string | null; shelves: string[]; overwrite: boolean }): Promise<"imported" | "updated" | "skipped">;
  /** Atomic "I finished this": diary entry, Read shelf, rating, and optional review / line / post. */
  logBook(input: LogBookInput): Promise<LogBookResult>;
  setRating(bookId: string, rating: number | null): Promise<UserBook>;
  setFavourite(bookId: string, favourite: boolean): Promise<UserBook>;
  setCustomShelves(bookId: string, shelves: string[]): Promise<UserBook>;
  setProgress(bookId: string, pages: number | null): Promise<UserBook>;
  getShelf(userId: string, query: ShelfQuery): Promise<UserBook[]>;
  getShelfSummary(userId: string): Promise<ShelfSummary>;
  getFavouriteBooks(userId: string, limit?: number): Promise<SavedBook[]>;

  // ── diary ──────────────────────────────────────────────────────────
  listSessions(bookId?: string): Promise<ReadingSession[]>;
  addSession(input: SessionInput): Promise<ReadingSession>;
  deleteSession(id: string): Promise<void>;

  // ── reviews ────────────────────────────────────────────────────────
  getReview(id: string): Promise<Review | null>;
  listReviewsForBook(bookId: string, limit?: number): Promise<Review[]>;
  listReviewsByUser(userId: string, limit?: number): Promise<Review[]>;
  createReview(input: ReviewInput): Promise<Review>;
  updateReview(id: string, input: ReviewInput): Promise<Review>;
  deleteReview(id: string): Promise<void>;

  // ── quotes ─────────────────────────────────────────────────────────
  getQuote(id: string): Promise<Quote | null>;
  listQuotesForBook(bookId: string, limit?: number): Promise<Quote[]>;
  listQuotesByUser(userId: string, limit?: number): Promise<Quote[]>;
  createQuote(input: QuoteInput): Promise<Quote>;
  updateQuote(id: string, input: QuoteInput): Promise<Quote>;
  deleteQuote(id: string): Promise<void>;
  /** Published annotations as posts (so likes/comments/bookmarks come along), filtered and paged. */
  listMarginalia(query: MarginaliaQuery, cursor: string | null, limit?: number): Promise<Page<Post>>;
  /** The most used tags on public annotations, for filters and suggestions. */
  marginaliaTags(limit?: number): Promise<{ tag: string; count: number }[]>;

  // ── lists ──────────────────────────────────────────────────────────
  getList(id: string): Promise<ReadingListDetail | null>;
  listListsByUser(userId: string): Promise<ReadingList[]>;
  listListsForBook(bookId: string, limit?: number): Promise<ReadingList[]>;
  popularLists(limit?: number): Promise<ReadingList[]>;
  /** Public pinboards by title or description, sorted. */
  searchLists(q: string, sort: ListSort, limit?: number): Promise<ReadingList[]>;
  followedLists(): Promise<ReadingList[]>;
  createList(input: ListInput): Promise<ReadingList>;
  updateList(id: string, input: ListInput): Promise<ReadingList>;
  deleteList(id: string): Promise<void>;
  addBookToList(listId: string, bookId: string, note: string | null): Promise<void>;
  updateListBook(listId: string, bookId: string, note: string | null, imageUrl: string | null): Promise<void>;
  removeBookFromList(listId: string, bookId: string): Promise<void>;
  reorderList(listId: string, bookIds: string[]): Promise<void>;
  followList(listId: string): Promise<void>;
  unfollowList(listId: string): Promise<void>;

  // ── posts & feed ───────────────────────────────────────────────────
  getFeed(tab: "following" | "discover", cursor: string | null, limit?: number, filter?: FeedFilter): Promise<Page<Post>>;
  getUserPosts(userId: string, cursor: string | null, limit?: number): Promise<Page<Post>>;
  getBookPosts(bookId: string, limit?: number): Promise<Post[]>;
  getPost(id: string): Promise<Post | null>;
  createPost(input: UpdatePostInput): Promise<Post>;
  deletePost(id: string): Promise<void>;
  like(postId: string): Promise<void>;
  unlike(postId: string): Promise<void>;
  bookmark(postId: string): Promise<void>;
  unbookmark(postId: string): Promise<void>;
  repost(postId: string): Promise<void>;
  unrepost(postId: string): Promise<void>;
  /** Your saved posts; `kind` narrows them (e.g. "quote" for saved annotations). */
  listBookmarks(cursor: string | null, limit?: number, kind?: Post["kind"]): Promise<Page<Post>>;

  // ── comments ───────────────────────────────────────────────────────
  listComments(postId: string): Promise<Comment[]>;
  addComment(postId: string, body: string, parentId: string | null): Promise<Comment>;
  updateComment(id: string, body: string): Promise<Comment>;
  deleteComment(id: string): Promise<void>;

  // ── notifications & passes ─────────────────────────────────────────
  listNotifications(limit?: number): Promise<Notification[]>;
  unreadNotificationCount(): Promise<number>;
  markNotificationsRead(): Promise<void>;
  sendRecommendation(recipientId: string, bookId: string, message: string | null, parentId: string | null): Promise<Recommendation>;
  listRecommendationsReceived(limit?: number): Promise<Recommendation[]>;

  // ── discovery & invites ────────────────────────────────────────────
  similarReaders(limit?: number): Promise<SimilarReader[]>;
  createInvite(opts: { expiresInDays: number | null; maxUses: number | null }): Promise<Invite>;
  listInvites(): Promise<Invite[]>;
  deleteInvite(code: string): Promise<void>;
  invitePreview(code: string): Promise<InvitePreview | null>;
  /** For a newly joined reader: count the invite once and follow whoever sent it. */
  redeemInvite(code: string): Promise<boolean>;
  readingRecap(userId: string, year: number, month: number | null): Promise<ReadingRecap>;

  // ── safety & your data ─────────────────────────────────────────────
  relationship(targetId: string): Promise<Relationship>;
  block(targetId: string): Promise<void>;
  unblock(targetId: string): Promise<void>;
  mute(targetId: string): Promise<void>;
  unmute(targetId: string): Promise<void>;
  listBlocked(): Promise<Profile[]>;
  listMuted(): Promise<Profile[]>;
  report(input: ReportInput): Promise<void>;
  /** Everything the signed-in reader has created, for download. */
  exportMyData(): Promise<Record<string, unknown>>;
  /** Permanently delete the signed-in reader's account, content and uploads. */
  deleteMyAccount(): Promise<void>;

  // ── stats & signature features ─────────────────────────────────────
  getProfileStats(userId: string, year: number): Promise<ProfileStats>;
  compatibility(otherId: string): Promise<Compatibility | null>;
}

export class AuthError extends Error {
  constructor(message = "You need to be signed in to do that.") {
    super(message);
    this.name = "AuthError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "That couldn't be found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Too many writes in a short time (database rate limits). */
export class RateLimitError extends Error {
  constructor(message = "You're doing that a lot. Give it a little while and try again.") {
    super(message);
    this.name = "RateLimitError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Helpers both stores use. */
export function computeHistogram(ratings: (number | null)[]): number[] {
  const h = new Array(10).fill(0);
  for (const r of ratings) {
    if (r == null) continue;
    const idx = Math.round(r * 2) - 1;
    if (idx >= 0 && idx < 10) h[idx] += 1;
  }
  return h;
}

export function emptyStats(): BookStats {
  return { avgRating: null, ratingsCount: 0, readersCount: 0, readingCount: 0, wantCount: 0, histogram: new Array(10).fill(0) };
}

export type { Book };
