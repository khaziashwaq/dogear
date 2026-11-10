// Personalised book suggestions: a deterministic, metadata-only engine.
//
// Pure functions, no I/O: a reader's shelves become a taste profile (authors, genres, subject
// headings and moods, each weighted by how strongly the shelf entry speaks for the reader), and
// candidate books are scored against it. Every point of a score comes from metadata that actually
// matched, and every explanation names that metadata, so nothing shown to the reader is invented.
//
// Imports are type-only so this file runs under plain `node --test --experimental-strip-types`.
import type { Book, ShelfStatus, SuggestionReason, TasteEntry } from "@/lib/types";

// ── configuration ────────────────────────────────────────────────────
/** How much each signal contributes to a score (they sum to 1). */
export const WEIGHTS = {
  /** Genre and subject-heading overlap with the whole library. */
  topic: 0.3,
  /** Written by an author the reader has shelved (or named as a favourite). */
  author: 0.25,
  /** Shared themes with one particular book on the shelves: the strongest single literary connection. */
  themes: 0.2,
  /** How many different books on the shelves point at this one. */
  library: 0.15,
  /** Edition counts on Open Library, and Dogear readers who shelved it. */
  popularity: 0.1,
} as const;

/** How strongly each shelf speaks for the reader's taste. Did-not-finish says nothing positive. */
export const SHELF_WEIGHT: Record<ShelfStatus, number> = { read: 1, reading: 0.8, want_to_read: 0.45, dnf: 0 };

/** Below this a candidate is noise, not a suggestion. */
export const MIN_SCORE = 0.08;

// ── shapes ───────────────────────────────────────────────────────────
/** One book on the reader's shelves, as the engine sees it. */
export type LibraryEntry = TasteEntry;

/** Where a candidate was found. A candidate found several ways keeps all of them. */
export type Origin =
  | { kind: "subject"; subject: string }
  | { kind: "author"; author: string }
  | { kind: "readers"; count: number; viaBookIds: string[] }
  | { kind: "catalogue"; genre: string };

export interface Candidate {
  /** Catalogue id when the book is already in Dogear. */
  bookId: string | null;
  slug: string | null;
  olWorkId: string | null;
  olEditionId: string | null;
  isbn13: string | null;
  title: string;
  authors: string[];
  coverUrl: string | null;
  publishedYear: number | null;
  genres: string[];
  moods: string[];
  subjects: string[];
  /** 0–1: how widely read (edition count on Open Library, readers on Dogear). */
  popularity: number;
  origins: Origin[];
}

interface Influence {
  bookId: string;
  title: string;
  weight: number;
  verb: Verb;
}
type Verb = "loved" | "read" | "are reading" | "saved";
interface Feature {
  /** Display form (first spelling seen). */
  label: string;
  weight: number;
  books: Influence[];
}

export interface TasteProfile {
  books: (LibraryEntry & { weight: number; verb: Verb; topics: Set<string> })[];
  authors: Map<string, Feature>;
  genres: Map<string, Feature>;
  subjects: Map<string, Feature>;
  moods: Map<string, Feature>;
  /** Largest feature weight per kind, to turn weights into 0–1 affinities. */
  max: { authors: number; genres: number; subjects: number; moods: number };
  /** Favourite genres / authors from the reader's profile: weak seeds, used when shelves say little. */
  seedGenres: Set<string>;
  seedAuthors: Map<string, string>;
  /** Every identifier of a book already on a shelf, for exclusion. */
  owned: Set<string>;
}

export interface ScoredSuggestion {
  workKey: string;
  candidate: Candidate;
  score: number;
  components: Record<keyof typeof WEIGHTS, number>;
  reasons: SuggestionReason[];
  sourceBookIds: string[];
}

// ── normalisation ────────────────────────────────────────────────────
const strip = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function normAuthor(name: string): string {
  return strip(name).replace(/[^a-z0-9]+/g, " ").trim();
}

