// Domain types shared by both data backends (Supabase + demo) and the UI.
// Everything here is plain, serialisable data so it can cross the server/client boundary.

export type Visibility = "public" | "followers" | "private";
export type ShelfStatus = "want_to_read" | "reading" | "read" | "dnf";
export type SessionStatus = "reading" | "finished" | "abandoned";
export type Accent = "burgundy" | "sage" | "rose" | "butter" | "ink";
export type ProfileMotif = "dogear" | "stars" | "botanical" | "stripes" | "none";
export type ListCoverStyle = "rose" | "sage" | "butter" | "burgundy" | "ink" | "collage";
export type PostKind =
  | "review"
  | "update"
  | "started"
  | "finished"
  | "quote"
  | "list"
  | "recommendation"
  | "repost";
export type NotificationKind =
  | "follow"
  | "like"
  | "comment"
  | "reply"
  | "repost"
  | "recommendation"
  | "list_follow";

export interface Profile {
  id: string;
  username: string | null;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  pronouns: string | null;
  location: string | null;
  website: string | null;
  accent: Accent;
  motif: ProfileMotif;
  favouriteGenres: string[];
  favouriteAuthors: string[];
  readingGoal: number | null;
  onboarded: boolean;
  followersCount: number;
  followingCount: number;
  createdAt: string;
}

export type ProfilePatch = Partial<
  Pick<
    Profile,
    | "username"
    | "displayName"
    | "bio"
    | "avatarUrl"
    | "coverUrl"
    | "pronouns"
    | "location"
    | "website"
    | "accent"
    | "motif"
    | "favouriteGenres"
    | "favouriteAuthors"
    | "readingGoal"
    | "onboarded"
  >
>;

export interface Book {
  /** Database id. `null` for an Open Library result not yet in our catalogue. */
  id: string | null;
  slug: string | null;
  title: string;
  subtitle: string | null;
  authors: string[];
  description: string | null;
  coverUrl: string | null;
  isbn13: string | null;
  isbn10: string | null;
  olWorkId: string | null;
  olEditionId: string | null;
  publishedYear: number | null;
  publisher: string | null;
  pageCount: number | null;
  language: string | null;
  genres: string[];
  moods: string[];
  /** Cleaned Open Library subject headings (themes, settings, forms), when known. Used for suggestions. */
  subjects?: string[];
}

/** A book that definitely exists in our catalogue. */
export type SavedBook = Book & { id: string; slug: string };

export type BookInput = Omit<Book, "id" | "slug">;

export interface BookStats {
  avgRating: number | null;
  ratingsCount: number;
  readersCount: number;
  readingCount: number;
  wantCount: number;
  /** Ten buckets: 0.5, 1.0 … 5.0 */
  histogram: number[];
}

export interface UserBook {
  id: string;
  userId: string;
  bookId: string;
  status: ShelfStatus | null;
  rating: number | null;
  isFavourite: boolean;
  shelves: string[];
  progressPages: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  book: SavedBook;
}

export interface ReadingSession {
  id: string;
  userId: string;
  bookId: string;
  status: SessionStatus;
  startedOn: string | null;
  finishedOn: string | null;
  isReread: boolean;
  notes: string | null;
  createdAt: string;
  book: SavedBook;
}

export interface Review {
  id: string;
  userId: string;
  bookId: string;
  rating: number | null;
  title: string | null;
  body: string;
  containsSpoilers: boolean;
  isReread: boolean;
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
  postId: string | null;
  /** Social counters, read from the review's post. */
  likesCount: number;
  commentsCount: number;
  author: Profile;
  book: SavedBook;
}

export type HighlightColour = "butter" | "sage" | "rose" | "lavender" | "blue";

/**
 * An annotation (marginalia): a passage, the reader's thoughts in the margin, a highlight colour and tags.
 * Stored in `quotes`; its social life (likes, comments, bookmarks) lives on its post. Drafts have no post.
 */
export interface Quote {
  id: string;
  userId: string;
  bookId: string;
  body: string;
  page: string | null;
  commentary: string | null;
  visibility: Visibility;
  highlight: HighlightColour;
  tags: string[];
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  postId: string | null;
  likesCount: number;
  commentsCount: number;
  author: Profile;
  book: SavedBook;
}

export interface MarginaliaQuery {
  /** "saved": annotations you've bookmarked (filters don't apply). */
  tab: "following" | "popular" | "recent" | "saved";
  genre?: string | null;
  bookId?: string | null;
  tag?: string | null;
}

export interface ListBook {
  bookId: string;
  position: number;
  note: string | null;
  imageUrl: string | null;
  book: SavedBook;
}

export interface ReadingList {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  coverStyle: ListCoverStyle;
  coverImageUrl: string | null;
  visibility: Visibility;
  isRanked: boolean;
  followersCount: number;
  bookCount: number;
  createdAt: string;
  updatedAt: string;
  postId: string | null;
  owner: Profile;
  /** First few books, for collage covers. */
  preview: SavedBook[];
  viewerFollows: boolean;
}

