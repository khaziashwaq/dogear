"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStore } from "@/lib/auth";
import { resolveBook, run, type BookRefInput } from "@/lib/server-action";
import { searchOpenLibrary } from "@/lib/openlibrary";
import { refreshSuggestionsSoon } from "@/lib/suggestions/trigger";
import type { Book, ShelfStatus } from "@/lib/types";

const status = z.enum(["want_to_read", "reading", "read", "dnf"]).nullable();

function touch(slug: string) {
  revalidatePath(`/book/${slug}`);
  revalidatePath("/", "layout");
}

export async function ensureBookAction(ref: BookRefInput) {
  return run(async () => resolveBook(await getStore(), ref));
}

const moveOptions = z
  .object({
    reread: z.boolean().optional(),
    share: z.boolean().optional(),
    visibility: z.enum(["public", "followers", "private"]).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  })
  .default({});

/** Move a book between shelves. Never posts unless `share` is set; returns an undo record for a few minutes. */
export async function setShelfStatusAction(ref: BookRefInput, value: ShelfStatus | null, opts?: z.input<typeof moveOptions>) {
  return run(async () => {
    const store = await getStore();
    const book = await resolveBook(store, ref);
    const move = await store.setShelfStatus(book.id, status.parse(value), moveOptions.parse(opts));
    touch(book.slug);
    if (move.changed) refreshSuggestionsSoon();
    return { book, ...move };
  });
}

const logSchema = z.object({
  finishedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  rating: z.number().min(0.5).max(5).multipleOf(0.5).nullable(),
  reread: z.boolean(),
  notes: z.string().trim().max(2000).nullable().transform((v) => v || null),
  review: z
    .object({ title: z.string().trim().max(140).nullable(), body: z.string().trim().min(1).max(20000), containsSpoilers: z.boolean() })
    .nullable(),
  quote: z.object({ body: z.string().trim().min(1).max(2000), page: z.string().trim().max(20).nullable() }).nullable(),
  visibility: z.enum(["public", "followers", "private"]),
  share: z.boolean(),
});

/** "I finished this": one atomic write for the diary, the Read shelf, rating, and anything optional. */
export async function logBookAction(ref: BookRefInput, input: z.input<typeof logSchema>) {
  return run(async () => {
    const store = await getStore();
    const book = await resolveBook(store, ref);
    const result = await store.logBook({ bookId: book.id, ...logSchema.parse(input) });
    touch(book.slug);
    refreshSuggestionsSoon();
    return { book, result, userBook: await store.getUserBook(book.id) };
  });
}

/** Put a recent shelf move back. The record only ever reaches the caller's own rows. */
export async function undoShelfMoveAction(undo: Record<string, unknown>) {
  return run(async () => {
    const store = await getStore();
    const record = z.record(z.string(), z.unknown()).refine((r) => typeof r.book_id === "string", "Nothing to undo").parse(undo);
    const userBook = await store.undoShelfMove(record);
    revalidatePath("/", "layout");
    refreshSuggestionsSoon();
    return { userBook };
  });
}

export async function setRatingAction(ref: BookRefInput, rating: number | null) {
  return run(async () => {
    const store = await getStore();
    const book = await resolveBook(store, ref);
    const ub = await store.setRating(book.id, z.number().min(0).max(5).nullable().parse(rating));
    touch(book.slug);
    refreshSuggestionsSoon();
    return { book, userBook: ub };
  });
}

export async function setFavouriteAction(ref: BookRefInput, favourite: boolean) {
  return run(async () => {
    const store = await getStore();
    const book = await resolveBook(store, ref);
    const ub = await store.setFavourite(book.id, favourite);
    touch(book.slug);
    return { book, userBook: ub };
  });
}

export async function setCustomShelvesAction(bookId: string, shelves: string[]) {
  return run(async () => {
    const store = await getStore();
    const ub = await store.setCustomShelves(z.string().parse(bookId), z.array(z.string().max(40)).max(20).parse(shelves));
    revalidatePath("/", "layout");
    return ub;
  });
}

export async function setProgressAction(bookId: string, pages: number | null) {
  return run(async () => {
    const store = await getStore();
    const ub = await store.setProgress(z.string().parse(bookId), z.number().int().min(0).max(20000).nullable().parse(pages));
    revalidatePath("/", "layout");
    return ub;
  });
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const sessionSchema = z.object({
  bookId: z.string(),
  status: z.enum(["reading", "finished", "abandoned"]),
  startedOn: date,
  finishedOn: date,
  isReread: z.boolean(),
  notes: z.string().trim().max(2000).transform((v) => v || null).nullable(),
});

export async function addSessionAction(input: z.input<typeof sessionSchema>) {
  return run(async () => {
    const store = await getStore();
    const session = await store.addSession(sessionSchema.parse(input));
    revalidatePath("/", "layout");
    return session;
  });
}

export async function deleteSessionAction(sessionId: string) {
  return run(async () => {
    await (await getStore()).deleteSession(z.string().parse(sessionId));
    revalidatePath("/", "layout");
  });
}

/** Book picker, first pass: just our catalogue, which answers in milliseconds while Open Library takes a second or two. */
export async function searchCatalogueAction(q: string) {
  return run(async () => {
    const query = z.string().trim().max(120).parse(q);
    if (query.length < 2) return [] as Book[];
    return (await (await getStore()).searchBooks(query, 8)) as Book[];
  });
}

/** Book picker search: our catalogue first, then Open Library, de-duplicated. */
export async function searchBooksAction(q: string) {
  return run(async () => {
    const query = z.string().trim().max(120).parse(q);
    if (query.length < 2) return [] as Book[];
    const store = await getStore();
    const [local, remote] = await Promise.all([store.searchBooks(query, 8), searchOpenLibrary(query, 12)]);
    const seen = new Set(local.flatMap((b) => [b.olWorkId, b.isbn13].filter(Boolean)));
    const titles = new Set(local.map((b) => `${b.title.toLowerCase()}|${b.authors[0]?.toLowerCase()}`));
    return [
      ...local,
      ...remote.filter((b) => !seen.has(b.olWorkId) && !(b.isbn13 && seen.has(b.isbn13)) && !titles.has(`${b.title.toLowerCase()}|${b.authors[0]?.toLowerCase()}`)),
    ].slice(0, 16) as Book[];
  });
}
