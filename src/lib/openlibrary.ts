import "server-only";
import type { Book, BookInput } from "@/lib/types";
import { coverFromId } from "@/lib/utils";

// Open Library API — https://openlibrary.org/developers/api
// All calls are server-side, cached for an hour, and time out quickly so a slow
// or unreachable Open Library never blocks a page: callers get [] / null instead.

const BASE = "https://openlibrary.org";
const HEADERS = { "User-Agent": "dogear/1.0 (social reading app)", Accept: "application/json" };

async function getJson<T>(path: string, revalidate = 3600): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: HEADERS,
      next: { revalidate },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const GENRE_KEYWORDS: [string, RegExp][] = [
  ["fantasy", /fantasy|magic|dragons|wizards/i],
  ["sci-fi", /science fiction|dystopi|space|robots|time travel/i],
  ["romance", /romance|love stories/i],
  ["horror", /horror|ghost|haunted|supernatural/i],
  ["gothic", /gothic/i],
  ["mystery", /mystery|detective|crime|thriller|suspense/i],
  ["historical fiction", /historical fiction|history/i],
  ["mythology", /mytholog|greek|legends/i],
  ["memoir", /memoir|biography|autobiography/i],
  ["poetry", /poetry|poems/i],
  ["essays", /essays/i],
  ["classics", /classic/i],
  ["dark academia", /universities and colleges|college students|boarding schools/i],
  ["contemporary", /contemporary|domestic fiction/i],
  ["literary fiction", /literary|psychological fiction|fiction, general/i],
];

export function subjectsToGenres(subjects: string[] = []): string[] {
  const joined = subjects.slice(0, 40).join(" | ");
  return GENRE_KEYWORDS.filter(([, re]) => re.test(joined)).map(([g]) => g).slice(0, 4);
}

interface SearchDoc {
  key: string;
  title: string;
  subtitle?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
  number_of_pages_median?: number;
  subject?: string[];
  publisher?: string[];
  cover_edition_key?: string;
  /** With `lang=en`, the edition that best matches the query (e.g. an English Penguin Classics printing). */
  editions?: { docs?: { key?: string; title?: string; cover_i?: number; publisher?: string[] }[] };
}

function docToBook(d: SearchDoc): Book {
  const ed = d.editions?.docs?.[0];
  const isbn13 = d.isbn?.find((i) => /^97[89]\d{10}$/.test(i)) ?? null;
  const isbn10 = d.isbn?.find((i) => /^\d{9}[\dX]$/.test(i)) ?? null;
  // Only Open Library's own cover ids: an ISBN cover URL is a guess, and for most obscure editions it 404s.
  return {
    id: null,
    slug: null,
    // A work's own record is often its first edition (Russian for Dostoevsky); show the matching English edition.
    title: ed?.title ?? d.title,
    subtitle: ed?.title ? null : d.subtitle ?? null,
    authors: d.author_name?.slice(0, 4) ?? [],
    description: null,
    coverUrl: ed?.cover_i ? coverFromId(ed.cover_i) : d.cover_i ? coverFromId(d.cover_i) : null,
    isbn13,
    isbn10,
    olWorkId: d.key.replace("/works/", ""),
    olEditionId: ed?.key?.match(/OL\d+M/)?.[0] ?? d.cover_edition_key ?? null,
    publishedYear: d.first_publish_year ?? null,
    publisher: ed?.publisher?.[0] ?? d.publisher?.[0] ?? null,
    pageCount: d.number_of_pages_median ?? null,
    language: null,
    genres: subjectsToGenres(d.subject),
    moods: [],
  };
}

// Search asks only for what a result row shows. ISBNs and subjects (hundreds per popular work) made each
// response ~8× larger; they're fetched once, when a book is actually added (see getOpenLibraryWork).
const FIELDS =
  "key,title,subtitle,author_name,first_publish_year,cover_i,number_of_pages_median,cover_edition_key,editions,editions.key,editions.title,editions.cover_i,editions.publisher";

export async function searchOpenLibrary(q: string, limit = 20): Promise<Book[]> {
  if (!q.trim()) return [];
  const data = await getJson<{ docs: SearchDoc[] }>(
    `/search.json?q=${encodeURIComponent(q)}&limit=${limit}&lang=en&fields=${FIELDS}`,
  );
  return (data?.docs ?? []).filter((d) => d.key?.startsWith("/works/")).map(docToBook);
}

