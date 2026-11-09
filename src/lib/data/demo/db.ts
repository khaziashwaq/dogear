import "server-only";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  HighlightColour,
  Accent,
  ListCoverStyle,
  NotificationKind,
  PostKind,
  ProfileMotif,
  SessionStatus,
  ShelfStatus,
  Visibility,
} from "@/lib/types";
import { coverFromIsbn, hash } from "@/lib/utils";
import { SEED_BOOKS } from "../seed/books";
import {
  DEMO_PASSWORD,
  SEED_COMMENTS,
  SEED_FOLLOWS,
  SEED_LIKES,
  SEED_LISTS,
  SEED_QUOTES,
  SEED_REVIEWS,
  SEED_SHELVES,
  SEED_UPDATES,
  SEED_USERS,
} from "../seed/community";

// Row shapes mirror the SQL schema (camelCased). Counters are derived on read.

export interface UserRow { id: string; email: string; passwordHash: string; salt: string }
export interface ProfileRow {
  id: string; username: string | null; displayName: string; bio: string; avatarUrl: string | null; coverUrl: string | null;
  pronouns: string | null; location: string | null; website: string | null; accent: Accent; motif: ProfileMotif;
  favouriteGenres: string[]; favouriteAuthors: string[]; readingGoal: number | null; onboarded: boolean; createdAt: string;
}
export interface FollowRow { followerId: string; followingId: string; createdAt: string }
export interface BookRow {
  id: string; slug: string; title: string; subtitle: string | null; authors: string[]; description: string | null; coverUrl: string | null;
  isbn13: string | null; isbn10: string | null; olWorkId: string | null; olEditionId: string | null; publishedYear: number | null;
  publisher: string | null; pageCount: number | null; language: string | null; genres: string[]; moods: string[]; createdAt: string;
}
export interface UserBookRow {
  id: string; userId: string; bookId: string; status: ShelfStatus | null; rating: number | null; isFavourite: boolean; favouritedAt: string | null;
  shelves: string[]; progressPages: number | null; startedAt: string | null; finishedAt: string | null; createdAt: string; updatedAt: string;
}
export interface SessionRow {
  id: string; userId: string; bookId: string; status: SessionStatus; startedOn: string | null; finishedOn: string | null;
  isReread: boolean; notes: string | null; createdAt: string;
}
export interface ReviewRow {
  id: string; userId: string; bookId: string; rating: number | null; title: string | null; body: string; containsSpoilers: boolean;
  isReread: boolean; visibility: Visibility; createdAt: string; updatedAt: string;
}
export interface QuoteRow {
  id: string; userId: string; bookId: string; body: string; page: string | null; commentary: string | null; visibility: Visibility; createdAt: string;
  // Marginalia — optional so demo data saved before annotations existed still loads.
  highlight?: HighlightColour; tags?: string[]; isDraft?: boolean; updatedAt?: string;
}
export interface ListRow {
  id: string; userId: string; title: string; description: string | null; coverStyle: ListCoverStyle; coverImageUrl: string | null;
  visibility: Visibility; isRanked: boolean; createdAt: string; updatedAt: string;
}
export interface ListBookRow { listId: string; bookId: string; position: number; note: string | null; imageUrl: string | null; addedAt: string }
export interface ListFollowRow { userId: string; listId: string; createdAt: string }
export interface PostRow {
  id: string; userId: string; kind: PostKind; bookId: string | null; reviewId: string | null; quoteId: string | null; listId: string | null;
  repostOfId: string | null; body: string | null; progressPages: number | null; progressPercent: number | null; visibility: Visibility; createdAt: string;
}
export interface CommentRow { id: string; postId: string; userId: string; parentId: string | null; body: string; createdAt: string }
export interface LikeRow { userId: string; postId: string; createdAt: string }
export interface RecommendationRow {
  id: string; senderId: string; recipientId: string; bookId: string; message: string | null; parentId: string | null; seenAt: string | null; createdAt: string;
}
export interface NotificationRow {
  id: string; recipientId: string; actorId: string; kind: NotificationKind; postId: string | null; commentId: string | null;
  listId: string | null; recommendationId: string | null; readAt: string | null; createdAt: string;
}

