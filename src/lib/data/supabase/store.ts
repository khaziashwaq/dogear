import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MarginaliaQuery,
  BookInput,
  BookReader,
  BookStats,
  Comment,
  Compatibility,
  CoShelvedBook,
  Suggestion,
  SuggestionInput,
  SuggestionState,
  SuggestionStatus,
  TasteEntry,
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
import { normaliseRating, slugify } from "@/lib/utils";
import { AuthError, NotFoundError, RateLimitError, ValidationError, emptyStats, type DataStore } from "../store";
import { checkSuggestionInputs, cleanShelves, closedKeys, sortShelf, toSuggestion } from "../shared";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

// ── row mappers ────────────────────────────────────────────────────────
export function mapProfile(r: Row): Profile {
  return {
    id: r.id, username: r.username ?? null, displayName: r.display_name ?? "", bio: r.bio ?? "", avatarUrl: r.avatar_url,
    coverUrl: r.cover_url, pronouns: r.pronouns, location: r.location, website: r.website, accent: r.accent, motif: r.profile_motif,
    favouriteGenres: r.favourite_genres ?? [], favouriteAuthors: r.favourite_authors ?? [], readingGoal: r.reading_goal,
    onboarded: r.onboarded, followersCount: r.followers_count ?? 0, followingCount: r.following_count ?? 0, createdAt: r.created_at,
  };
}
export function mapBook(r: Row): SavedBook {
  return {
    id: r.id, slug: r.slug, title: r.title, subtitle: r.subtitle, authors: r.authors ?? [], description: r.description,
    coverUrl: r.cover_url, isbn13: r.isbn13, isbn10: r.isbn10, olWorkId: r.ol_work_id, olEditionId: r.ol_edition_id,
    publishedYear: r.published_year, publisher: r.publisher, pageCount: r.page_count, language: r.language,
    genres: r.genres ?? [], moods: r.moods ?? [],
  };
}
const num = (v: unknown) => (v == null ? null : Number(v));

function mapUserBook(r: Row): UserBook {
  return {
    id: r.id, userId: r.user_id, bookId: r.book_id, status: r.status, rating: num(r.rating), isFavourite: r.is_favourite,
    shelves: r.shelves ?? [], progressPages: r.progress_pages, startedAt: r.started_at, finishedAt: r.finished_at,
    createdAt: r.created_at, updatedAt: r.updated_at, book: mapBook(r.book),
  };
}

const PROFILE = "profiles!%s_user_id_fkey(*)";
const author = (table: string) => `author:${PROFILE.replace("%s", table)}`;
const REVIEW_SELECT = `*, book:books(*), ${author("reviews")}`;
const QUOTE_SELECT = `*, book:books(*), ${author("quotes")}`;
const LIST_SELECT = `*, owner:${PROFILE.replace("%s", "lists")}`;
const POST_SELECT = `*, ${author("posts")}, book:books(*), review:reviews(${REVIEW_SELECT}), quote:quotes(${QUOTE_SELECT}), list:lists(${LIST_SELECT})`;

function cursorFilter(cursor: string | null) {
  if (!cursor) return null;
  const [createdAt, id] = cursor.split("|");
  return `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`;
}
const safeLike = (q: string) => q.replace(/[%_,()*\\]/g, " ").trim();

function fail(error: { message: string; code?: string } | null, fallback = "Something went wrong.") {
  if (!error) return;
  if (error.code === "23505") throw new ValidationError("That already exists.");
  if (error.code === "42501") throw new AuthError("You don't have permission to do that.");
  if (error.code === "23514") throw new ValidationError("Some of those details aren't valid.");
  if (error.code === "DG429") throw new RateLimitError();
  if (error.code === "P0002") throw new NotFoundError(error.message);
  if (error.code === "22023") throw new ValidationError(error.message);
  throw new Error(`${fallback} (${error.message})`);
}

/**
 * Supabase backend. Every query runs as the signed-in viewer, so Row Level
 * Security decides what is visible — this class never filters for permissions
 * itself beyond choosing sensible queries.
 */
export class SupabaseStore implements DataStore {
  readonly mode = "supabase" as const;

  // Untyped on purpose: rows are mapped explicitly below (see `npm run db:types` in the README for generated types).
  private sb: any;

  constructor(client: SupabaseClient, readonly viewerId: string | null) {
    this.sb = client;
  }

  private me() {
    if (!this.viewerId) throw new AuthError();
    return this.viewerId;
  }

  // ── hydration ───────────────────────────────────────────────────────
  private async postIds(field: "review_id" | "quote_id" | "list_id", ids: string[]) {
    if (!ids.length) return new Map<string, string>();
    const { data } = await this.sb.from("posts").select(`id, ${field}`).in(field, ids);
    return new Map<string, string>((data ?? []).map((r: Row) => [r[field] as string, r.id as string]));
  }

  private async hydrateReviews(rows: Row[]): Promise<Review[]> {
    if (!rows.length) return [];
    const { data } = await this.sb.from("posts").select("id, review_id, likes_count, comments_count").in("review_id", rows.map((r) => r.id));
    const posts = new Map<string, Row>((data ?? []).map((p: Row) => [p.review_id as string, p]));
    return rows.map((r) => this.review(r, posts.get(r.id) ?? null));
  }
  private review(r: Row, post: Row | null): Review {
    return {
      id: r.id, userId: r.user_id, bookId: r.book_id, rating: num(r.rating), title: r.title, body: r.body,
      containsSpoilers: r.contains_spoilers, isReread: r.is_reread, visibility: r.visibility, createdAt: r.created_at,
      updatedAt: r.updated_at, postId: post?.id ?? null, likesCount: post?.likes_count ?? 0, commentsCount: post?.comments_count ?? 0,
      author: mapProfile(r.author), book: mapBook(r.book),
    };
  }
  private async hydrateQuotes(rows: Row[]): Promise<Quote[]> {
    if (!rows.length) return [];
    const { data } = await this.sb.from("posts").select("id, quote_id, likes_count, comments_count").in("quote_id", rows.map((r) => r.id));
    const posts = new Map<string, Row>((data ?? []).map((p: Row) => [p.quote_id as string, p]));
    return rows.map((r) => this.quote(r, posts.get(r.id) ?? null));
  }
  private quote(r: Row, post: Row | null): Quote {
    return {
      id: r.id, userId: r.user_id, bookId: r.book_id, body: r.body, page: r.page, commentary: r.commentary,
      visibility: r.visibility, highlight: r.highlight ?? "butter", tags: r.tags ?? [], isDraft: Boolean(r.is_draft),
      createdAt: r.created_at, updatedAt: r.updated_at ?? r.created_at,
      postId: post?.id ?? null, likesCount: post?.likes_count ?? 0, commentsCount: post?.comments_count ?? 0,
      author: mapProfile(r.author), book: mapBook(r.book),
    };
  }
  private async hydrateLists(rows: Row[]): Promise<ReadingList[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const [{ data: books }, posts, follows] = await Promise.all([
      this.sb.from("list_books").select("list_id, position, book:books(*)").in("list_id", ids).order("position"),
      this.postIds("list_id", ids),
      this.viewerId
        ? this.sb.from("list_follows").select("list_id").eq("user_id", this.viewerId).in("list_id", ids)
        : Promise.resolve({ data: [] as Row[] }),
    ]);
    const followed = new Set((follows.data ?? []).map((f: Row) => f.list_id));
    return rows.map((r) => {
      const mine = (books ?? []).filter((b: Row) => b.list_id === r.id);
      return {
        id: r.id, userId: r.user_id, title: r.title, description: r.description, coverStyle: r.cover_style,
        coverImageUrl: r.cover_image_url, visibility: r.visibility, isRanked: r.is_ranked, followersCount: r.followers_count,
        bookCount: mine.length, createdAt: r.created_at, updatedAt: r.updated_at, postId: posts.get(r.id) ?? null,
        owner: mapProfile(r.owner), preview: mine.slice(0, 5).map((b: Row) => mapBook(b.book)), viewerFollows: followed.has(r.id),
      };
    });
  }

