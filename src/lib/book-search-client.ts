import type { Book } from "@/lib/types";

// Client-side book search for pickers. Answers are remembered for the session, so backspacing or retyping
// a query is instant, and each call takes an AbortSignal so a superseded keystroke stops waiting.
const cache = new Map<string, Book[]>();
const MAX_CACHED = 100;

export type BookSearchScope = "catalogue" | "all";

export async function searchBooks(q: string, scope: BookSearchScope, signal?: AbortSignal): Promise<Book[]> {
  const query = q.trim().toLowerCase();
  const key = `${scope}:${query}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const res = await fetch(`/api/books/search?scope=${scope}&q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Search isn't working right now. Please try again.");
  }
  const books = (await res.json()) as Book[];
  // A full search that found nothing may just be Open Library timing out: don't remember it.
  if (books.length || scope === "catalogue") {
    if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
    cache.set(key, books);
  }
  return books;
}

/** The full result, if this query was already searched: lets a picker skip the loading state entirely. */
export function cachedBooks(q: string): Book[] | undefined {
  return cache.get(`all:${q.trim().toLowerCase()}`);
}

export const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";