export interface BlockRow { blockerId: string; blockedId: string; createdAt: string }
export interface MuteRow { muterId: string; mutedId: string; createdAt: string }
export interface ReportRow {
  id: string; reporterId: string; targetType: string; targetId: string; reason: string; details: string | null; status: string; createdAt: string;
}

export interface DemoDB {
  version: number;
  secret: string;
  users: UserRow[];
  profiles: ProfileRow[];
  follows: FollowRow[];
  books: BookRow[];
  userBooks: UserBookRow[];
  sessions: SessionRow[];
  reviews: ReviewRow[];
  quotes: QuoteRow[];
  lists: ListRow[];
  listBooks: ListBookRow[];
  listFollows: ListFollowRow[];
  posts: PostRow[];
  comments: CommentRow[];
  likes: LikeRow[];
  bookmarks: LikeRow[];
  recommendations: RecommendationRow[];
  notifications: NotificationRow[];
  // Safety — optional so demo data saved before they existed still loads (filled in on load).
  blocks?: BlockRow[];
  mutes?: MuteRow[];
  reports?: ReportRow[];
}

const DB_VERSION = 3;
const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "demo-db.json");

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return { salt, passwordHash: scryptSync(password, salt, 32).toString("hex") };
}

export const newId = () => randomUUID();

// ── notifications, shared by the seeder and the store ─────────────────
const ONCE = new Set(["like", "follow", "repost", "list_follow"]);

/** Same rule as the database: one like / follow / repost / list-follow notification per actor and target. */
export function pushNotification(db: DemoDB, n: Omit<NotificationRow, "id" | "readAt" | "createdAt"> & { createdAt?: string }) {
  if (n.recipientId === n.actorId) return;
  if (
    ONCE.has(n.kind) &&
    db.notifications.some((x) => x.kind === n.kind && x.recipientId === n.recipientId && x.actorId === n.actorId && x.postId === n.postId && x.listId === n.listId)
  ) {
    return;
  }
  db.notifications.push({ id: newId(), readAt: null, ...n, createdAt: n.createdAt ?? new Date().toISOString() });
}