  private async hydratePosts(rows: Row[], depth = 0): Promise<Post[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const repostIds = rows.map((r) => r.repost_of_id).filter(Boolean) as string[];
    const reviewRows = rows.map((r) => r.review).filter(Boolean);
    const quoteRows = rows.map((r) => r.quote).filter(Boolean);
    const listRows = rows.map((r) => r.list).filter(Boolean);
    const v = this.viewerId;
    const [lists, originals, likes, marks, reposts] = await Promise.all([
      this.hydrateLists(listRows),
      depth === 0 && repostIds.length
        ? this.sb.from("posts").select(POST_SELECT).in("id", repostIds).then(({ data }: { data: Row[] | null }) => this.hydratePosts(data ?? [], 1))
        : Promise.resolve([] as Post[]),
      v ? this.sb.from("likes").select("post_id").eq("user_id", v).in("post_id", ids) : Promise.resolve({ data: [] as Row[] }),
      v ? this.sb.from("bookmarks").select("post_id").eq("user_id", v).in("post_id", ids) : Promise.resolve({ data: [] as Row[] }),
      v ? this.sb.from("posts").select("repost_of_id").eq("user_id", v).in("repost_of_id", ids) : Promise.resolve({ data: [] as Row[] }),
    ]);
    const liked = new Set((likes.data ?? []).map((r: Row) => r.post_id));
    const marked = new Set((marks.data ?? []).map((r: Row) => r.post_id));
    const reposted = new Set((reposts.data ?? []).map((r: Row) => r.repost_of_id));
    const listById = new Map(lists.map((l) => [l.id, l]));
    const origById = new Map<string, Post>(originals.map((p: Post) => [p.id, p]));
    void reviewRows;
    void quoteRows;
    return rows
      .map((r): Post => ({
        id: r.id, userId: r.user_id, kind: r.kind, body: r.body, progressPages: r.progress_pages, progressPercent: r.progress_percent,
        visibility: r.visibility, likesCount: r.likes_count, commentsCount: r.comments_count, repostsCount: r.reposts_count,
        createdAt: r.created_at, author: mapProfile(r.author), book: r.book ? mapBook(r.book) : null,
        review: r.review ? this.review(r.review, r) : null,
        quote: r.quote ? this.quote(r.quote, r) : null,
        list: r.list ? listById.get(r.list.id) ?? null : null,
        repostOf: r.repost_of_id ? origById.get(r.repost_of_id) ?? null : null,
        viewer: { liked: liked.has(r.id), bookmarked: marked.has(r.id), reposted: reposted.has(r.id) },
      }))
      .filter((p) => (p.kind !== "repost" || p.repostOf) && (p.kind !== "review" || p.review) && (p.kind !== "quote" || p.quote) && (p.kind !== "list" || p.list));
  }

  private async pagePosts(query: any, cursor: string | null, limit: number): Promise<Page<Post>> {
    const filter = cursorFilter(cursor);
    if (filter) query = query.or(filter);
    const { data, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
    fail(error);
    const rows: Row[] = data ?? [];
    const slice = rows.slice(0, limit);
    const items = await this.hydratePosts(slice);
    const last = slice[slice.length - 1];
    return { items, nextCursor: rows.length > limit && last ? `${last.created_at}|${last.id}` : null };
  }

  // ── profiles & graph ────────────────────────────────────────────────
  async getProfileById(id: string) {
    const { data } = await this.sb.from("profiles").select("*").eq("id", id).maybeSingle();
    return data ? mapProfile(data) : null;
  }
  async getProfileByUsername(username: string) {
    const { data } = await this.sb.from("profiles").select("*").eq("username", username.toLowerCase()).maybeSingle();
    return data ? mapProfile(data) : null;
  }
  async isUsernameAvailable(username: string) {
    const { data } = await this.sb.from("profiles").select("id").eq("username", username.toLowerCase()).maybeSingle();
    return !data || data.id === this.viewerId;
  }
  async updateProfile(patch: ProfilePatch) {
    const me = this.me();
    const map: Record<keyof ProfilePatch, string> = {
      username: "username", displayName: "display_name", bio: "bio", avatarUrl: "avatar_url", coverUrl: "cover_url",
      pronouns: "pronouns", location: "location", website: "website", accent: "accent", motif: "profile_motif",
      favouriteGenres: "favourite_genres", favouriteAuthors: "favourite_authors", readingGoal: "reading_goal", onboarded: "onboarded",
    };
    const row: Row = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) row[map[k as keyof ProfilePatch]] = v;
    const { data, error } = await this.sb.from("profiles").update(row).eq("id", me).select("*").single();
    if (error?.code === "23505") throw new ValidationError("That username is taken.");
    fail(error, "Couldn't save your profile");
    return mapProfile(data);
  }
  async searchProfiles(q: string, limit = 20) {
    const s = safeLike(q);
    if (!s) return [];
    const { data } = await this.sb.from("profiles").select("*").eq("onboarded", true)
      .or(`username.ilike.%${s}%,display_name.ilike.%${s}%`).order("followers_count", { ascending: false }).limit(limit);
    return (data ?? []).map(mapProfile);
  }
  async suggestedReaders(limit = 8) {
    const { data } = await this.sb.rpc("suggested_readers", { p_limit: limit });
    return (data ?? []).map(mapProfile);
  }
  async isFollowing(targetId: string) {
    if (!this.viewerId) return false;
    const { data } = await this.sb.from("follows").select("follower_id").eq("follower_id", this.viewerId).eq("following_id", targetId).maybeSingle();
    return Boolean(data);
  }
  async follow(targetId: string) {
    const me = this.me();
    if (me === targetId) return;
    const { error } = await this.sb.from("follows").upsert({ follower_id: me, following_id: targetId }, { onConflict: "follower_id,following_id", ignoreDuplicates: true });
    fail(error, "Couldn't follow");
  }
  async unfollow(targetId: string) {
    const { error } = await this.sb.from("follows").delete().eq("follower_id", this.me()).eq("following_id", targetId);
    fail(error);
  }
  async listFollowers(userId: string) {
    const { data } = await this.sb.from("follows").select("p:profiles!follows_follower_id_fkey(*)").eq("following_id", userId).order("created_at", { ascending: false }).limit(200);
    return (data ?? []).map((r: Row) => mapProfile(r.p));
  }
  async listFollowing(userId: string) {
    const { data } = await this.sb.from("follows").select("p:profiles!follows_following_id_fkey(*)").eq("follower_id", userId).order("created_at", { ascending: false }).limit(200);
    return (data ?? []).map((r: Row) => mapProfile(r.p));
  }
  async followingIds() {
    if (!this.viewerId) return [];
    const { data } = await this.sb.from("follows").select("following_id").eq("follower_id", this.viewerId).limit(5000);
    return (data ?? []).map((r: Row) => r.following_id as string);
  }

