import "server-only";
import type { DataStore } from "@/lib/data/store";
import { searchOpenLibrary } from "@/lib/openlibrary";
import type { Book } from "@/lib/types";

/** Our catalogue alone: answers in milliseconds. */
export function searchCatalogue(store: DataStore, query: string) {
  return store.searchBooks(query, 8) as Promise<Book[]>;
}

/** Our catalogue first, then Open Library, de-duplicated. */
export async function searchEverywhere(store: DataStore, query: string): Promise<Book[]> {
  const [local, remote] = await Promise.all([searchCatalogue(store, query), searchOpenLibrary(query, 12)]);
  const seen = new Set(local.flatMap((b) => [b.olWorkId, b.isbn13].filter(Boolean)));
  const titles = new Set(local.map((b) => `${b.title.toLowerCase()}|${b.authors[0]?.toLowerCase()}`));
  return [
    ...local,
    ...remote.filter((b) => !seen.has(b.olWorkId) && !(b.isbn13 && seen.has(b.isbn13)) && !titles.has(`${b.title.toLowerCase()}|${b.authors[0]?.toLowerCase()}`)),
  ].slice(0, 16);
}
