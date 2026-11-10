"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStore } from "@/lib/auth";
import { bookRef } from "@/lib/book-ref";
import { NotFoundError } from "@/lib/data/store";
import { resolveBook, run } from "@/lib/server-action";
import { refreshSuggestionsSoon } from "@/lib/suggestions/trigger";

const id = z.string().uuid();

/** The next page of waiting suggestions. */
export async function loadSuggestionsAction(cursor: string | null) {
  return run(async () => (await getStore()).listSuggestions(z.string().regex(/^\d{1,4}$/).nullable().parse(cursor), 12));
}

/** "Not for me": hidden for good (Undo puts it back). */
export async function dismissSuggestionAction(suggestionId: string) {
  return run(async () => {
    await (await getStore()).setSuggestionStatus(id.parse(suggestionId), "dismissed");
  });
}

export async function restoreSuggestionAction(suggestionId: string) {
  return run(async () => {
    await (await getStore()).setSuggestionStatus(id.parse(suggestionId), "suggested");
  });
}

/**
 * Put a suggested book on Want to Read. A book already on one of your shelves stays where it is
 * (this never moves a finished book back). Returns the shelf undo record when it moved anything.
 */
export async function addSuggestionAction(suggestionId: string) {
  return run(async () => {
    const store = await getStore();
    const s = await store.getSuggestion(id.parse(suggestionId));
    if (!s) throw new NotFoundError("That suggestion is gone.");
    const book = await resolveBook(store, bookRef(s.book));
    const current = await store.getUserBook(book.id);
    const move = current?.status ? null : await store.setShelfStatus(book.id, "want_to_read", {});
    await store.setSuggestionStatus(s.id, "added");
    // Home and the book page show the new shelf; this list updates itself on the client.
    revalidatePath("/home");
    revalidatePath(`/book/${book.slug}`);
    refreshSuggestionsSoon();
    return { book, alreadyShelved: Boolean(current?.status), undo: move?.undo ?? null };
  });
}