  // ── catalogue ───────────────────────────────────────────────────────
  async getBookById(id: string) {
    const { data } = await this.sb.from("books").select("*").eq("id", id).maybeSingle();
    return data ? mapBook(data) : null;
  }
  async getBookBySlug(slug: string) {
    const { data } = await this.sb.from("books").select("*").eq("slug", slug).maybeSingle();
    return data ? mapBook(data) : null;
  }
  async getBookByOlWorkId(olWorkId: string) {
    const { data } = await this.sb.from("books").select("*").eq("ol_work_id", olWorkId).maybeSingle();
    return data ? mapBook(data) : null;
  }
  async upsertBook(input: BookInput) {
    const me = this.me();
    // The catalogue is shared, so only the server writes it (readers have no insert/update rights on books).
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const admin = supabaseAdmin();
    if (input.olWorkId) {
      const found = await this.getBookByOlWorkId(input.olWorkId);
      if (found) return found;
    }
    if (input.isbn13) {
      const { data } = await this.sb.from("books").select("*").eq("isbn13", input.isbn13).maybeSingle();
      if (data) return mapBook(data);
    }
    const base = slugify(`${input.title} ${input.authors[0] ?? ""}`);
    const { data: clash } = await this.sb.from("books").select("id").eq("slug", base).maybeSingle();
    const slug = clash ? `${base}-${(input.olWorkId ?? crypto.randomUUID().slice(0, 6)).toLowerCase()}` : base;
    const { data, error } = await admin.from("books").insert({
      slug, title: input.title, subtitle: input.subtitle, authors: input.authors, description: input.description,
      cover_url: input.coverUrl, isbn13: input.isbn13, isbn10: input.isbn10, ol_work_id: input.olWorkId, ol_edition_id: input.olEditionId,
      published_year: input.publishedYear, publisher: input.publisher, page_count: input.pageCount, language: input.language,
      genres: input.genres, moods: input.moods, subjects: (input.subjects ?? []).slice(0, 30), created_by: me,
    }).select("*").single();
    if (error?.code === "23505" && input.olWorkId) {
      const raced = await this.getBookByOlWorkId(input.olWorkId);
      if (raced) return raced;
    }
    fail(error, "Couldn't add that book");
    return mapBook(data);
  }
  async searchBooks(q: string, limit = 20) {
    const s = safeLike(q);
    if (!s) return [];
    const isbn = s.replace(/[^0-9X]/gi, "");
    let query = this.sb.from("books").select("*");
    query = /^97[89]\d{10}$/.test(isbn) ? query.eq("isbn13", isbn) : query.or(`title.ilike.%${s}%,authors.cs.{"${s}"}`);
    const { data } = await query.limit(limit);
    return (data ?? []).map(mapBook);
  }
  async booksByGenre(genre: string, limit = 24) {
    const { data } = await this.sb.from("books").select("*").contains("genres", [genre]).order("created_at", { ascending: false }).limit(limit);
    return (data ?? []).map(mapBook);
  }
  async booksByMood(mood: string, limit = 24) {
    const { data } = await this.sb.from("books").select("*").contains("moods", [mood]).order("created_at", { ascending: false }).limit(limit);
    return (data ?? []).map(mapBook);
  }
  async trendingBooks(limit = 12) {
    const { data } = await this.sb.rpc("trending_books", { p_limit: limit, p_days: 30 });
    return (data ?? []).map(mapBook);
  }
  async recentlyReviewedBooks(limit = 12) {
    const { data } = await this.sb.rpc("recently_reviewed_books", { p_limit: limit });
    return (data ?? []).map(mapBook);
  }
  async getBookStats(bookId: string): Promise<BookStats> {
    const [{ data: s }, { data: ratings }] = await Promise.all([
      this.sb.from("book_stats").select("*").eq("book_id", bookId).maybeSingle(),
      this.sb.rpc("rating_histogram", { p_book_id: bookId }),
    ]);
    if (!s) return emptyStats();
    return {
      avgRating: num(s.avg_rating), ratingsCount: s.ratings_count, readersCount: s.readers_count, readingCount: s.reading_count,
      wantCount: s.want_count, histogram: (ratings as number[] | null) ?? new Array(10).fill(0),
    };
  }
  async getBookReaders(bookId: string, limit = 24): Promise<BookReader[]> {
    const { data } = await this.sb.from("user_books").select("status, rating, updated_at, p:profiles!user_books_user_id_fkey(*)")
      .eq("book_id", bookId).not("status", "is", null).order("updated_at", { ascending: false }).limit(limit);
    return (data ?? []).map((r: Row) => ({ profile: mapProfile(r.p), status: r.status, rating: num(r.rating), updatedAt: r.updated_at }));
  }