export async function openLibrarySubject(subject: string, limit = 18): Promise<Book[]> {
  const data = await getJson<{ works: { key: string; title: string; authors: { name: string }[]; cover_id?: number; first_publish_year?: number }[] }>(
    `/subjects/${encodeURIComponent(subject.toLowerCase().replace(/\s+/g, "_"))}.json?limit=${limit}`,
    86_400,
  );
  return (data?.works ?? []).map((w) => ({
    id: null, slug: null, title: w.title, subtitle: null, authors: w.authors.map((a) => a.name), description: null,
    coverUrl: w.cover_id ? coverFromId(w.cover_id) : null, isbn13: null, isbn10: null, olWorkId: w.key.replace("/works/", ""),
    olEditionId: null, publishedYear: w.first_publish_year ?? null, publisher: null, pageCount: null, language: null,
    genres: [subject], moods: [],
  }));
}

interface WorkJson {
  title: string;
  subtitle?: string;
  description?: string | { value: string };
  covers?: number[];
  subjects?: string[];
  authors?: { author: { key: string } }[];
  first_publish_date?: string;
}
/** Full details for a work, used when someone adds or opens a book that isn't in our catalogue yet. */
interface EditionJson {
  title?: string;
  subtitle?: string;
  covers?: number[];
  publishers?: string[];
  number_of_pages?: number;
  isbn_13?: string[];
  isbn_10?: string[];
  works?: { key: string }[];
  languages?: { key: string }[];
}

/**
 * Full details for a work, used when someone adds or opens a book that isn't in our catalogue yet.
 * `olEditionId` is the edition the reader picked in search (say, Penguin Classics): its title, cover,
 * publisher, pages and ISBN win over the work's, which often describe the first, untranslated edition.
 */
export async function getOpenLibraryWork(olWorkId: string, olEditionId?: string | null): Promise<BookInput | null> {
  if (!/^OL\d+W$/.test(olWorkId)) return null;
  const editionId = olEditionId && /^OL\d+M$/.test(olEditionId) ? olEditionId : null;
  // One round trip: the work record (description, subjects, covers) alongside the search index's summary of
  // the same work (author names, page count, ISBNs, publisher), instead of work → editions → each author.
  const [work, indexed, edition] = await Promise.all([
    getJson<WorkJson>(`/works/${olWorkId}.json`, 86_400),
    getJson<{ docs: (SearchDoc & { language?: string[] })[] }>(
      `/search.json?q=${encodeURIComponent(`key:/works/${olWorkId}`)}&limit=1&fields=key,author_name,cover_i,number_of_pages_median,isbn,publisher,first_publish_year,cover_edition_key,language`,
      86_400,
    ),
    editionId ? getJson<EditionJson>(`/books/${editionId}.json`, 86_400) : Promise.resolve(null),
  ]);
  if (!work) return null;
  // Ignore an edition that belongs to some other work.
  const ed = edition?.works?.some((w) => w.key === `/works/${olWorkId}`) ? edition : null;
  const doc = indexed?.docs?.[0];
  let authors = doc?.author_name?.slice(0, 3) ?? [];
  if (!authors.length) {
    // The search index can lag behind a newly added work; fall back to the author records.
    const names = await Promise.all(
      (work.authors ?? []).slice(0, 3).map(async (a) => (await getJson<{ name: string }>(`${a.author.key}.json`, 86_400))?.name),
    );
    authors = names.filter(Boolean) as string[];
  }
  const isbn13 = [...(ed?.isbn_13 ?? []), ...(doc?.isbn ?? [])].find((i) => /^97[89]\d{10}$/.test(i)) ?? null;
  const isbn10 = [...(ed?.isbn_10 ?? []), ...(doc?.isbn ?? [])].find((i) => /^\d{9}[\dX]$/.test(i)) ?? null;
  const description = typeof work.description === "string" ? work.description : work.description?.value ?? null;
  const year = doc?.first_publish_year ?? (Number((work.first_publish_date ?? "").match(/\d{4}/)?.[0]) || null);
  const coverId = ed?.covers?.find((c) => c > 0) ?? work.covers?.find((c) => c > 0) ?? doc?.cover_i;
  const pages = ed?.number_of_pages ?? doc?.number_of_pages_median;
  return {
    title: ed?.title ?? work.title,
    subtitle: ed ? ed.subtitle ?? null : work.subtitle ?? null,
    authors,
    description: description ? cleanDescription(description) : null,
    coverUrl: coverId ? coverFromId(coverId) : null,
    isbn13,
    isbn10,
    olWorkId,
    olEditionId: ed ? editionId : doc?.cover_edition_key?.match(/^OL\d+M$/)?.[0] ?? null,
    publishedYear: year,
    publisher: ed?.publishers?.[0] ?? doc?.publisher?.[0] ?? null,
    pageCount: pages && pages > 0 && pages < 20000 ? pages : null,
    language: ed ? (ed.languages?.[0]?.key === "/languages/eng" ? "English" : null) : doc?.language?.[0] === "eng" ? "English" : null,
    genres: subjectsToGenres(work.subjects),
    moods: [],
  };
}

function cleanDescription(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/-{3,}[\s\S]*$/, "")
    .replace(/\r/g, "")
    .trim()
    .slice(0, 3000);
}
