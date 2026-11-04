import "server-only";
import type { Book, BookInput } from "@/lib/types";
import { coverFromId, coverFromIsbn } from "@/lib/utils";

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
}

function docToBook(d: SearchDoc): Book {
  const isbn13 = d.isbn?.find((i) => /^97[89]\d{10}$/.test(i)) ?? null;
  const isbn10 = d.isbn?.find((i) => /^\d{9}[\dX]$/.test(i)) ?? null;
  return {
    id: null,
    slug: null,
    title: d.title,
    subtitle: d.subtitle ?? null,
    authors: d.author_name?.slice(0, 4) ?? [],
    description: null,
    coverUrl: d.cover_i ? coverFromId(d.cover_i) : isbn13 ? coverFromIsbn(isbn13) : null,
    isbn13,
    isbn10,
    olWorkId: d.key.replace("/works/", ""),
    olEditionId: d.cover_edition_key ?? null,
    publishedYear: d.first_publish_year ?? null,
    publisher: d.publisher?.[0] ?? null,
    pageCount: d.number_of_pages_median ?? null,
    language: null,
    genres: subjectsToGenres(d.subject),
    moods: [],
  };
}

const FIELDS = "key,title,subtitle,author_name,first_publish_year,cover_i,isbn,number_of_pages_median,subject,publisher,cover_edition_key";

export async function searchOpenLibrary(q: string, limit = 20): Promise<Book[]> {
  if (!q.trim()) return [];
  const data = await getJson<{ docs: SearchDoc[] }>(
    `/search.json?q=${encodeURIComponent(q)}&limit=${limit}&fields=${FIELDS}`,
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
interface EditionsJson {
  entries: { isbn_13?: string[]; isbn_10?: string[]; number_of_pages?: number; publishers?: string[]; publish_date?: string; key: string; languages?: { key: string }[] }[];
}

/** Full details for a work, used when someone opens a book that isn't in our catalogue yet. */
export async function getOpenLibraryWork(olWorkId: string): Promise<BookInput | null> {
  if (!/^OL\d+W$/.test(olWorkId)) return null;
  const [work, editions] = await Promise.all([
    getJson<WorkJson>(`/works/${olWorkId}.json`, 86_400),
    getJson<EditionsJson>(`/works/${olWorkId}/editions.json?limit=8`, 86_400),
  ]);
  if (!work) return null;
  const authorNames = await Promise.all(
    (work.authors ?? []).slice(0, 3).map(async (a) => (await getJson<{ name: string }>(`${a.author.key}.json`, 86_400))?.name),
  );
  const ed = editions?.entries.find((e) => e.isbn_13?.length) ?? editions?.entries[0];
  const isbn13 = ed?.isbn_13?.find((i) => /^97[89]\d{10}$/.test(i)) ?? null;
  const description = typeof work.description === "string" ? work.description : work.description?.value ?? null;
  const year = Number((work.first_publish_date ?? ed?.publish_date ?? "").match(/\d{4}/)?.[0]) || null;
  return {
    title: work.title,
    subtitle: work.subtitle ?? null,
    authors: authorNames.filter(Boolean) as string[],
    description: description ? cleanDescription(description) : null,
    coverUrl: work.covers?.find((c) => c > 0) ? coverFromId(work.covers.find((c) => c > 0)!) : isbn13 ? coverFromIsbn(isbn13) : null,
    isbn13,
    isbn10: ed?.isbn_10?.[0] && /^\d{9}[\dX]$/.test(ed.isbn_10[0]) ? ed.isbn_10[0] : null,
    olWorkId,
    olEditionId: ed?.key?.replace("/books/", "").match(/^OL\d+M$/)?.[0] ?? null,
    publishedYear: year,
    publisher: ed?.publishers?.[0] ?? null,
    pageCount: ed?.number_of_pages && ed.number_of_pages > 0 && ed.number_of_pages < 20000 ? ed.number_of_pages : null,
    language: ed?.languages?.[0]?.key === "/languages/eng" ? "English" : null,
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