  // ── shelves ─────────────────────────────────────────────────────────
  async getUserBook(bookId: string) {
    if (!this.viewerId) return null;
    const { data } = await this.sb.from("user_books").select("*, book:books(*)").eq("user_id", this.viewerId).eq("book_id", bookId).maybeSingle();
    return data ? mapUserBook(data) : null;
  }
  private async patchUserBook(bookId: string, patch: Row): Promise<UserBook> {
    const me = this.me();
    const { data, error } = await this.sb.from("user_books")
      .upsert({ user_id: me, book_id: bookId, ...patch }, { onConflict: "user_id,book_id" })
      .select("*, book:books(*)").single();
    fail(error, "Couldn't update your shelf");
    return mapUserBook(data);
  }
  async setShelfStatus(bookId: string, status: ShelfStatus | null, opts: ShelfMoveOptions = {}): Promise<ShelfMove> {
    this.me();
    const { data, error } = await this.sb.rpc("set_shelf_status", {
      p_book_id: bookId, p_status: status, p_reread: Boolean(opts.reread), p_share: Boolean(opts.share),
      p_visibility: opts.visibility ?? "public", p_date: opts.date ?? null,
    });
    fail(error, "Couldn't update your shelf");
    return { userBook: await this.getUserBook(bookId), changed: Boolean(data?.changed), undo: (data?.undo as ShelfUndo) ?? null };
  }
  async importShelfEntry(input: { bookId: string; status: ShelfStatus; rating: number | null; finishedOn: string | null; shelves: string[]; overwrite: boolean }) {
    this.me();
    const { data, error } = await this.sb.rpc("import_shelf_entry", {
      p_book_id: input.bookId, p_status: input.status, p_rating: normaliseRating(input.rating), p_finished_on: input.finishedOn,
      p_shelves: cleanShelves(input.shelves), p_overwrite: input.overwrite,
    });
    fail(error, "Couldn't import that book");
    return data as "imported" | "updated" | "skipped";
  }
  async logBook(input: LogBookInput): Promise<LogBookResult> {
    this.me();
    const { data, error } = await this.sb.rpc("log_book", {
      p_book_id: input.bookId, p_finished_on: input.finishedOn, p_rating: normaliseRating(input.rating), p_reread: input.reread,
      p_notes: input.notes, p_review_title: input.review?.title ?? null, p_review_body: input.review?.body ?? null,
      p_spoilers: input.review?.containsSpoilers ?? false, p_quote_body: input.quote?.body ?? null, p_quote_page: input.quote?.page ?? null,
      p_visibility: input.visibility, p_share: input.share,
    });
    fail(error, "Couldn't log that book");
    return { sessionId: data.session_id, reviewId: data.review_id ?? null, quoteId: data.quote_id ?? null, postId: data.post_id ?? null };
  }
  async undoShelfMove(undo: ShelfUndo) {
    this.me();
    const { error } = await this.sb.rpc("undo_shelf_move", { p_undo: undo });
    fail(error, "Couldn't undo that");
    return typeof undo.book_id === "string" ? this.getUserBook(undo.book_id) : null;
  }
  async setRating(bookId: string, rating: number | null) {
    return this.patchUserBook(bookId, { rating: normaliseRating(rating) });
  }
  async setFavourite(bookId: string, favourite: boolean) {
    return this.patchUserBook(bookId, { is_favourite: favourite, favourited_at: favourite ? new Date().toISOString() : null });
  }
  async setCustomShelves(bookId: string, shelves: string[]) {
    return this.patchUserBook(bookId, { shelves: cleanShelves(shelves) });
  }
  async setProgress(bookId: string, pages: number | null) {
    return this.patchUserBook(bookId, { progress_pages: pages });
  }
  async getShelf(userId: string, query: ShelfQuery) {
    let q = this.sb.from("user_books").select("*, book:books(*)").eq("user_id", userId);
    if (query.status) q = q.eq("status", query.status);
    if (query.favourites) q = q.eq("is_favourite", true);
    if (query.shelf) q = q.contains("shelves", [query.shelf]);
    if (!query.status && !query.favourites && !query.shelf) q = q.not("status", "is", null);
    const { data } = await q.order("updated_at", { ascending: false }).limit(1000);
    return sortShelf((data ?? []).map(mapUserBook), query.sort ?? "recent");
  }
  async getShelfSummary(userId: string): Promise<ShelfSummary> {
    const { data } = await this.sb.from("user_books").select("status, is_favourite, shelves").eq("user_id", userId).limit(10000);
    const rows = data ?? [];
    const custom = new Map<string, number>();
    rows.forEach((r: Row) => (r.shelves ?? []).forEach((s: string) => custom.set(s, (custom.get(s) ?? 0) + 1)));
    const count = (s: ShelfStatus) => rows.filter((r: Row) => r.status === s).length;
    return {
      counts: { want_to_read: count("want_to_read"), reading: count("reading"), read: count("read"), dnf: count("dnf"), favourites: rows.filter((r: Row) => r.is_favourite).length },
      custom: [...custom.entries()].map(([name, n]) => ({ name, count: n })).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }
  async getFavouriteBooks(userId: string, limit = 4) {
    const { data } = await this.sb.from("user_books").select("book:books(*)").eq("user_id", userId).eq("is_favourite", true)
      .order("favourited_at", { ascending: false }).limit(limit);
    return (data ?? []).map((r: Row) => mapBook(r.book));
  }

  // ── diary ───────────────────────────────────────────────────────────
  async listSessions(bookId?: string): Promise<ReadingSession[]> {
    if (!this.viewerId) return [];
    let q = this.sb.from("reading_sessions").select("*, book:books(*)").eq("user_id", this.viewerId);
    if (bookId) q = q.eq("book_id", bookId);
    const { data } = await q.order("finished_on", { ascending: false, nullsFirst: true }).order("started_on", { ascending: false }).limit(500);
    return (data ?? []).map((r: Row) => ({
      id: r.id, userId: r.user_id, bookId: r.book_id, status: r.status, startedOn: r.started_on, finishedOn: r.finished_on,
      isReread: r.is_reread, notes: r.notes, createdAt: r.created_at, book: mapBook(r.book),
    }));
  }
  async addSession(input: SessionInput) {
    const me = this.me();
    if (input.startedOn && input.finishedOn && input.finishedOn < input.startedOn) throw new ValidationError("Finish date can't be before the start date.");
    const { data, error } = await this.sb.from("reading_sessions").insert({
      user_id: me, book_id: input.bookId, status: input.status, started_on: input.startedOn, finished_on: input.finishedOn,
      is_reread: input.isReread, notes: input.notes,
    }).select("*, book:books(*)").single();
    fail(error, "Couldn't log that session");
    const prev = await this.getUserBook(input.bookId);
    const status: ShelfStatus = input.status === "finished" ? "read" : input.status === "reading" ? "reading" : prev?.status === "read" ? "read" : "dnf";
    await this.patchUserBook(input.bookId, {
      status, started_at: input.startedOn ?? prev?.startedAt ?? null,
      finished_at: input.status === "finished" ? input.finishedOn ?? prev?.finishedAt ?? null : prev?.finishedAt ?? null,
    });
    return {
      id: data.id, userId: me, bookId: data.book_id, status: data.status, startedOn: data.started_on, finishedOn: data.finished_on,
      isReread: data.is_reread, notes: data.notes, createdAt: data.created_at, book: mapBook(data.book),
    };
  }
  async deleteSession(id: string) {
    const { error } = await this.sb.from("reading_sessions").delete().eq("id", id).eq("user_id", this.me());
    fail(error);
  }

  // ── reviews ─────────────────────────────────────────────────────────
  async getReview(id: string) {
    const { data } = await this.sb.from("reviews").select(REVIEW_SELECT).eq("id", id).maybeSingle();
    return data ? (await this.hydrateReviews([data]))[0] : null;
  }
  async listReviewsForBook(bookId: string, limit = 20) {
    const { data } = await this.sb.from("reviews").select(REVIEW_SELECT).eq("book_id", bookId).order("created_at", { ascending: false }).limit(limit);
    return this.hydrateReviews(data ?? []);
  }
  async listReviewsByUser(userId: string, limit = 50) {
    const { data } = await this.sb.from("reviews").select(REVIEW_SELECT).eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
    return this.hydrateReviews(data ?? []);
  }
  private reviewRow(input: ReviewInput) {
    return {
      rating: normaliseRating(input.rating), title: input.title, body: input.body, contains_spoilers: input.containsSpoilers,
      is_reread: input.isReread, visibility: input.visibility,
    };
  }
  async createReview(input: ReviewInput) {
    this.me();
    // Review + post (+ Read shelf) in one transaction; the rating lands on the shelf via the database.
    const { data: id, error } = await this.sb.rpc("publish_review", {
      p_book_id: input.bookId, p_body: input.body, p_rating: normaliseRating(input.rating), p_title: input.title,
      p_spoilers: input.containsSpoilers, p_reread: input.isReread, p_visibility: input.visibility,
    });
    fail(error, "Couldn't publish your review");
    const review = await this.getReview(id as string);
    if (!review) throw new Error("Couldn't load your review after publishing it");
    return review;
  }
  async updateReview(id: string, input: ReviewInput) {
    const { data, error } = await this.sb.from("reviews").update(this.reviewRow(input)).eq("id", id).eq("user_id", this.me()).select(REVIEW_SELECT).single();
    if (!data && !error) throw new NotFoundError("Review not found");
    fail(error, "Couldn't save your review");
    return (await this.hydrateReviews([data]))[0];
  }
  async deleteReview(id: string) {
    const { error } = await this.sb.from("reviews").delete().eq("id", id).eq("user_id", this.me());
    fail(error);
  }

  // ── quotes ──────────────────────────────────────────────────────────
  async getQuote(id: string) {
    const { data } = await this.sb.from("quotes").select(QUOTE_SELECT).eq("id", id).maybeSingle();
    return data ? (await this.hydrateQuotes([data]))[0] : null;
  }
  async listQuotesForBook(bookId: string, limit = 20) {
    const { data } = await this.sb.from("quotes").select(QUOTE_SELECT).eq("book_id", bookId).eq("is_draft", false).order("created_at", { ascending: false }).limit(limit);
    return this.hydrateQuotes(data ?? []);
  }
  async listQuotesByUser(userId: string, limit = 60) {
    const { data } = await this.sb.from("quotes").select(QUOTE_SELECT).eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
    return this.hydrateQuotes(data ?? []);
  }
  private quoteRow(input: QuoteInput) {
    return {
      body: input.body, page: input.page, commentary: input.commentary, visibility: input.visibility,
      highlight: input.highlight, tags: input.tags, is_draft: input.isDraft,
    };
  }
  async createQuote(input: QuoteInput) {
    const me = this.me();
    const { data, error } = await this.sb.from("quotes").insert({ user_id: me, book_id: input.bookId, ...this.quoteRow(input) }).select(QUOTE_SELECT).single();
    fail(error, "Couldn't save that annotation");
    // Drafts get their post (and with it a place in feeds) when they're published.
    const post = input.isDraft
      ? null
      : (await this.sb.from("posts").insert({ user_id: me, kind: "quote", book_id: input.bookId, quote_id: data.id, visibility: input.visibility }).select("id").single()).data;
    return this.quote(data, post ?? null);
  }
  async updateQuote(id: string, input: QuoteInput) {
    const me = this.me();
    const { data: before } = await this.sb.from("quotes").select("is_draft, book_id").eq("id", id).eq("user_id", me).maybeSingle();
    if (!before) throw new NotFoundError("Annotation not found");
    if (input.isDraft && !before.is_draft) throw new ValidationError("A published annotation can't become a draft again.");
    const publishing = before.is_draft && !input.isDraft;
    // Publishing re-dates the annotation to now; the database does that (created_at isn't client-writable).
    const { data, error } = await this.sb.from("quotes").update(this.quoteRow(input)).eq("id", id).eq("user_id", me).select(QUOTE_SELECT).single();
    fail(error, "Couldn't save that annotation");
    if (publishing) {
      const { error: postError } = await this.sb.from("posts").insert({ user_id: me, kind: "quote", book_id: before.book_id, quote_id: id, visibility: input.visibility });
      fail(postError, "Couldn't publish that annotation");
    }
    return (await this.hydrateQuotes([data]))[0];
  }
  async listMarginalia(query: MarginaliaQuery, cursor: string | null, limit = 18) {
    // Inner joins so filters on the annotation (tags, drafts) and the book (genre) narrow the posts themselves.
    const select = `*, ${author("posts")}, book:books${query.genre ? "!inner" : ""}(*), quote:quotes!inner(${QUOTE_SELECT})`;
    // Feeds come from database functions (they join follows / mutes there), so no id lists travel in the URL.
    if (query.tab === "following") this.me();
    let q = this.sb.rpc(query.tab === "following" ? "following_posts" : "public_posts").select(select)
      .eq("kind", "quote").is("repost_of_id", null).eq("quote.is_draft", false);
    if (query.bookId) q = q.eq("book_id", query.bookId);
    if (query.tag) q = q.contains("quote.tags", [query.tag]);
    if (query.genre) q = q.contains("book.genres", [query.genre]);
    if (query.tab !== "popular") return this.pagePosts(q, cursor, limit);
    const offset = cursor?.startsWith("o:") ? Number(cursor.slice(2)) || 0 : 0;
    const { data, error } = await q.order("likes_count", { ascending: false }).order("created_at", { ascending: false }).range(offset, offset + limit);
    fail(error);
    const rows: Row[] = data ?? [];
    return { items: await this.hydratePosts(rows.slice(0, limit)), nextCursor: rows.length > limit ? `o:${offset + limit}` : null };
  }
  async marginaliaTags(limit = 24) {
    // Counted from recent public annotations; enough for filters and suggestions without a tags table.
    const { data } = await this.sb.from("quotes").select("tags").eq("is_draft", false).eq("visibility", "public").neq("tags", "{}").order("created_at", { ascending: false }).limit(500);
    const counts = new Map<string, number>();
    for (const r of (data ?? []) as Row[]) for (const t of (r.tags ?? []) as string[]) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([tag, count]) => ({ tag, count }));
  }
  async deleteQuote(id: string) {
    const { error } = await this.sb.from("quotes").delete().eq("id", id).eq("user_id", this.me());
    fail(error);
  }