/** "The Brothers Karamazov: A Novel (Penguin Classics)" and "Brothers Karamazov" are one logical book. */
export function normTitle(title: string): string {
  return strip(title)
    .replace(/\s*[:(\[].*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^(the|a|an) /, "")
    .trim();
}

/** The identity of a logical book, across editions and translations' subtitles: title + author surname. */
export function workKey(b: { title: string; authors: string[] }): string {
  const surname = normAuthor(b.authors[0] ?? "").split(" ").filter(Boolean).pop() ?? "";
  return `${normTitle(b.title)}|${surname}`.slice(0, 200);
}

// Headings that describe the catalogue record, not the book: they'd make everything "similar".
const GENERIC = new Set([
  "fiction", "general", "literature", "novel", "novels", "english fiction", "american fiction", "english literature",
  "american literature", "accessible book", "protected daisy", "in library", "lending library", "large type books",
  "open library staff picks", "translations into english", "reading level-grade 9", "reading level-grade 10",
  "reading level-grade 11", "reading level-grade 12", "fiction in english", "readers", "textbooks", "juvenile fiction",
  "long now manual for civilization", "classic literature", "literary", "popular print disabled books", "internet archive wishlist",
  "british and irish fiction", "fiction general", "literature and fiction", "nyt", "bestsellers", "new york times bestseller",
  "russian fiction", "french fiction", "japanese fiction", "german fiction", "translations", "english", "spanish language materials",
]);
const NOISE = /^(nyt:|award:|series:|place:|time:|person:)|=|\d{4}|^[^a-z]*$|language materials|^reading level/;

/** One clean, lower-case heading per subject string, or null if it says nothing about the book. */
export function normSubject(raw: string): string | null {
  let s = strip(raw).replace(/\([^)]*\)/g, " ");
  // "Fiction, romance, general" → "romance"; "Murder -- Investigation" → "murder".
  const parts = s.split(/,|--|\//).map((p) => p.replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  s = parts.find((p) => !GENERIC.has(p) && p !== "fiction") ?? "";
  s = s.replace(/ fiction$/, "").replace(/^fiction /, "").trim();
  if (s.length < 3 || s.length > 48 || GENERIC.has(s) || NOISE.test(s)) return null;
  return s;
}

export function normSubjects(raw: string[], cap = 25): string[] {
  const out = new Set<string>();
  for (const r of raw) {
    const s = normSubject(r);
    if (s) out.add(s);
    if (out.size >= cap) break;
  }
  return [...out];
}

const GUIDE = /\b(study guide|sparknotes|cliffs ?notes|summary (of|and analysis)|analysis of|a reader'?s guide|workbook|teacher'?s guide|coloring book|boxed set|box set|collection set|books? \d+ ?- ?\d+)\b/i;
const GUIDE_AUTHOR = /\b(sparknotes|cliffsnotes|bookrags|supersummary|gradesaver|instaread|readtrepreneur)\b/i;

/** Study guides, summaries and box sets aren't books anyone would want suggested. */
export function isNoise(c: { title: string; authors: string[] }): boolean {
  return GUIDE.test(c.title) || c.authors.some((a) => GUIDE_AUTHOR.test(a)) || c.authors.length === 0;
}

// ── taste profile ────────────────────────────────────────────────────
/** How much one shelf entry says about the reader's taste. */
export function entryWeight(e: Pick<LibraryEntry, "status" | "rating" | "favourite">): number {
  let w = SHELF_WEIGHT[e.status] ?? 0;
  if (w === 0) return 0;
  const r = e.rating;
  if (r != null) w *= r >= 4.5 ? 1.4 : r >= 4 ? 1.25 : r >= 3 ? 1 : r >= 2 ? 0.45 : 0.15;
  if (e.favourite) w *= 1.3;
  return w;
}

function verbFor(e: LibraryEntry): Verb {
  if (e.favourite || (e.status === "read" && (e.rating ?? 0) >= 4)) return "loved";
  if (e.status === "read") return "read";
  if (e.status === "reading") return "are reading";
  return "saved";
}

function add(map: Map<string, Feature>, key: string, label: string, inf: Influence) {
  const f = map.get(key) ?? { label, weight: 0, books: [] };
  f.weight += inf.weight;
  f.books.push(inf);
  map.set(key, f);
}

const maxOf = (m: Map<string, Feature>) => Math.max(0, ...[...m.values()].map((f) => f.weight));

export function buildProfile(library: LibraryEntry[], seeds: { genres?: string[]; authors?: string[] } = {}): TasteProfile {
  const authors = new Map<string, Feature>();
  const genres = new Map<string, Feature>();
  const subjects = new Map<string, Feature>();
  const moods = new Map<string, Feature>();
  const owned = new Set<string>();
  const books: TasteProfile["books"] = [];

  for (const e of library) {
    // Everything on a shelf, even did-not-finish, is never suggested back.
    owned.add(`id:${e.bookId}`);
    owned.add(`key:${workKey(e)}`);
    if (e.olWorkId) owned.add(`ol:${e.olWorkId}`);
    if (e.isbn13) owned.add(`isbn:${e.isbn13}`);

    const weight = entryWeight(e);
    const verb = verbFor(e);
    const subs = normSubjects(e.subjects);
    const topics = new Set([...subs, ...e.genres.map((g) => g.toLowerCase()), ...e.moods.map((m) => `mood:${m}`)]);
    books.push({ ...e, subjects: subs, weight, verb, topics });
    if (weight <= 0) continue;
    const inf: Influence = { bookId: e.bookId, title: e.title, weight, verb };
    for (const a of e.authors.slice(0, 3)) if (normAuthor(a)) add(authors, normAuthor(a), a, inf);
    for (const g of e.genres) add(genres, g.toLowerCase(), g, inf);
    for (const s of subs) add(subjects, s, s, inf);
    for (const m of e.moods) add(moods, m, m, inf);
  }

  return {
    books,
    authors,
    genres,
    subjects,
    moods,
    max: { authors: maxOf(authors), genres: maxOf(genres), subjects: maxOf(subjects), moods: maxOf(moods) },
    seedGenres: new Set((seeds.genres ?? []).map((g) => g.toLowerCase())),
    seedAuthors: new Map((seeds.authors ?? []).map((a) => [normAuthor(a), a])),
    owned,
  };
}

/** Whether the shelves (or profile) say enough to suggest anything. */
export function hasSignal(p: TasteProfile): boolean {
  return p.authors.size + p.genres.size + p.subjects.size + p.moods.size + p.seedGenres.size + p.seedAuthors.size > 0;
}

/** What to look for: the reader's strongest subject headings, genres and authors. */
export function discoverySeeds(p: TasteProfile, limits = { subjects: 4, authors: 3 }) {
  const top = (m: Map<string, Feature>, n: number) =>
    [...m.entries()].sort((a, b) => b[1].weight - a[1].weight || a[0].localeCompare(b[0])).slice(0, n);
  // Headings shared by two or more books first: they say more about taste than one book's quirks.
  const subjects = [...p.subjects.entries()]
    .sort((a, b) => b[1].books.length - a[1].books.length || b[1].weight - a[1].weight || a[0].localeCompare(b[0]))
    .slice(0, limits.subjects)
    .map(([k]) => k);
  const genres = top(p.genres, 3).map(([k]) => k);
  for (const g of p.seedGenres) if (genres.length < 3 && !genres.includes(g)) genres.push(g);
  const authors = top(p.authors, limits.authors).map(([, f]) => f.label);
  for (const [, a] of p.seedAuthors) if (authors.length < limits.authors && !authors.some((x) => normAuthor(x) === normAuthor(a))) authors.push(a);
  return { subjects, genres, authors };
}

// ── candidates ───────────────────────────────────────────────────────
/** One entry per logical book: editions and repeat finds are merged, keeping the richer record. */
export function mergeCandidates(list: Candidate[]): Candidate[] {
  const byKey = new Map<string, Candidate>();
  const olToKey = new Map<string, string>();
  for (const raw of list) {
    if (!raw.title || isNoise(raw)) continue;
    const c: Candidate = { ...raw, subjects: normSubjects(raw.subjects, 40), origins: [...raw.origins] };
    const key = (c.olWorkId && olToKey.get(c.olWorkId)) || workKey(c);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, c);
    } else {
      prev.bookId ??= c.bookId;
      prev.slug ??= c.slug;
      prev.olWorkId ??= c.olWorkId;
      prev.olEditionId ??= c.olEditionId;
      prev.isbn13 ??= c.isbn13;
      prev.coverUrl ??= c.coverUrl;
      prev.publishedYear ??= c.publishedYear;
      prev.genres = [...new Set([...prev.genres, ...c.genres])];
      prev.moods = [...new Set([...prev.moods, ...c.moods])];
      prev.subjects = [...new Set([...prev.subjects, ...c.subjects])].slice(0, 40);
      prev.popularity = Math.max(prev.popularity, c.popularity);
      prev.origins.push(...c.origins);
    }
    if (c.olWorkId) olToKey.set(c.olWorkId, key);
  }
  return [...byKey.values()];
}

