"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStore } from "@/lib/auth";
import { bookRef } from "@/lib/book-ref";
import { getOpenLibraryByIsbn, searchOpenLibrary } from "@/lib/openlibrary";
import { resolveBook, run } from "@/lib/server-action";
import type { SavedBook } from "@/lib/types";
import { refreshSuggestionsSoon } from "@/lib/suggestions/trigger";

const row = z.object({
  title: z.string().trim().min(1).max(300),
  author: z.string().trim().max(120),
  isbn: z.string().regex(/^\d{9}[\dX]$/).nullable(),
  isbn13: z.string().regex(/^97[89]\d{10}$/).nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  shelf: z.enum(["read", "reading", "want_to_read", "dnf"]).nullable(),
  dateRead: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  shelves: z.array(z.string().max(40)).max(10),
});

export type ImportOutcome = "imported" | "updated" | "skipped" | "unmatched" | "unsupported";

const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Find the book: our catalogue by ISBN, then Open Library by ISBN, then by title and author. */
async function match(store: Awaited<ReturnType<typeof getStore>>, r: z.infer<typeof row>): Promise<SavedBook | null> {
  for (const isbn of [r.isbn13, r.isbn].filter((x): x is string => Boolean(x))) {
    if (isbn.length === 13) {
      const [local] = await store.searchBooks(isbn, 1);
      if (local) return local;
    }
    const remote = await getOpenLibraryByIsbn(isbn);
    if (remote?.olWorkId) return (await store.getBookByOlWorkId(remote.olWorkId)) ?? store.upsertBook(remote);
  }
  // Goodreads titles carry series notes: "Piranesi (Hardcover)", "The Hobbit (Middle-earth #0)".
  const title = r.title.replace(/\s*\([^)]*\)\s*$/, "");
  const surname = norm(r.author.split(" ").at(-1) ?? "");
  const hits = await searchOpenLibrary(`${title} ${r.author}`, 6);
  // Only a confident match: the author has to agree. Anything else is reported, not guessed.
  const hit = hits.find((b) => surname && b.authors.some((a) => norm(a).includes(surname)) && norm(b.title).startsWith(norm(title).slice(0, 12)));
  return hit ? resolveBook(store, bookRef(hit)) : null;
}

/** Import one Goodreads row. The browser sends rows one by one so progress is visible and failures retryable. */
export async function importGoodreadsRowAction(input: z.input<typeof row>, overwrite: boolean) {
  return run(async (): Promise<{ outcome: ImportOutcome; book: { title: string; slug: string } | null }> => {
    const r = row.parse(input);
    if (!r.shelf) return { outcome: "unsupported", book: null };
    const store = await getStore();
    const book = await match(store, r);
    if (!book) return { outcome: "unmatched", book: null };
    const outcome = await store.importShelfEntry({
      bookId: book.id, status: r.shelf, rating: r.rating, finishedOn: r.shelf === "read" ? r.dateRead : null, shelves: r.shelves, overwrite: z.boolean().parse(overwrite),
    });
    return { outcome, book: { title: book.title, slug: book.slug } };
  });
}

/** Once an import finishes: refresh shelves, stats and recaps. */
export async function finishImportAction() {
  return run(async () => {
    revalidatePath("/", "layout");
    // Once per import, not per row: the whole new library feeds one rebuild.
    refreshSuggestionsSoon();
  });
}