  // ── lists ───────────────────────────────────────────────────────────
  async getList(id: string): Promise<ReadingListDetail | null> {
    const { data } = await this.sb.from("lists").select(LIST_SELECT).eq("id", id).maybeSingle();
    if (!data) return null;
    const [[summary], { data: books }] = await Promise.all([
      this.hydrateLists([data]),
      this.sb.from("list_books").select("*, book:books(*)").eq("list_id", id).order("position"),
    ]);
    return {
      ...summary,
      books: (books ?? []).map((b: Row) => ({ bookId: b.book_id, position: b.position, note: b.note, imageUrl: b.image_url, book: mapBook(b.book) })),
    };
  }
  async listListsByUser(userId: string) {
    const { data } = await this.sb.from("lists").select(LIST_SELECT).eq("user_id", userId).order("updated_at", { ascending: false }).limit(100);
    return this.hydrateLists(data ?? []);
  }
  async listListsForBook(bookId: string, limit = 8) {
    const { data: ids } = await this.sb.from("list_books").select("list_id").eq("book_id", bookId).limit(200);
    const listIds = (ids ?? []).map((r: Row) => r.list_id);
    if (!listIds.length) return [];
    const { data } = await this.sb.from("lists").select(LIST_SELECT).in("id", listIds).order("followers_count", { ascending: false }).limit(limit);
    return this.hydrateLists(data ?? []);
  }
  async popularLists(limit = 8) {
    const { data: rows } = await this.sb.rpc("popular_lists", { p_limit: limit });
    const ids = (rows ?? []).map((r: Row) => r.id);
    if (!ids.length) return [];
    const { data } = await this.sb.from("lists").select(LIST_SELECT).in("id", ids);
    const order = new Map(ids.map((id: string, i: number) => [id, i]));
    return this.hydrateLists((data ?? []).sort((a: Row, b: Row) => (order.get(a.id) as number) - (order.get(b.id) as number)));
  }
  async searchLists(q: string, sort: ListSort, limit = 24) {
    let query = this.sb.from("lists").select(LIST_SELECT).eq("visibility", "public");
    const s = safeLike(q);
    if (s) query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%`);
    query = sort === "recent" ? query.order("updated_at", { ascending: false }) : query.order("followers_count", { ascending: false }).order("updated_at", { ascending: false });
    const { data, error } = await query.limit(sort === "books" ? 100 : limit * 2);
    fail(error, "Couldn't search lists");
    const lists = (await this.hydrateLists(data ?? [])).filter((l) => l.bookCount > 0);
    if (sort === "books") lists.sort((a, b) => b.bookCount - a.bookCount);
    return lists.slice(0, limit);
  }
  async followedLists() {
    if (!this.viewerId) return [];
    const { data } = await this.sb.from("list_follows").select(`list:lists(${LIST_SELECT})`).eq("user_id", this.viewerId).order("created_at", { ascending: false }).limit(100);
    return this.hydrateLists((data ?? []).map((r: Row) => r.list).filter(Boolean));
  }
  private listRow(input: ListInput) {
    return {
      title: input.title, description: input.description, cover_style: input.coverStyle, cover_image_url: input.coverImageUrl,
      visibility: input.visibility, is_ranked: input.isRanked,
    };
  }
  async createList(input: ListInput) {
    const me = this.me();
    const { data, error } = await this.sb.from("lists").insert({ user_id: me, ...this.listRow(input) }).select(LIST_SELECT).single();
    fail(error, "Couldn't create that list");
    const { error: postError } = await this.sb.from("posts").insert({ user_id: me, kind: "list", list_id: data.id, visibility: input.visibility });
    if (postError) {
      await this.sb.from("lists").delete().eq("id", data.id);
      fail(postError, "Couldn't create that list");
    }
    return (await this.hydrateLists([data]))[0];
  }
  async updateList(id: string, input: ListInput) {
    const { data, error } = await this.sb.from("lists").update(this.listRow(input)).eq("id", id).eq("user_id", this.me()).select(LIST_SELECT).single();
    fail(error, "Couldn't save that list");
    return (await this.hydrateLists([data]))[0];
  }
  async deleteList(id: string) {
    const { error } = await this.sb.from("lists").delete().eq("id", id).eq("user_id", this.me());
    fail(error);
  }
  async addBookToList(listId: string, bookId: string, note: string | null) {
    this.me();
    const { data: last } = await this.sb.from("list_books").select("position").eq("list_id", listId).order("position", { ascending: false }).limit(1).maybeSingle();
    const { error } = await this.sb.from("list_books").upsert(
      { list_id: listId, book_id: bookId, position: (last?.position ?? -1) + 1, note },
      { onConflict: "list_id,book_id", ignoreDuplicates: true },
    );
    fail(error, "Couldn't add that book");
  }
  async updateListBook(listId: string, bookId: string, note: string | null, imageUrl: string | null) {
    const { error } = await this.sb.from("list_books").update({ note, image_url: imageUrl }).eq("list_id", listId).eq("book_id", bookId);
    fail(error);
  }
  async removeBookFromList(listId: string, bookId: string) {
    const { error } = await this.sb.from("list_books").delete().eq("list_id", listId).eq("book_id", bookId);
    fail(error);
  }
  async reorderList(listId: string, bookIds: string[]) {
    this.me();
    const { error } = await this.sb.rpc("reorder_list", { p_list_id: listId, p_book_ids: bookIds });
    fail(error, "Couldn't reorder that list");
  }
  async followList(listId: string) {
    const { error } = await this.sb.from("list_follows").upsert({ user_id: this.me(), list_id: listId }, { onConflict: "user_id,list_id", ignoreDuplicates: true });
    fail(error);
  }
  async unfollowList(listId: string) {
    const { error } = await this.sb.from("list_follows").delete().eq("user_id", this.me()).eq("list_id", listId);
    fail(error);
  }

  // ── posts & feed ────────────────────────────────────────────────────
  async getFeed(tab: "following" | "discover", cursor: string | null, limit = 12, filter: FeedFilter = "all") {
    if (tab === "following") this.me();
    let q = this.sb.rpc(tab === "following" ? "following_posts" : "discover_posts").select(POST_SELECT);
    if (filter !== "all") q = q.in("kind", FEED_KINDS[filter]);
    return this.pagePosts(q, cursor, limit);
  }
  async getUserPosts(userId: string, cursor: string | null, limit = 12) {
    return this.pagePosts(this.sb.from("posts").select(POST_SELECT).eq("user_id", userId), cursor, limit);
  }
  async getBookPosts(bookId: string, limit = 12) {
    return (await this.pagePosts(this.sb.from("posts").select(POST_SELECT).eq("book_id", bookId).neq("kind", "review"), null, limit)).items;
  }
  async getPost(id: string) {
    const { data } = await this.sb.from("posts").select(POST_SELECT).eq("id", id).maybeSingle();
    if (!data) return null;
    return (await this.hydratePosts([data]))[0] ?? null;
  }
  async createPost(input: UpdatePostInput) {
    const me = this.me();
    if (!input.body.trim()) throw new ValidationError("Say something first.");
    const { data, error } = await this.sb.from("posts").insert({
      user_id: me, kind: input.kind, book_id: input.bookId, body: input.body.trim(), progress_pages: input.progressPages,
      progress_percent: input.progressPercent, visibility: input.visibility,
    }).select(POST_SELECT).single();
    fail(error, "Couldn't post that");
    if (input.bookId && input.progressPages != null) {
      const prev = await this.getUserBook(input.bookId);
      await this.patchUserBook(input.bookId, { progress_pages: input.progressPages, status: prev?.status ?? "reading" });
    }
    return (await this.hydratePosts([data]))[0];
  }
  async deletePost(id: string) {
    const me = this.me();
    const { data } = await this.sb.from("posts").select("review_id, quote_id, list_id").eq("id", id).eq("user_id", me).maybeSingle();
    if (!data) return;
    if (data.review_id) return this.deleteReview(data.review_id);
    if (data.quote_id) return this.deleteQuote(data.quote_id);
    if (data.list_id) return this.deleteList(data.list_id);
    const { error } = await this.sb.from("posts").delete().eq("id", id).eq("user_id", me);
    fail(error);
  }
  async like(postId: string) {
    const { error } = await this.sb.from("likes").upsert({ user_id: this.me(), post_id: postId }, { onConflict: "user_id,post_id", ignoreDuplicates: true });
    fail(error);
  }
  async unlike(postId: string) {
    const { error } = await this.sb.from("likes").delete().eq("user_id", this.me()).eq("post_id", postId);
    fail(error);
  }
  async bookmark(postId: string) {
    const { error } = await this.sb.from("bookmarks").upsert({ user_id: this.me(), post_id: postId }, { onConflict: "user_id,post_id", ignoreDuplicates: true });
    fail(error);
  }
  async unbookmark(postId: string) {
    const { error } = await this.sb.from("bookmarks").delete().eq("user_id", this.me()).eq("post_id", postId);
    fail(error);
  }
  async repost(postId: string) {
    const me = this.me();
    const { data: p } = await this.sb.from("posts").select("id, user_id, repost_of_id, visibility").eq("id", postId).maybeSingle();
    if (!p) throw new NotFoundError("Post not found");
    const targetId = p.repost_of_id ?? p.id;
    const { data: target } = await this.sb.from("posts").select("user_id, visibility").eq("id", targetId).maybeSingle();
    if (!target || target.visibility !== "public") throw new ValidationError("Only public posts can be reposted.");
    if (target.user_id === me) throw new ValidationError("You can't repost your own post.");
    const { error } = await this.sb.from("posts").insert({ user_id: me, kind: "repost", repost_of_id: targetId });
    if (error?.code === "23505") return;
    fail(error);
  }
  async unrepost(postId: string) {
    const { error } = await this.sb.from("posts").delete().eq("user_id", this.me()).eq("repost_of_id", postId);
    fail(error);
  }
  async listBookmarks(cursor: string | null, limit = 12, kind?: Post["kind"]): Promise<Page<Post>> {
    const me = this.me();
    let q = this.sb.from("bookmarks").select(`created_at, post_id, post:posts${kind ? "!inner" : ""}(${POST_SELECT})`).eq("user_id", me);
    if (kind) q = q.eq("post.kind", kind);
    if (cursor) {
      const [createdAt, id] = cursor.split("|");
      q = q.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},post_id.lt.${id})`);
    }
    const { data } = await q.order("created_at", { ascending: false }).order("post_id", { ascending: false }).limit(limit + 1);
    const rows = (data ?? []) as Row[];
    const slice = rows.slice(0, limit);
    const items = await this.hydratePosts(slice.map((r) => r.post).filter(Boolean));
    const last = slice[slice.length - 1];
    return { items, nextCursor: rows.length > limit && last ? `${last.created_at}|${last.post_id}` : null };
  }

  // ── comments ────────────────────────────────────────────────────────
  async listComments(postId: string): Promise<Comment[]> {
    const { data } = await this.sb.from("comments").select(`*, ${author("comments")}`).eq("post_id", postId).order("created_at").limit(500);
    const rows = (data ?? []).map((r: Row): Comment => ({
      id: r.id, postId: r.post_id, userId: r.user_id, parentId: r.parent_id, body: r.body, createdAt: r.created_at,
      editedAt: editedAt(r), author: mapProfile(r.author), replies: [],
    }));
    const top = rows.filter((c: Comment) => !c.parentId);
    const byId = new Map<string, Comment>(top.map((c: Comment) => [c.id, c]));
    rows.filter((c: Comment) => c.parentId).forEach((c: Comment) => byId.get(c.parentId!)?.replies.push(c));
    return top;
  }
  async addComment(postId: string, body: string, parentId: string | null) {
    const me = this.me();
    const text = body.trim();
    if (!text) throw new ValidationError("Comment can't be empty.");
    let parent: string | null = parentId;
    if (parentId) {
      const { data: p } = await this.sb.from("comments").select("id, parent_id").eq("id", parentId).eq("post_id", postId).maybeSingle();
      parent = p ? p.parent_id ?? p.id : null;
    }
    const { data, error } = await this.sb.from("comments").insert({ post_id: postId, user_id: me, parent_id: parent, body: text }).select(`*, ${author("comments")}`).single();
    fail(error, "Couldn't post your comment");
    return { id: data.id, postId, userId: me, parentId: data.parent_id, body: data.body, createdAt: data.created_at, editedAt: null, author: mapProfile(data.author), replies: [] };
  }
  async updateComment(id: string, body: string) {
    const text = body.trim();
    if (!text) throw new ValidationError("Comment can't be empty.");
    const { data, error } = await this.sb.from("comments").update({ body: text }).eq("id", id).eq("user_id", this.me()).select(`*, ${author("comments")}`).maybeSingle();
    fail(error, "Couldn't save your comment");
    if (!data) throw new NotFoundError("Comment not found");
    return { id: data.id, postId: data.post_id, userId: data.user_id, parentId: data.parent_id, body: data.body, createdAt: data.created_at, editedAt: editedAt(data), author: mapProfile(data.author), replies: [] };
  }
  async deleteComment(id: string) {
    this.me();
    const { error } = await this.sb.from("comments").delete().eq("id", id);
    fail(error);
  }

  // ── notifications & passes ──────────────────────────────────────────
  async listNotifications(limit = 50): Promise<Notification[]> {
    const me = this.me();
    const { data } = await this.sb.from("notifications").select(
      `*, actor:profiles!notifications_actor_id_fkey(*),
       post:posts(id, kind, book:books(title), review:reviews(book:books(title)), quote:quotes(body), list:lists(title)),
       list:lists(title), comment:comments(body),
       recommendation:recommendations(*, sender:profiles!recommendations_sender_id_fkey(*), recipient:profiles!recommendations_recipient_id_fkey(*), book:books(*))`,
    ).eq("recipient_id", me).order("created_at", { ascending: false }).limit(limit);
    return (data ?? []).map((n: Row) => ({
      id: n.id, kind: n.kind, actor: mapProfile(n.actor), postId: n.post_id, postExcerpt: n.post ? postExcerpt(n.post) : null,
      listId: n.list_id, listTitle: n.list?.title ?? null, commentBody: n.comment?.body ?? null,
      recommendation: n.recommendation ? mapRecommendation(n.recommendation) : null, readAt: n.read_at, createdAt: n.created_at,
    }));
  }
  async unreadNotificationCount() {
    if (!this.viewerId) return 0;
    const { count } = await this.sb.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_id", this.viewerId).is("read_at", null);
    return count ?? 0;
  }
  async markNotificationsRead() {
    const me = this.me();
    const t = new Date().toISOString();
    await Promise.all([
      this.sb.from("notifications").update({ read_at: t }).eq("recipient_id", me).is("read_at", null),
      this.sb.from("recommendations").update({ seen_at: t }).eq("recipient_id", me).is("seen_at", null),
    ]);
  }
  async sendRecommendation(recipientId: string, bookId: string, message: string | null, parentId: string | null) {
    const me = this.me();
    if (recipientId === me) throw new ValidationError("You can't pass a book to yourself.");
    const { data, error } = await this.sb.from("recommendations").insert({
      sender_id: me, recipient_id: recipientId, book_id: bookId, message: message?.trim() || null, parent_id: parentId,
    }).select("*, sender:profiles!recommendations_sender_id_fkey(*), recipient:profiles!recommendations_recipient_id_fkey(*), book:books(*)").single();
    fail(error, "Couldn't pass that book");
    return mapRecommendation(data);
  }
  async listRecommendationsReceived(limit = 30) {
    const { data } = await this.sb.from("recommendations")
      .select("*, sender:profiles!recommendations_sender_id_fkey(*), recipient:profiles!recommendations_recipient_id_fkey(*), book:books(*)")
      .eq("recipient_id", this.me()).order("created_at", { ascending: false }).limit(limit);
    return (data ?? []).map(mapRecommendation);
  }

  // ── discovery & invites ─────────────────────────────────────────────
  async similarReaders(limit = 8): Promise<SimilarReader[]> {
    if (!this.viewerId) return [];
    const { data, error } = await this.sb.rpc("similar_readers", { p_limit: limit });
    fail(error, "Couldn't find similar readers");
    return ((data ?? []) as Row[]).map((r) => ({
      profile: mapProfile(r.profile), score: r.score, sharedBooks: r.shared_books, sharedFavourites: r.shared_favourites,
      sharedAuthors: r.shared_authors ?? [], sharedGenres: r.shared_genres ?? [], agreement: r.agreement == null ? null : Number(r.agreement),
    }));
  }
  async createInvite(opts: { expiresInDays: number | null; maxUses: number | null }): Promise<Invite> {
    const me = this.me();
    const { randomBytes } = await import("node:crypto");
    const code = randomBytes(12).toString("base64url");
    const expires = opts.expiresInDays ? new Date(Date.now() + opts.expiresInDays * 86_400_000).toISOString() : null;
    const { data, error } = await this.sb.from("invites").insert({ code, inviter_id: me, expires_at: expires, max_uses: opts.maxUses }).select("*").single();
    fail(error, "Couldn't create an invite link");
    return mapInvite(data);
  }
  async listInvites() {
    const { data, error } = await this.sb.from("invites").select("*").eq("inviter_id", this.me()).order("created_at", { ascending: false });
    fail(error);
    return ((data ?? []) as Row[]).map(mapInvite);
  }
  async deleteInvite(code: string) {
    const { error } = await this.sb.from("invites").delete().eq("code", code).eq("inviter_id", this.me());
    fail(error);
  }
  async invitePreview(code: string): Promise<InvitePreview | null> {
    const { data, error } = await this.sb.rpc("invite_preview", { p_code: code });
    fail(error);
    if (!data) return null;
    const i = data.inviter as Row;
    return { valid: Boolean(data.valid), inviter: { username: i.username, displayName: i.display_name ?? "", avatarUrl: i.avatar_url, favouriteGenres: i.favourite_genres ?? [] } };
  }
  async redeemInvite(code: string) {
    this.me();
    const { data, error } = await this.sb.rpc("redeem_invite", { p_code: code });
    fail(error);
    return Boolean(data);
  }
  async readingRecap(userId: string, year: number, month: number | null): Promise<ReadingRecap> {
    const { data, error } = await this.sb.rpc("reading_recap", { p_user: userId, p_year: year, p_month: month });
    fail(error, "Couldn't load that recap");
    return mapRecap(data as Row);
  }

  // ── personalised suggestions ────────────────────────────────────────
  async tasteLibrary(): Promise<TasteEntry[]> {
    if (!this.viewerId) return [];
    const { data, error } = await this.sb.from("user_books")
      .select("status, rating, is_favourite, book:books(id, title, authors, genres, moods, subjects, ol_work_id, isbn13)")
      .eq("user_id", this.viewerId).not("status", "is", null).limit(2000);
    fail(error, "Couldn't read your shelves");
    return ((data ?? []) as Row[]).filter((r) => r.book).map((r) => ({
      bookId: r.book.id, title: r.book.title, authors: r.book.authors ?? [], genres: r.book.genres ?? [], moods: r.book.moods ?? [],
      subjects: r.book.subjects ?? [], status: r.status, rating: num(r.rating), favourite: r.is_favourite, olWorkId: r.book.ol_work_id, isbn13: r.book.isbn13,
    }));
  }
  async suggestionState(): Promise<SuggestionState | null> {
    if (!this.viewerId) return null;
    const { data, error } = await this.sb.from("suggestion_runs").select("signature, refreshed_at, attempted_at").eq("user_id", this.viewerId).maybeSingle();
    fail(error, "Couldn't read your suggestions");
    return data ? { signature: data.signature, refreshedAt: data.refreshed_at, attemptedAt: data.attempted_at } : null;
  }
  async saveSuggestions(signature: string | null, items: SuggestionInput[] | null) {
    this.me();
    const { error } = await this.sb.rpc("save_suggestions", { p_signature: signature, p_items: items == null ? null : checkSuggestionInputs(items) });
    fail(error, "Couldn't save your suggestions");
  }
  private suggestion(r: Row): Suggestion {
    return toSuggestion({
      id: r.id, workKey: r.work_key, bookId: r.book_id, book: r.book, score: num(r.score) ?? 0, reasons: r.reasons, sourceBookIds: r.source_book_ids ?? [],
      status: r.status, createdAt: r.created_at,
    });
  }
  async listSuggestions(cursor: string | null, limit = 12) {
    if (!this.viewerId) return { items: [], nextCursor: null };
    const offset = Math.max(0, Number(cursor) || 0);
    const { data, error } = await this.sb.from("book_suggestions").select("*").eq("user_id", this.viewerId).eq("status", "suggested")
      .order("score", { ascending: false }).order("id").range(offset, offset + limit);
    fail(error, "Couldn't load your suggestions");
    const rows = (data ?? []) as Row[];
    return { items: rows.slice(0, limit).map((r) => this.suggestion(r)), nextCursor: rows.length > limit ? String(offset + limit) : null };
  }
  async getSuggestion(id: string) {
    if (!this.viewerId) return null;
    const { data, error } = await this.sb.from("book_suggestions").select("*").eq("id", id).eq("user_id", this.viewerId).maybeSingle();
    fail(error);
    return data ? this.suggestion(data) : null;
  }
  async setSuggestionStatus(id: string, status: SuggestionStatus) {
    const { data, error } = await this.sb.from("book_suggestions").update({ status }).eq("id", id).eq("user_id", this.me()).select("id");
    fail(error, "Couldn't update that suggestion");
    if (!data?.length) throw new NotFoundError("That suggestion is gone.");
  }
  async closedSuggestionKeys() {
    if (!this.viewerId) return [];
    const { data, error } = await this.sb.from("book_suggestions").select("work_key, book_id, ol_work_id")
      .eq("user_id", this.viewerId).neq("status", "suggested").limit(5000);
    fail(error);
    return closedKeys(((data ?? []) as Row[]).map((r) => ({ workKey: r.work_key, bookId: r.book_id, olWorkId: r.ol_work_id })));
  }
  async coShelvedBooks(limit = 30): Promise<CoShelvedBook[]> {
    if (!this.viewerId) return [];
    const { data, error } = await this.sb.rpc("co_shelved_books", { p_limit: limit });
    fail(error, "Couldn't look up readers with shelves like yours");
    return ((data ?? []) as Row[]).map((r) => ({ book: mapBook(r.book), subjects: r.book.subjects ?? [], readers: r.readers, viaBookIds: r.via ?? [] }));
  }
  async setBookSubjects(bookId: string, subjects: string[]) {
    this.me();
    // Catalogue write: server-only, from headings the server fetched from Open Library itself. Only fills a gap.
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const clean = subjects.filter((x) => typeof x === "string" && x.length <= 48).slice(0, 30);
    const { error } = await supabaseAdmin().from("books").update({ subjects: clean }).eq("id", bookId).eq("subjects", "{}");
    fail(error, "Couldn't store subject headings");
  }

  // ── safety & your data ──────────────────────────────────────────────
  async relationship(targetId: string): Promise<Relationship> {
    if (!this.viewerId || targetId === this.viewerId) return { following: false, blocked: false, muted: false };
    const me = this.viewerId;
    const [f, b, m] = await Promise.all([
      this.sb.from("follows").select("follower_id").eq("follower_id", me).eq("following_id", targetId).maybeSingle(),
      this.sb.from("blocks").select("blocker_id").eq("blocker_id", me).eq("blocked_id", targetId).maybeSingle(),
      this.sb.from("mutes").select("muter_id").eq("muter_id", me).eq("muted_id", targetId).maybeSingle(),
    ]);
    return { following: Boolean(f.data), blocked: Boolean(b.data), muted: Boolean(m.data) };
  }
  async block(targetId: string) {
    const me = this.me();
    if (me === targetId) throw new ValidationError("You can't block yourself.");
    const { error } = await this.sb.from("blocks").upsert({ blocker_id: me, blocked_id: targetId }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
    fail(error, "Couldn't block");
  }
  async unblock(targetId: string) {
    const { error } = await this.sb.from("blocks").delete().eq("blocker_id", this.me()).eq("blocked_id", targetId);
    fail(error);
  }
  async mute(targetId: string) {
    const me = this.me();
    if (me === targetId) throw new ValidationError("You can't mute yourself.");
    const { error } = await this.sb.from("mutes").upsert({ muter_id: me, muted_id: targetId }, { onConflict: "muter_id,muted_id", ignoreDuplicates: true });
    fail(error, "Couldn't mute");
  }
  async unmute(targetId: string) {
    const { error } = await this.sb.from("mutes").delete().eq("muter_id", this.me()).eq("muted_id", targetId);
    fail(error);
  }
  async listBlocked() {
    const { data } = await this.sb.from("blocks").select("p:profiles!blocks_blocked_id_fkey(*)").eq("blocker_id", this.me()).order("created_at", { ascending: false });
    return (data ?? []).map((r: Row) => mapProfile(r.p));
  }
  async listMuted() {
    const { data } = await this.sb.from("mutes").select("p:profiles!mutes_muted_id_fkey(*)").eq("muter_id", this.me()).order("created_at", { ascending: false });
    return (data ?? []).map((r: Row) => mapProfile(r.p));
  }
  async report(input: ReportInput) {
    const { error } = await this.sb.from("reports").insert({
      reporter_id: this.me(), target_type: input.targetType, target_id: input.targetId, reason: input.reason, details: input.details,
    });
    if (error?.code === "23505") return; // already reported: nothing more to do
    fail(error, "Couldn't send that report");
  }
  async exportMyData() {
    const me = this.me();
    const all = (q: any) => q.then(({ data, error }: { data: Row[] | null; error: { message: string } | null }) => {
      fail(error, "Couldn't export your data");
      return data ?? [];
    });
    const [profile, shelves, diary, reviews, annotations, lists, listBooks, posts, comments, likes, bookmarks, following, followers, passesSent, passesReceived, blocks, mutes, reports, suggestions] = await Promise.all([
      all(this.sb.from("profiles").select("*").eq("id", me)),
      all(this.sb.from("user_books").select("*, book:books(title, authors, isbn13, ol_work_id)").eq("user_id", me)),
      all(this.sb.from("reading_sessions").select("*, book:books(title, authors)").eq("user_id", me)),
      all(this.sb.from("reviews").select("*, book:books(title, authors)").eq("user_id", me)),
      all(this.sb.from("quotes").select("*, book:books(title, authors)").eq("user_id", me)),
      all(this.sb.from("lists").select("*").eq("user_id", me)),
      all(this.sb.from("list_books").select("*, list:lists!inner(user_id), book:books(title, authors)").eq("list.user_id", me)),
      all(this.sb.from("posts").select("*").eq("user_id", me)),
      all(this.sb.from("comments").select("*").eq("user_id", me)),
      all(this.sb.from("likes").select("*").eq("user_id", me)),
      all(this.sb.from("bookmarks").select("*").eq("user_id", me)),
      all(this.sb.from("follows").select("following_id, created_at").eq("follower_id", me)),
      all(this.sb.from("follows").select("follower_id, created_at").eq("following_id", me)),
      all(this.sb.from("recommendations").select("*").eq("sender_id", me)),
      all(this.sb.from("recommendations").select("*").eq("recipient_id", me)),
      all(this.sb.from("blocks").select("*").eq("blocker_id", me)),
      all(this.sb.from("mutes").select("*").eq("muter_id", me)),
      all(this.sb.from("reports").select("*").eq("reporter_id", me)),
      all(this.sb.from("book_suggestions").select("work_key, book, status, reasons, created_at").eq("user_id", me)),
    ]);
    return {
      exportedAt: new Date().toISOString(), profile: profile[0] ?? null, shelves, diary, reviews, annotations, lists, listBooks, posts,
      comments, likes, bookmarks, following, followers, passesSent, passesReceived, blocks, mutes, reports, suggestions,
    };
  }
  async deleteMyAccount() {
    const me = this.me();
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const admin = supabaseAdmin();
    // Uploads first (they aren't tied to the database rows), then the auth user: every table
    // references profiles(id) → auth.users(id) with ON DELETE CASCADE, so the rest follows.
    for (;;) {
      const { data: files, error } = await admin.storage.from("media").list(me, { limit: 100 });
      if (error) throw new Error(`Couldn't remove your uploads (${error.message})`);
      if (!files?.length) break;
      const { error: rmError } = await admin.storage.from("media").remove(files.map((f) => `${me}/${f.name}`));
      if (rmError) throw new Error(`Couldn't remove your uploads (${rmError.message})`);
      if (files.length < 100) break;
    }
    const { error } = await admin.auth.admin.deleteUser(me);
    if (error) throw new Error(`Couldn't delete your account (${error.message})`);
  }

  // ── stats ───────────────────────────────────────────────────────────
  async getProfileStats(userId: string, year: number): Promise<ProfileStats> {
    // Aggregated in the database (and limited by RLS: your diary for you, public shelves for others).
    const { data, error } = await this.sb.rpc("reading_stats", { p_user: userId, p_year: year });
    fail(error, "Couldn't load reading stats");
    const d = data as Row;
    return {
      year, booksRead: d.books_read_all_time, booksReadThisYear: d.completions, distinctBooksThisYear: d.distinct_books,
      rereadsThisYear: d.rereads, sessionsThisYear: d.sessions, pagesReadThisYear: Number(d.pages), booksWithPagesThisYear: d.books_with_pages,
      currentlyReading: d.currently_reading, averageRating: d.average_rating == null ? null : Number(d.average_rating),
      reviewsCount: d.reviews, quotesCount: d.quotes, listsCount: d.lists, ratingDistribution: d.rating_distribution, byMonth: d.by_month,
      topGenres: d.top_genres, topAuthors: d.top_authors,
    };
  }
  async compatibility(otherId: string): Promise<Compatibility | null> {
    if (!this.viewerId || otherId === this.viewerId) return null;
    const { data } = await this.sb.rpc("reading_compatibility", { p_other: otherId });
    const row = Array.isArray(data) ? data[0] : data;
    return row ? { score: row.score, sharedBooks: row.shared_books, sharedGenres: row.shared_genres ?? [] } : null;
  }
}

