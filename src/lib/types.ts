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
  author: Profile;
  book: SavedBook;
}

export interface Quote {
  id: string;
  userId: string;
  bookId: string;
  body: string;
  page: string | null;
  commentary: string | null;
  visibility: Visibility;
  createdAt: string;
  postId: string | null;
  author: Profile;
  book: SavedBook;
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

export interface ProfileStats {
  year: number;
  booksRead: number;
  booksReadThisYear: number;
  pagesReadThisYear: number;
  currentlyReading: number;
  averageRating: number | null;
  reviewsCount: number;
  quotesCount: number;
  listsCount: number;
  ratingDistribution: number[];
  byMonth: number[];
  topGenres: { genre: string; count: number }[];
  topAuthors: { author: string; count: number }[];
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
