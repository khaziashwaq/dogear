import "server-only";
import { cache } from "react";
import { getStore } from "@/lib/auth";
import { getOpenLibraryWork } from "@/lib/openlibrary";
import type { Book } from "@/lib/types";
import { isOlWorkId } from "@/lib/utils";

/** Resolve a /book/[key] param: our slug, or an Open Library work id (OL…W). */
export const lookupBook = cache(async (key: string): Promise<Book | null> => {
  const store = await getStore();
  if (isOlWorkId(key)) {
    const saved = await store.getBookByOlWorkId(key);
    if (saved) return saved;
    const remote = await getOpenLibraryWork(key);
    return remote ? { ...remote, id: null, slug: null } : null;
  }
  return store.getBookBySlug(key.toLowerCase());
});