function mapRecommendation(r: Row): Recommendation {
  return {
    id: r.id, sender: mapProfile(r.sender), recipient: mapProfile(r.recipient), book: mapBook(r.book), message: r.message,
    parentId: r.parent_id, seenAt: r.seen_at, createdAt: r.created_at,
  };
}

/** Post kinds behind each feed filter. */
export const FEED_KINDS: Record<Exclude<FeedFilter, "all">, Post["kind"][]> = {
  reviews: ["review"],
  annotations: ["quote"],
  reading: ["started", "finished", "update"],
  lists: ["list"],
};

function mapInvite(r: Row): Invite {
  const closed = (r.expires_at != null && Date.parse(r.expires_at) <= Date.now()) || (r.max_uses != null && r.uses >= r.max_uses);
  return { code: r.code, createdAt: r.created_at, expiresAt: r.expires_at, maxUses: r.max_uses, uses: r.uses, closed };
}

const recapBook = (b: Row | null) =>
  b ? { id: b.id ?? b.book_id, slug: b.slug, title: b.title, authors: b.authors ?? [], coverUrl: b.cover_url ?? null } : null;

export function mapRecap(d: Row): ReadingRecap {
  return {
    year: d.year, month: d.month ?? null, completions: d.completions, distinctBooks: d.distinct_books, rereads: d.rereads,
    pages: Number(d.pages), booksWithPages: d.books_with_pages, averageRating: d.average_rating == null ? null : Number(d.average_rating),
    byMonth: d.by_month ?? new Array(12).fill(0),
    favouriteBook: d.favourite_book ? { ...recapBook(d.favourite_book)!, rating: Number(d.favourite_book.rating) } : null,
    topAuthor: d.top_author ? { name: d.top_author.name, count: Number(d.top_author.count) } : null,
    topGenre: d.top_genre ? { name: d.top_genre.name, count: Number(d.top_genre.count) } : null,
    busiestMonth: d.busiest_month ? { month: Number(d.busiest_month.month), count: Number(d.busiest_month.count) } : null,
    mostHighlighted: d.most_highlighted ? { ...recapBook(d.most_highlighted)!, count: Number(d.most_highlighted.count) } : null,
    lovedLine: d.loved_line ? { quoteId: d.loved_line.quote_id, body: d.loved_line.body, title: d.loved_line.title, likes: Number(d.loved_line.likes) } : null,
    annotations: Number(d.annotations ?? 0),
    timeline: ((d.timeline ?? []) as Row[]).map((t) => ({ ...recapBook(t)!, day: t.day, rating: t.rating == null ? null : Number(t.rating), reread: Boolean(t.reread) })),
  };
}

/** A comment counts as edited when it changed more than a moment after it was posted. */
function editedAt(r: Row): string | null {
  return r.updated_at && Date.parse(r.updated_at) - Date.parse(r.created_at) > 1000 ? r.updated_at : null;
}

function postExcerpt(p: Row): string {
  if (p.review) return `your review of ${p.review.book?.title ?? "a book"}`;
  if (p.quote) return `“${String(p.quote.body).slice(0, 60)}${p.quote.body.length > 60 ? "…" : ""}”`;
  if (p.list) return `your list “${p.list.title}”`;
  if (p.book) return `your post about ${p.book.title}`;
  return "your post";
}