/** Open Library edition counts run from 1 to several thousand; 300+ editions is "very widely read". */
export function editionPopularity(editions: number | null | undefined): number {
  if (!editions || editions <= 1) return 0;
  return Math.min(1, Math.log10(editions) / Math.log10(300));
}

// ── scoring ──────────────────────────────────────────────────────────
const softOr = (xs: number[]) => 1 - xs.reduce((acc, x) => acc * (1 - Math.max(0, Math.min(1, x))), 1);

function isOwned(p: TasteProfile, c: Candidate, excluded: Set<string>) {
  const keys = [`key:${workKey(c)}`, c.bookId && `id:${c.bookId}`, c.olWorkId && `ol:${c.olWorkId}`, c.isbn13 && `isbn:${c.isbn13}`].filter(Boolean) as string[];
  return keys.some((k) => p.owned.has(k) || excluded.has(k));
}

/** Score one candidate against the profile, with the reasons behind the score. */
export function scoreCandidate(p: TasteProfile, c: Candidate): ScoredSuggestion {
  const genres = c.genres.map((g) => g.toLowerCase());
  // Idempotent: merged candidates are already clean; this covers candidates scored directly.
  const subs = normSubjects(c.subjects, 40);

  // Topic: genre and heading overlap with the whole library.
  const genreHits = genres.map((g) => ({ g, f: p.genres.get(g) })).filter((x) => x.f) as { g: string; f: Feature }[];
  const subHits = subs.map((s) => ({ s, f: p.subjects.get(s) })).filter((x) => x.f) as { s: string; f: Feature }[];
  const moodHits = c.moods.map((m) => p.moods.get(m)).filter(Boolean) as Feature[];
  const seedGenreHits = genres.filter((g) => p.seedGenres.has(g) && !p.genres.has(g));
  const topic = softOr([
    ...genreHits.map((x) => 0.45 * (x.f.weight / (p.max.genres || 1))),
    ...subHits.map((x) => 0.3 * (x.f.weight / (p.max.subjects || 1))),
    ...seedGenreHits.map(() => 0.25),
  ]);

  // Author: someone the reader has shelved, or named as a favourite.
  let author = 0;
  let authorHit: { f: Feature | null; label: string } | null = null;
  for (const a of c.authors.slice(0, 3)) {
    const f = p.authors.get(normAuthor(a));
    const aff = f ? 0.55 + 0.45 * (f.weight / (p.max.authors || 1)) : p.seedAuthors.has(normAuthor(a)) ? 0.6 : 0;
    if (aff > author) {
      author = aff;
      authorHit = { f: f ?? null, label: f?.label ?? p.seedAuthors.get(normAuthor(a)) ?? a };
    }
  }

  // Themes: the single closest book on the shelves, by shared headings, genres and moods.
  const cTopics = new Set([...subs, ...genres, ...c.moods.map((m) => `mood:${m}`)]);
  let themes = 0;
  let closest: { book: TasteProfile["books"][number]; shared: string[] } | null = null;
  let breadth = 0;
  const touched: string[] = [];
  for (const b of p.books) {
    if (b.weight <= 0) continue;
    const shared = [...b.topics].filter((t) => cTopics.has(t));
    const sharedSubs = shared.filter((t) => !t.startsWith("mood:") && !genres.includes(t));
    const sameAuthor = b.authors.some((a) => c.authors.some((x) => normAuthor(x) === normAuthor(a)));
    if (shared.length || sameAuthor) {
      breadth += b.weight * (sameAuthor || sharedSubs.length >= 2 ? 1 : 0.5);
      touched.push(b.bookId);
    }
    if (!shared.length) continue;
    const union = new Set([...b.topics, ...cTopics]).size;
    const sim = (shared.length / union) * Math.min(1, b.weight) * (sharedSubs.length >= 2 ? 1.6 : 1);
    if (sim > themes) {
      themes = sim;
      // Specific headings first, then genres and moods, as plain words.
      closest = { book: b, shared: [...new Set([...sharedSubs, ...shared].map((t) => t.replace(/^mood:/, "")))] };
    }
  }
  themes = Math.min(1, themes * 2.2);
  const library = Math.min(1, breadth / 3);

  // Popularity: Open Library editions, plus Dogear readers who loved it next to the reader's books.
  const readers = c.origins.filter((o): o is Extract<Origin, { kind: "readers" }> => o.kind === "readers");
  const readerCount = Math.max(0, ...readers.map((r) => r.count));
  const popularity = Math.min(1, c.popularity + 0.25 * readerCount);

  const components = { topic, author, themes, library, popularity };
  let score = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce((s, k) => s + WEIGHTS[k] * components[k], 0);
  // Mood overlap is a tie-breaker, never a reason by itself.
  score += 0.02 * Math.min(1, moodHits.length / 2);
  if (!c.coverUrl) score *= 0.9;

  // ── reasons: only from what matched, strongest first ───────────
  const reasons: (SuggestionReason & { strength: number })[] = [];
  const sources = new Set<string>();
  if (authorHit && author >= 0.55) {
    const best = authorHit.f?.books.slice().sort((a, b) => b.weight - a.weight)[0];
    reasons.push(
      best
        ? { kind: "author", author: authorHit.label, bookId: best.bookId, title: best.title, verb: best.verb, count: authorHit.f!.books.length, strength: WEIGHTS.author * author }
        : { kind: "author", author: authorHit.label, bookId: null, title: null, verb: "favourite", count: 0, strength: WEIGHTS.author * author },
    );
    if (best) sources.add(best.bookId);
  }
  if (closest && closest.shared.length >= 2) {
    reasons.push({ kind: "themes", bookId: closest.book.bookId, title: closest.book.title, shared: closest.shared.slice(0, 3), strength: WEIGHTS.themes * themes });
    sources.add(closest.book.bookId);
  }
  const topGenre = genreHits.sort((a, b) => b.f.weight - a.f.weight)[0];
  if (topGenre && topGenre.f.books.length >= 1) {
    const verb = topGenre.f.books.some((b) => b.verb === "loved" || b.verb === "read") ? "read" : "add";
    reasons.push({ kind: "genre", genre: topGenre.f.label, count: topGenre.f.books.length, verb, strength: WEIGHTS.topic * topic * 0.9 });
    topGenre.f.books.slice(0, 2).forEach((b) => sources.add(b.bookId));
  } else if (seedGenreHits[0]) {
    reasons.push({ kind: "genre", genre: seedGenreHits[0], count: 0, verb: "favourite", strength: WEIGHTS.topic * topic * 0.8 });
  }
  if (readerCount > 0) {
    const via = readers.flatMap((r) => r.viaBookIds).find((id) => p.books.some((b) => b.bookId === id));
    const viaBook = via ? p.books.find((b) => b.bookId === via) : null;
    reasons.push({ kind: "readers", count: readerCount, bookId: viaBook?.bookId ?? null, title: viaBook?.title ?? null, strength: WEIGHTS.popularity * popularity + 0.05 });
    if (viaBook) sources.add(viaBook.bookId);
  }
  const topSub = subHits.sort((a, b) => b.f.books.length - a.f.books.length || b.f.weight - a.f.weight)[0];
  if (topSub && !reasons.some((r) => r.kind === "themes")) {
    reasons.push({ kind: "subject", subject: topSub.s, count: topSub.f.books.length, strength: WEIGHTS.topic * topic * 0.7 });
    topSub.f.books.slice(0, 2).forEach((b) => sources.add(b.bookId));
  }
  // The most specific reason leads (a named author or book says more than a genre); strength breaks ties.
  const SPECIFIC = { author: 0, themes: 1, readers: 2, genre: 3, subject: 4 } as const;
  reasons.sort((a, b) => SPECIFIC[a.kind] - SPECIFIC[b.kind] || b.strength - a.strength);

  return {
    workKey: workKey(c),
    candidate: c,
    score: Math.round(Math.min(1, score) * 10000) / 10000,
    components,
    reasons: reasons.slice(0, 2).map((r) => {
      const { strength, ...reason } = r;
      void strength;
      return reason as SuggestionReason;
    }),
    sourceBookIds: [...sources].slice(0, 6),
  };
}