export interface ReadingListDetail extends ReadingList {
  books: ListBook[];
}

export interface ViewerPostState {
  liked: boolean;
  bookmarked: boolean;
  reposted: boolean;
}

export interface Post {
  id: string;
  userId: string;
  kind: PostKind;
  body: string | null;
  progressPages: number | null;
  progressPercent: number | null;
  visibility: Visibility;
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  createdAt: string;
  author: Profile;
  book: SavedBook | null;
  review: Review | null;
  quote: Quote | null;
  list: ReadingList | null;
  /** For kind === "repost": the original post. */
  repostOf: Post | null;
  viewer: ViewerPostState;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  /** Set when the body was edited after posting. */
  editedAt: string | null;
  author: Profile;
  replies: Comment[];
}

export interface Recommendation {
  id: string;
  sender: Profile;
  recipient: Profile;
  book: SavedBook;
  message: string | null;
  parentId: string | null;
  seenAt: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  kind: NotificationKind;
  actor: Profile;
  postId: string | null;
  postExcerpt: string | null;
  listId: string | null;
  listTitle: string | null;
  commentBody: string | null;
  recommendation: Recommendation | null;
  readAt: string | null;
  createdAt: string;
}

export interface BookReader {
  profile: Profile;
  status: ShelfStatus | null;
  rating: number | null;
  updatedAt: string;
}

/**
 * A reader's year. Everything except the all-time counts is scoped to `year`. For your own
 * stats, completions come from your diary (re-reads count); for someone else, from their
 * public shelf (one per book). Pages only count books with a known page count.
 */
export interface ProfileStats {
  year: number;
  /** All time: books on the Read shelf. */
  booksRead: number;
  /** Reads finished this year, re-reads included. */
  booksReadThisYear: number;
  distinctBooksThisYear: number;
  rereadsThisYear: number;
  /** Diary entries started or finished this year (only visible to the reader). */
  sessionsThisYear: number;
  pagesReadThisYear: number;
  /** How many of this year's books had a page count (pages are only summed for those). */
  booksWithPagesThisYear: number;
  currentlyReading: number;
  /** For books finished this year. */
  averageRating: number | null;
  reviewsCount: number;
  quotesCount: number;
  listsCount: number;
  /** For books finished this year: index 0 = ½★ … 9 = 5★. */
  ratingDistribution: number[];
  byMonth: number[];
  topGenres: { genre: string; count: number }[];
  topAuthors: { author: string; count: number }[];
}

/** Someone whose public shelves and taste overlap with yours, and why. */
export interface SimilarReader {
  profile: Profile;
  /** 0–100. */
  score: number;
  sharedBooks: number;
  sharedFavourites: number;
  sharedAuthors: string[];
  sharedGenres: string[];
  /** 0–1 agreement on books you've both rated, or null if none. */
  agreement: number | null;
}

export interface Invite {
  code: string;
  createdAt: string;
  expiresAt: string | null;
  maxUses: number | null;
  /** How many people joined with it (never who). */
  uses: number;
  /** Past its expiry date or out of uses. */
  closed: boolean;
}
export interface InvitePreview {
  valid: boolean;
  inviter: Pick<Profile, "username" | "displayName" | "avatarUrl" | "favouriteGenres">;
}

export interface RecapBook {
  id: string;
  slug: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
}
/** A year (month null) or a month of reading. Missing data stays null. */
export interface ReadingRecap {
  year: number;
  month: number | null;
  completions: number;
  distinctBooks: number;
  rereads: number;
  pages: number;
  booksWithPages: number;
  averageRating: number | null;
  byMonth: number[];
  favouriteBook: (RecapBook & { rating: number }) | null;
  topAuthor: { name: string; count: number } | null;
  topGenre: { name: string; count: number } | null;
  busiestMonth: { month: number; count: number } | null;
  mostHighlighted: (RecapBook & { count: number }) | null;
  lovedLine: { quoteId: string; body: string; title: string; likes: number } | null;
  annotations: number;
  timeline: (RecapBook & { day: string; rating: number | null; reread: boolean })[];
}

/** Which kinds of post a feed shows. */
export type FeedFilter = "all" | "reviews" | "annotations" | "reading" | "lists";
export type ListSort = "popular" | "recent" | "books";

/** "I finished this": diary, shelf, rating and, optionally, a review, a line and a post. */
export interface LogBookInput {
  bookId: string;
  finishedOn: string | null;
  rating: number | null;
  reread: boolean;
  /** Private: kept in the diary only. */
  notes: string | null;
  review: { title: string | null; body: string; containsSpoilers: boolean } | null;
  quote: { body: string; page: string | null } | null;
  visibility: Visibility;
  /** Post "finished" to the feed (a review already announces it). */
  share: boolean;
}
export interface LogBookResult {
  sessionId: string;
  reviewId: string | null;
  quoteId: string | null;
  postId: string | null;
}

