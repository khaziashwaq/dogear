"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { imageUrl } from "@/lib/validation";
import { getStore } from "@/lib/auth";
import { resolveBook, run, type BookRefInput } from "@/lib/server-action";

const visibility = z.enum(["public", "followers", "private"]);
const id = z.string().min(1).max(64);

// ── reviews ────────────────────────────────────────────────────────────
const reviewSchema = z.object({
  rating: z.number().min(0.5).max(5).multipleOf(0.5).nullable(),
  title: z.string().trim().max(140).transform((v) => v || null).nullable(),
  body: z.string().trim().min(1, "Write a few words, at least.").max(20000),
  containsSpoilers: z.boolean(),
  isReread: z.boolean(),
  visibility,
});

export async function createReviewAction(book: BookRefInput, input: z.input<typeof reviewSchema>) {
  return run(async () => {
    const store = await getStore();
    const b = await resolveBook(store, book);
    const review = await store.createReview({ ...reviewSchema.parse(input), bookId: b.id });
    revalidatePath("/", "layout");
    return review;
  });
}

export async function updateReviewAction(reviewId: string, input: z.input<typeof reviewSchema>) {
  return run(async () => {
    const store = await getStore();
    const existing = await store.getReview(id.parse(reviewId));
    if (!existing) throw new Error("Review not found");
    const review = await store.updateReview(reviewId, { ...reviewSchema.parse(input), bookId: existing.bookId });
    revalidatePath("/", "layout");
    return review;
  });
}

export async function deleteReviewAction(reviewId: string) {
  return run(async () => {
    await (await getStore()).deleteReview(id.parse(reviewId));
    revalidatePath("/", "layout");
  });
}

// ── quotes ─────────────────────────────────────────────────────────────
const tag = z
  .string()
  .transform((t) => t.trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "").slice(0, 32))
  .refine((t) => t.length > 0);
const quoteSchema = z.object({
  body: z.string().trim().min(1, "Type or paste the passage first.").max(2000),
  page: z.string().trim().max(20).transform((v) => v || null).nullable(),
  commentary: z.string().trim().max(1000).transform((v) => v || null).nullable(),
  visibility,
  highlight: z.enum(["butter", "sage", "rose", "lavender", "blue"]),
  tags: z
    .array(z.string())
    .max(20)
    .transform((ts) => [...new Set(ts.map((t) => tag.safeParse(t)).flatMap((r) => (r.success ? [r.data] : [])))].slice(0, 8)),
  isDraft: z.boolean(),
});

export async function createQuoteAction(book: BookRefInput, input: z.input<typeof quoteSchema>) {
  return run(async () => {
    const store = await getStore();
    const b = await resolveBook(store, book);
    const quote = await store.createQuote({ ...quoteSchema.parse(input), bookId: b.id });
    revalidatePath("/", "layout");
    return quote;
  });
}

export async function updateQuoteAction(quoteId: string, input: z.input<typeof quoteSchema>) {
  return run(async () => {
    const store = await getStore();
    const existing = await store.getQuote(id.parse(quoteId));
    if (!existing) throw new Error("That annotation couldn't be found.");
    const quote = await store.updateQuote(quoteId, { ...quoteSchema.parse(input), bookId: existing.bookId });
    revalidatePath("/", "layout");
    return quote;
  });
}

export async function deleteQuoteAction(quoteId: string) {
  return run(async () => {
    await (await getStore()).deleteQuote(id.parse(quoteId));
    revalidatePath("/", "layout");
  });
}

// ── lists ──────────────────────────────────────────────────────────────
const listSchema = z.object({
  title: z.string().trim().min(1, "Give your list a title.").max(120),
  description: z.string().trim().max(2000).transform((v) => v || null).nullable(),
  coverStyle: z.enum(["rose", "sage", "butter", "burgundy", "ink", "collage"]),
  coverImageUrl: imageUrl(),
  visibility,
  isRanked: z.boolean(),
});

export async function createListAction(input: z.input<typeof listSchema>, books: BookRefInput[] = []) {
  return run(async () => {
    const store = await getStore();
    const list = await store.createList(listSchema.parse(input));
    for (const ref of books.slice(0, 100)) {
      const b = await resolveBook(store, ref);
      await store.addBookToList(list.id, b.id, null);
    }
    revalidatePath("/", "layout");
    return list;
  });
}

export async function updateListAction(listId: string, input: z.input<typeof listSchema>) {
  return run(async () => {
    const list = await (await getStore()).updateList(id.parse(listId), listSchema.parse(input));
    revalidatePath("/", "layout");
    return list;
  });
}

export async function deleteListAction(listId: string) {
  return run(async () => {
    await (await getStore()).deleteList(id.parse(listId));
    revalidatePath("/", "layout");
  });
}

export async function addToListAction(listId: string, book: BookRefInput, note: string | null) {
  return run(async () => {
    const store = await getStore();
    const b = await resolveBook(store, book);
    await store.addBookToList(id.parse(listId), b.id, z.string().trim().max(500).nullable().parse(note) || null);
    revalidatePath(`/lists/${listId}`);
    return b;
  });
}

export async function removeFromListAction(listId: string, bookId: string) {
  return run(async () => {
    await (await getStore()).removeBookFromList(id.parse(listId), id.parse(bookId));
    revalidatePath(`/lists/${listId}`);
  });
}

export async function updateListBookAction(listId: string, bookId: string, note: string | null, image: string | null) {
  return run(async () => {
    await (await getStore()).updateListBook(id.parse(listId), id.parse(bookId), z.string().trim().max(500).nullable().parse(note) || null, imageUrl().parse(image));
    revalidatePath(`/lists/${listId}`);
  });
}

export async function reorderListAction(listId: string, bookIds: string[]) {
  return run(async () => {
    await (await getStore()).reorderList(id.parse(listId), z.array(id).max(500).parse(bookIds));
    revalidatePath(`/lists/${listId}`);
  });
}

export async function toggleListFollowAction(listId: string, follow: boolean) {
  return run(async () => {
    const store = await getStore();
    if (follow) await store.followList(id.parse(listId));
    else await store.unfollowList(id.parse(listId));
    revalidatePath(`/lists/${listId}`);
  });
}

export async function myListsAction() {
  return run(async () => {
    const store = await getStore();
    if (!store.viewerId) return [];
    return store.listListsByUser(store.viewerId);
  });
}

// ── marginalia ─────────────────────────────────────────────────────────
const marginaliaQuery = z.object({
  tab: z.enum(["following", "popular", "recent"]),
  genre: z.string().max(60).nullable().optional(),
  bookId: z.string().max(80).nullable().optional(),
  tag: z.string().max(40).nullable().optional(),
});

export async function loadMarginaliaAction(query: z.input<typeof marginaliaQuery>, cursor: string | null) {
  return run(async () => (await getStore()).listMarginalia(marginaliaQuery.parse(query), z.string().max(200).nullable().parse(cursor)));
}