// ── seeding ───────────────────────────────────────────────────────────
export function buildSeed(): DemoDB {
  const now = Date.now();
  const at = (daysAgo: number, salt: string) => {
    const jitter = (hash(salt) % 1000) / 1000; // 0..1 of a ~5h window
    return new Date(now - daysAgo * 86_400_000 - jitter * 5 * 3_600_000).toISOString();
  };
  const day = (iso: string) => iso.slice(0, 10);

  const db: DemoDB = {
    version: DB_VERSION, secret: randomBytes(32).toString("hex"),
    users: [], profiles: [], follows: [], books: [], userBooks: [], sessions: [], reviews: [], quotes: [], lists: [],
    listBooks: [], listFollows: [], posts: [], comments: [], likes: [], bookmarks: [], recommendations: [], notifications: [],
    blocks: [], mutes: [], reports: [],
  };

  const uid: Record<string, string> = {};
  for (const u of SEED_USERS) {
    const id = newId();
    uid[u.key] = id;
    db.users.push({ id, email: `${u.username.replace(/[^a-z0-9]/g, "")}@demo.dogear.app`, ...hashPassword(DEMO_PASSWORD) });
    db.profiles.push({
      id, username: u.username, displayName: u.displayName, bio: u.bio, avatarUrl: null, coverUrl: null,
      pronouns: u.pronouns ?? null, location: u.location ?? null, website: null, accent: u.accent, motif: u.motif,
      favouriteGenres: u.genres, favouriteAuthors: u.authors, readingGoal: u.goal ?? null, onboarded: true,
      createdAt: at(400 + (hash(u.key) % 200), u.key),
    });
  }

  const bid: Record<string, string> = {};
  for (const b of SEED_BOOKS) {
    const id = newId();
    bid[b.key] = id;
    db.books.push({
      id, slug: b.key, title: b.title, subtitle: b.subtitle ?? null, authors: b.authors, description: b.description,
      coverUrl: coverFromIsbn(b.isbn13), isbn13: b.isbn13, isbn10: null, olWorkId: null, olEditionId: null,
      publishedYear: b.year, publisher: b.publisher, pageCount: b.pages, language: "English", genres: b.genres, moods: b.moods,
      createdAt: at(500, b.key),
    });
  }

  for (const [a, b] of SEED_FOLLOWS) {
    const createdAt = at(60 + (hash(a + b) % 90), a + b);
    db.follows.push({ followerId: uid[a], followingId: uid[b], createdAt });
    pushNotification(db, { recipientId: uid[b], actorId: uid[a], kind: "follow", postId: null, commentId: null, listId: null, recommendationId: null, createdAt });
  }

  const post = (p: Partial<PostRow> & Pick<PostRow, "userId" | "kind" | "createdAt">) => {
    const row: PostRow = {
      id: newId(), bookId: null, reviewId: null, quoteId: null, listId: null, repostOfId: null, body: null,
      progressPages: null, progressPercent: null, visibility: "public", ...p,
    };
    db.posts.push(row);
    return row;
  };

  const reviewed = new Set(SEED_REVIEWS.map((r) => `${r.user}:${r.book}`));
  for (const s of SEED_SHELVES) {
    const updatedAt = at(s.daysAgo, s.user + s.book);
    const book = SEED_BOOKS.find((b) => b.key === s.book)!;
    const started = new Date(new Date(updatedAt).getTime() - (book.pages / 40) * 86_400_000).toISOString();
    db.userBooks.push({
      id: newId(), userId: uid[s.user], bookId: bid[s.book], status: s.status, rating: s.rating ?? null,
      isFavourite: Boolean(s.fav), favouritedAt: s.fav ? updatedAt : null, shelves: s.shelves ?? [], progressPages: s.progress ?? null,
      startedAt: s.status === "read" || s.status === "reading" || s.status === "dnf" ? day(started) : null,
      finishedAt: s.status === "read" ? day(updatedAt) : null, createdAt: started, updatedAt,
    });
    if (s.status === "read" || s.status === "reading" || s.status === "dnf") {
      db.sessions.push({
        id: newId(), userId: uid[s.user], bookId: bid[s.book],
        status: s.status === "read" ? "finished" : s.status === "dnf" ? "abandoned" : "reading",
        startedOn: day(started), finishedOn: s.status === "reading" ? null : day(updatedAt), isReread: false, notes: null, createdAt: started,
      });
    }
    if (s.daysAgo < 45 && !reviewed.has(`${s.user}:${s.book}`)) {
      if (s.status === "read") post({ userId: uid[s.user], kind: "finished", bookId: bid[s.book], createdAt: updatedAt });
      if (s.status === "reading") post({ userId: uid[s.user], kind: "started", bookId: bid[s.book], createdAt: started });
    }
  }
  // A logged re-read for the demo account
  const margoSH = db.sessions.find((x) => x.userId === uid.margo && x.bookId === bid["secret-history"]);
  if (margoSH) {
    db.sessions.push({ ...margoSH, id: newId(), startedOn: "2021-10-02", finishedOn: "2021-10-19", isReread: false, notes: "First read. Did not sleep.", createdAt: "2021-10-02T09:00:00.000Z" });
    margoSH.isReread = true;
    margoSH.notes = "Fourth time through. Kept a list of every lie Richard tells.";
  }

  const reviewPost: Record<string, string> = {};
  for (const r of SEED_REVIEWS) {
    const createdAt = at(r.daysAgo, "rev" + r.user + r.book);
    const row: ReviewRow = {
      id: newId(), userId: uid[r.user], bookId: bid[r.book], rating: r.rating, title: r.title ?? null, body: r.body,
      containsSpoilers: Boolean(r.spoilers), isReread: r.user === "margo" && r.book === "secret-history", visibility: "public", createdAt, updatedAt: createdAt,
    };
    db.reviews.push(row);
    reviewPost[`${r.user}:${r.book}`] = post({ userId: row.userId, kind: "review", bookId: row.bookId, reviewId: row.id, createdAt }).id;
  }

  const quotePost: Record<string, string> = {};
  for (const q of SEED_QUOTES) {
    const createdAt = at(q.daysAgo, "q" + q.user + q.book);
    const row: QuoteRow = {
      id: newId(), userId: uid[q.user], bookId: bid[q.book], body: q.body, page: q.page ?? null, commentary: q.commentary ?? null, visibility: "public", createdAt,
    };
    db.quotes.push(row);
    quotePost[`${q.user}:${q.book}`] = post({ userId: row.userId, kind: "quote", bookId: row.bookId, quoteId: row.id, createdAt }).id;
  }

  const listPost: Record<string, string> = {};
  const listId: Record<string, string> = {};
  for (const l of SEED_LISTS) {
    const createdAt = at(l.daysAgo, "l" + l.key);
    const row: ListRow = {
      id: newId(), userId: uid[l.user], title: l.title, description: l.description, coverStyle: l.cover, coverImageUrl: null,
      visibility: "public", isRanked: Boolean(l.ranked), createdAt, updatedAt: createdAt,
    };
    db.lists.push(row);
    listId[l.key] = row.id;
    l.books.forEach((b, i) => db.listBooks.push({ listId: row.id, bookId: bid[b.book], position: i, note: b.note ?? null, imageUrl: null, addedAt: createdAt }));
    listPost[l.key] = post({ userId: row.userId, kind: "list", listId: row.id, createdAt }).id;
  }
  // A private list so the visibility rules have something to hide
  {
    const createdAt = at(3, "private-list");
    const row: ListRow = {
      id: newId(), userId: uid.margo, title: "Gifts for my sister (shh)", description: "Don't look, Isla.", coverStyle: "butter",
      coverImageUrl: null, visibility: "private", isRanked: false, createdAt, updatedAt: createdAt,
    };
    db.lists.push(row);
    [["piranesi"], ["night-circus"], ["small-things"]].forEach(([b], i) => db.listBooks.push({ listId: row.id, bookId: bid[b], position: i, note: null, imageUrl: null, addedAt: createdAt }));
    post({ userId: uid.margo, kind: "list", listId: row.id, visibility: "private", createdAt });
  }

  for (const u of SEED_UPDATES) {
    post({
      userId: uid[u.user], kind: u.kind ?? "update", bookId: u.book ? bid[u.book] : null, body: u.body,
      progressPercent: u.progressPercent ?? null, createdAt: at(u.daysAgo, "u" + u.user + u.body),
    });
  }

  const resolve = (on: (typeof SEED_LIKES)[number]["on"]) =>
    "reviewOf" in on ? reviewPost[on.reviewOf.join(":")] : "quoteOf" in on ? quotePost[on.quoteOf.join(":")] : listPost[on.list];

  for (const l of SEED_LIKES) {
    const postId = resolve(l.on);
    if (!postId) continue;
    const p = db.posts.find((x) => x.id === postId)!;
    const createdAt = new Date(new Date(p.createdAt).getTime() + (hash(l.user + postId) % 72) * 3_600_000).toISOString();
    const clamped = new Date(Math.min(new Date(createdAt).getTime(), now - 60_000)).toISOString();
    db.likes.push({ userId: uid[l.user], postId, createdAt: clamped });
    pushNotification(db, { recipientId: p.userId, actorId: uid[l.user], kind: "like", postId, commentId: null, listId: null, recommendationId: null, createdAt: clamped });
  }

  for (const c of SEED_COMMENTS) {
    const postId = resolve(c.on);
    if (!postId) continue;
    const p = db.posts.find((x) => x.id === postId)!;
    const createdAt = new Date(Math.min(new Date(p.createdAt).getTime() + (hash(c.body) % 30) * 3_600_000, now - 120_000)).toISOString();
    const row: CommentRow = { id: newId(), postId, userId: uid[c.user], parentId: null, body: c.body, createdAt };
    db.comments.push(row);
    pushNotification(db, { recipientId: p.userId, actorId: row.userId, kind: "comment", postId, commentId: row.id, listId: null, recommendationId: null, createdAt });
    if (c.reply) {
      const rAt = new Date(Math.min(new Date(createdAt).getTime() + 2 * 3_600_000, now - 60_000)).toISOString();
      const reply: CommentRow = { id: newId(), postId, userId: uid[c.reply.user], parentId: row.id, body: c.reply.body, createdAt: rAt };
      db.comments.push(reply);
      pushNotification(db, { recipientId: row.userId, actorId: reply.userId, kind: "reply", postId, commentId: reply.id, listId: null, recommendationId: null, createdAt: rAt });
    }
  }

  // List follows
  for (const [u, l] of [["margo", "radiohead"], ["theo", "rainy-sunday"], ["saoirse", "overthinkers"], ["juniper", "broke-my-heart"], ["noor", "red-flags"], ["bea", "red-flags"], ["amara", "dark-academia-starter"]] as const) {
    const createdAt = at(2 + (hash(u + l) % 6), u + l);
    db.listFollows.push({ userId: uid[u], listId: listId[l], createdAt });
    const owner = db.lists.find((x) => x.id === listId[l])!.userId;
    pushNotification(db, { recipientId: owner, actorId: uid[u], kind: "list_follow", postId: null, commentId: null, listId: listId[l], recommendationId: null, createdAt });
  }

  // A repost so the feed shows one
  const repostCreated = at(0.3, "repost");
  db.posts.push({
    id: newId(), userId: uid.saoirse, kind: "repost", bookId: null, reviewId: null, quoteId: null, listId: null,
    repostOfId: listPost.overthinkers, body: null, progressPages: null, progressPercent: null, visibility: "public", createdAt: repostCreated,
  });
  pushNotification(db, { recipientId: uid.theo, actorId: uid.saoirse, kind: "repost", postId: listPost.overthinkers, commentId: null, listId: null, recommendationId: null, createdAt: repostCreated });

  // Pass the book: recommendations into the demo account's inbox, forming a small trail
  const rec1: RecommendationRow = {
    id: newId(), senderId: uid.juniper, recipientId: uid.margo, bookId: bid.piranesi, parentId: null, seenAt: null, createdAt: at(1.5, "rec1"),
    message: "You keep saying you want something gentle after Babel. This is the gentlest strange book I know. Read it slowly.",
  };
  const rec2: RecommendationRow = {
    id: newId(), senderId: uid.theo, recipientId: uid.margo, bookId: bid["small-things"], parentId: null, seenAt: null, createdAt: at(4, "rec2"),
    message: "One sitting. Trust me. Then call me.",
  };
  const rec0: RecommendationRow = {
    id: newId(), senderId: uid.bea, recipientId: uid.juniper, bookId: bid.piranesi, parentId: null, seenAt: at(60, "rec0s"), createdAt: at(72, "rec0"),
    message: "It's very you.",
  };
  rec1.parentId = rec0.id;
  db.recommendations.push(rec0, rec1, rec2);
  for (const r of [rec0, rec1, rec2]) {
    pushNotification(db, { recipientId: r.recipientId, actorId: r.senderId, kind: "recommendation", postId: null, commentId: null, listId: null, recommendationId: r.id, createdAt: r.createdAt });
  }

  // Older notifications for the demo account are already read; keep the last few days unread.
  const cutoff = now - 3 * 86_400_000;
  for (const n of db.notifications) if (new Date(n.createdAt).getTime() < cutoff) n.readAt = n.createdAt;

  return db;
}

// ── persistence ───────────────────────────────────────────────────────
const g = globalThis as unknown as { __dogearDemoDB?: DemoDB };

function load(): DemoDB {
  try {
    if (existsSync(DATA_FILE)) {
      const parsed = JSON.parse(readFileSync(DATA_FILE, "utf8")) as DemoDB;
      if (parsed.version === DB_VERSION) {
        parsed.blocks ??= [];
        parsed.mutes ??= [];
        parsed.reports ??= [];
        return parsed;
      }
    }
  } catch {
    // fall through to a fresh seed
  }
  const fresh = buildSeed();
  persist(fresh);
  return fresh;
}

function persist(db: DemoDB) {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(db));
  } catch {
    // Read-only filesystems (e.g. serverless) keep the demo in memory only.
  }
}

export function getDemoDB(): DemoDB {
  if (!g.__dogearDemoDB) g.__dogearDemoDB = load();
  return g.__dogearDemoDB;
}

export function saveDemoDB() {
  if (g.__dogearDemoDB) persist(g.__dogearDemoDB);
}

export function resetDemoDB() {
  g.__dogearDemoDB = buildSeed();
  persist(g.__dogearDemoDB);
}
