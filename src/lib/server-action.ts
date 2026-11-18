import "server-only";
import { after } from "next/server";
import { z } from "zod";
import { AuthError, NotFoundError, RateLimitError, ValidationError } from "@/lib/data/store";
import type { Result } from "@/lib/action-result";
import { getOpenLibraryWork } from "@/lib/openlibrary";
import type { DataStore } from "@/lib/data/store";
import type { BookInput, SavedBook } from "@/lib/types";

export async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Please check the form." };
    if (e instanceof AuthError || e instanceof NotFoundError || e instanceof ValidationError || e instanceof RateLimitError) return { ok: false, error: e.message };
    // Next.js control-flow errors (redirect/notFound) must propagate.
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error("[dogear action]", e);
    // In development, say what actually broke (a missing env var, a failed query) instead of hiding it.
    if (process.env.NODE_ENV === "development" && e instanceof Error) return { ok: false, error: e.message };
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

const nullableStr = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));

export const bookInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  subtitle: nullableStr(300),
  authors: z.array(z.string().trim().min(1).max(120)).max(6),
  description: nullableStr(3000),
  coverUrl: z.string().url().max(500).refine((u) => u.startsWith("https://covers.openlibrary.org/"), "Unsupported cover host").nullable().optional().transform((v) => v ?? null),
  isbn13: z.string().regex(/^97[89]\d{10}$/).nullable().optional().transform((v) => v ?? null),
  isbn10: z.string().regex(/^\d{9}[\dX]$/).nullable().optional().transform((v) => v ?? null),
  olWorkId: z.string().regex(/^OL\d+W$/).nullable().optional().transform((v) => v ?? null),
  olEditionId: z.string().regex(/^OL\d+M$/).nullable().optional().transform((v) => v ?? null),
  publishedYear: z.number().int().min(-3000).max(2100).nullable().optional().transform((v) => v ?? null),
  publisher: nullableStr(200),
  pageCount: z.number().int().min(1).max(20000).nullable().optional().transform((v) => v ?? null),
  language: nullableStr(40),
  genres: z.array(z.string().max(40)).max(8).default([]),
  moods: z.array(z.string().max(40)).max(8).default([]),
});

export const bookRefSchema = z.object({
  id: z.string().min(1).nullable().optional(),
  olWorkId: z.string().regex(/^OL\d+W$/).nullable().optional(),
  fallback: bookInputSchema.optional(),
});
export type BookRefInput = z.input<typeof bookRefSchema>;

/**
 * Turn a reference from the client into a catalogue book, adding it from Open Library
 * the first time anyone interacts with it. The canonical work metadata is fetched
 * server-side; the client's copy is only used if Open Library is unreachable.
 *
 * `fast`: Open Library often takes several seconds per call, so for a quick shelf move save the book
 * straight away from the search result the reader picked, then replace its details with the canonical
 * record once the response has gone out. Only the slug, made from the search result's title, is kept.
 */
export async function resolveBook(store: DataStore, raw: BookRefInput, opts: { fast?: boolean } = {}): Promise<SavedBook> {
  const ref = bookRefSchema.parse(raw);
  if (ref.id) {
    const b = await store.getBookById(ref.id);
    if (!b) throw new NotFoundError("Book not found");
    return b;
  }
  if (!ref.olWorkId) throw new ValidationError("Missing book reference.");
  const olWorkId = ref.olWorkId;
  const existing = await store.getBookByOlWorkId(olWorkId);
  if (existing) return existing;
  const fallback = ref.fallback ? { ...ref.fallback, olWorkId } : null;

  if (opts.fast && fallback) {
    const saved = await store.upsertBook(fallback);
    // upsertBook returns an existing row on an ISBN match; only enrich a row for this work. Always enrich, even
    // when the client sent a description: subjects and moods only come from the server's own fetch.
    if (saved.olWorkId === olWorkId) {
      after(async () => {
        try {
          const remote = await getOpenLibraryWork(olWorkId, fallback.olEditionId, 15_000);
          if (remote) await store.fillBookDetails(saved.id, mergeFallback(remote, fallback));
        } catch (err) {
          console.warn("[dogear] background book details failed", olWorkId, err);
        }
      });
    }
    return saved;
  }

  const remote = await getOpenLibraryWork(olWorkId, fallback?.olEditionId);
  const input = remote ? mergeFallback(remote, fallback) : fallback;
  if (!input) throw new NotFoundError("Couldn't load that book from Open Library.");
  return store.upsertBook(input);
}

/** Search results often carry a better cover / page count than the work record. */
function mergeFallback(remote: BookInput, fallback: BookInput | null): BookInput {
  if (!fallback) return remote;
  remote.coverUrl ??= fallback.coverUrl;
  remote.pageCount ??= fallback.pageCount;
  remote.isbn13 ??= fallback.isbn13;
  if (!remote.genres.length) remote.genres = fallback.genres;
  return remote;
}