export interface Compatibility {
  score: number;
  sharedBooks: number;
  sharedGenres: string[];
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export type ShelfSort = "recent" | "title" | "author" | "rating" | "year";

export interface ShelfQuery {
  status?: ShelfStatus;
  favourites?: boolean;
  shelf?: string;
  sort?: ShelfSort;
}

/** How a shelf move should behave beyond changing the shelf. */
export interface ShelfMoveOptions {
  /** Read → Reading as a deliberate re-read (a new diary entry), not "not finished after all". */
  reread?: boolean;
  /** Post "started" / "finished" to the feed. Off unless the reader asks. */
  share?: boolean;
  visibility?: Visibility;
  /** Day it happened (YYYY-MM-DD); defaults to today. */
  date?: string | null;
}
/** Opaque record of what a move changed, handed back to undo it for a few minutes. */
export type ShelfUndo = Record<string, unknown>;
export interface ShelfMove {
  userBook: UserBook | null;
  changed: boolean;
  undo: ShelfUndo | null;
}

/** The viewer's relationship to another reader. */
export interface Relationship {
  following: boolean;
  blocked: boolean;
  muted: boolean;
}

export type ReportTarget = "profile" | "post" | "comment" | "review" | "quote" | "list";
export type ReportReason = "spam" | "harassment" | "hate" | "sexual" | "spoilers" | "other";
export interface ReportInput {
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  details: string | null;
}

export interface ShelfSummary {
  counts: Record<ShelfStatus | "favourites", number>;
  custom: { name: string; count: number }[];
}

export interface ReviewInput {
  bookId: string;
  rating: number | null;
  title: string | null;
  body: string;
  containsSpoilers: boolean;
  isReread: boolean;
  visibility: Visibility;
}

export interface QuoteInput {
  bookId: string;
  body: string;
  page: string | null;
  commentary: string | null;
  visibility: Visibility;
  highlight: HighlightColour;
  tags: string[];
  isDraft: boolean;
}

export interface ListInput {
  title: string;
  description: string | null;
  coverStyle: ListCoverStyle;
  coverImageUrl: string | null;
  visibility: Visibility;
  isRanked: boolean;
}

export interface SessionInput {
  bookId: string;
  status: SessionStatus;
  startedOn: string | null;
  finishedOn: string | null;
  isReread: boolean;
  notes: string | null;
}

export interface UpdatePostInput {
  bookId: string | null;
  body: string;
  progressPages: number | null;
  progressPercent: number | null;
  kind: "update" | "recommendation";
  visibility: Visibility;
}

// ── personalised suggestions ─────────────────────────────────────────
export type SuggestionStatus = "suggested" | "dismissed" | "added";

/** Why a book was suggested. Each kind names the metadata that actually matched. */
export type SuggestionReason =
  | { kind: "author"; author: string; bookId: string | null; title: string | null; verb: "loved" | "read" | "are reading" | "saved" | "favourite"; count: number }
  | { kind: "themes"; bookId: string; title: string; shared: string[] }
  | { kind: "genre"; genre: string; count: number; verb: "read" | "add" | "favourite" }
  | { kind: "readers"; count: number; bookId: string | null; title: string | null }
  | { kind: "subject"; subject: string; count: number };

export interface Suggestion {
  id: string;
  /** The logical book (title + author), the same across editions. */
  workKey: string;
  /** A copy of the book as found, so the list renders without further lookups. `id` is set once it's in the catalogue. */
  book: Book & { subjects: string[] };
  score: number;
  reasons: SuggestionReason[];
  sourceBookIds: string[];
  status: SuggestionStatus;
  createdAt: string;
}

export interface SuggestionInput {
  workKey: string;
  bookId: string | null;
  olWorkId: string | null;
  book: Suggestion["book"];
  score: number;
  reasons: SuggestionReason[];
  sourceBookIds: string[];
}

export interface SuggestionState {
  /** Fingerprint of the shelves the current suggestions were made from. */
  signature: string | null;
  refreshedAt: string | null;
  attemptedAt: string | null;
}

/** One shelved book, with just what the suggestion engine reads. */
export interface TasteEntry {
  bookId: string;
  title: string;
  authors: string[];
  genres: string[];
  moods: string[];
  subjects: string[];
  status: ShelfStatus;
  rating: number | null;
  favourite: boolean;
  olWorkId: string | null;
  isbn13: string | null;
}

/** A book Dogear readers loved alongside books on your shelves. */
export interface CoShelvedBook {
  book: SavedBook;
  subjects: string[];
  readers: number;
  viaBookIds: string[];
}