/**
 * Rank candidates for a reader: drop anything already shelved, dismissed or added before,
 * merge editions, score, and spread the top of the list across authors.
 */
export function rankCandidates(p: TasteProfile, candidates: Candidate[], opts: { exclude?: Iterable<string>; limit?: number } = {}): ScoredSuggestion[] {
  const excluded = new Set(opts.exclude ?? []);
  const scored = mergeCandidates(candidates)
    .filter((c) => !isOwned(p, c, excluded))
    .map((c) => scoreCandidate(p, c))
    .filter((s) => s.score >= MIN_SCORE && s.reasons.length > 0)
    .sort((a, b) => b.score - a.score || a.workKey.localeCompare(b.workKey));

  // At most two books by one author in each run of ten, so one prolific author can't fill the page.
  const out: ScoredSuggestion[] = [];
  const later: ScoredSuggestion[] = [];
  const perAuthor = new Map<string, number>();
  for (const s of scored) {
    const a = normAuthor(s.candidate.authors[0] ?? "");
    const n = perAuthor.get(a) ?? 0;
    if (n >= 2 && out.length < 10) later.push(s);
    else {
      out.push(s);
      perAuthor.set(a, n + 1);
    }
  }
  return [...out, ...later].slice(0, opts.limit ?? 40);
}

