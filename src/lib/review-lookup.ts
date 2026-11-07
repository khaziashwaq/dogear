import "server-only";
import { cache } from "react";
import { getStore } from "@/lib/auth";
import { lookupProfile } from "@/lib/profile-lookup";
import type { Review } from "@/lib/types";

/**
 * Resolve /u/<username>/reviews/<book-slug>[?r=<id>] to a review the current
 * visitor may see. Visibility is enforced by the store (RLS in Supabase, the
 * same rules in code for the demo), so a signed-out visitor only ever gets a
 * public review. Shared by the page, its metadata and its share-card image.
 */
export const lookupReview = cache(async (username: string, bookSlug: string, pinned?: string | null): Promise<{ review: Review; earlier: Review[] } | null> => {
  const profile = await lookupProfile(username);
  if (!profile) return null;
  const store = await getStore();
  const book = await store.getBookBySlug(decodeURIComponent(bookSlug).toLowerCase());
  if (!book) return null;
  const reviews = (await store.listReviewsByUser(profile.id, 200)).filter((r) => r.bookId === book.id);
  if (reviews.length === 0) return null;
  const review = (pinned && reviews.find((r) => r.id === pinned)) || reviews[0];
  return { review, earlier: reviews.filter((r) => r.id !== review.id) };
});