/** A short, plain sentence for one reason. Every noun in it came from matched metadata. */
export function explain(r: SuggestionReason): string {
  switch (r.kind) {
    case "author":
      if (!r.title) return `Because ${r.author} is one of your favourite authors.`;
      if (r.count > 1) return `Because you've added ${r.count} books by ${r.author}.`;
      return `Because you ${r.verb} ${r.title}, also by ${r.author}.`;
    case "themes":
      return `Similar themes to ${r.title}: ${listOf(r.shared)}.`;
    case "genre":
      if (r.verb === "favourite") return `Because ${r.genre} is one of your favourite genres.`;
      return r.verb === "read" ? `Because you enjoy ${r.genre}.` : `Because you've been adding ${r.genre}.`;
    case "readers":
      return r.title
        ? `${r.count === 1 ? "A reader" : `${r.count} readers`} who loved ${r.title} also loved this.`
        : `Loved by ${r.count === 1 ? "a reader" : `${r.count} readers`} with shelves like yours.`;
    case "subject":
      return r.count > 1 ? `${cap(r.subject)} runs through ${r.count} of your books.` : `Readers drawn to ${r.subject} often find this one.`;
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function listOf(xs: string[]) {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/** A fingerprint of the shelves: when it changes, suggestions are out of date. */
export function librarySignature(entries: Pick<LibraryEntry, "bookId" | "status" | "rating" | "favourite">[]): string {
  const parts = entries.map((e) => `${e.bookId}:${e.status}:${e.rating ?? ""}:${e.favourite ? 1 : 0}`).sort();
  // FNV-1a: short, stable, and good enough to notice a change.
  let h = 0x811c9dc5;
  for (const ch of parts.join(",")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${parts.length}-${h.toString(36)}`;
}

/** Some Open Library records are all lower case ("jamaica inn"); give those title case. */
export function displayTitle(t: string): string {
  if (/[A-Z]/.test(t)) return t;
  const small = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to"]);
  return t.replace(/\S+/g, (w, i: number) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)));
}

/** The display copy of a candidate, stored with the suggestion so the list needs no extra lookups. */
export function snapshot(c: Candidate): Book & { subjects: string[] } {
  return {
    id: c.bookId, slug: c.slug, title: displayTitle(c.title).slice(0, 300), subtitle: null, authors: c.authors.slice(0, 4), description: null,
    coverUrl: c.coverUrl, isbn13: c.isbn13, isbn10: null, olWorkId: c.olWorkId, olEditionId: c.olEditionId,
    publishedYear: c.publishedYear, publisher: null, pageCount: null, language: null,
    genres: c.genres.slice(0, 4), moods: c.moods.slice(0, 3), subjects: c.subjects.slice(0, 4),
  };
}
