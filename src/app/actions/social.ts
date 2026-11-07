"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStore } from "@/lib/auth";
import { resolveBook, run, type BookRefInput } from "@/lib/server-action";

const id = z.string().min(1).max(64);

export async function toggleFollowAction(targetId: string, follow: boolean) {
  return run(async () => {
    const store = await getStore();
    if (follow) await store.follow(id.parse(targetId));
    else await store.unfollow(id.parse(targetId));
    revalidatePath("/", "layout");
  });
}

export async function toggleLikeAction(postId: string, on: boolean) {
  return run(async () => {
    const store = await getStore();
    if (on) await store.like(id.parse(postId));
    else await store.unlike(id.parse(postId));
  });
}

export async function toggleBookmarkAction(postId: string, on: boolean) {
  return run(async () => {
    const store = await getStore();
    if (on) await store.bookmark(id.parse(postId));
    else await store.unbookmark(id.parse(postId));
  });
}

export async function toggleRepostAction(postId: string, on: boolean) {
  return run(async () => {
    const store = await getStore();
    if (on) await store.repost(id.parse(postId));
    else await store.unrepost(id.parse(postId));
  });
}

export async function deletePostAction(postId: string) {
  return run(async () => {
    const store = await getStore();
    await store.deletePost(id.parse(postId));
    revalidatePath("/", "layout");
  });
}

const composerSchema = z.object({
  kind: z.enum(["update", "recommendation"]),
  body: z.string().trim().min(1, "Say something first.").max(5000),
  progressPages: z.number().int().min(0).max(20000).nullable(),
  progressPercent: z.number().int().min(0).max(100).nullable(),
  visibility: z.enum(["public", "followers", "private"]),
});

export async function createPostAction(input: z.input<typeof composerSchema> & { book: BookRefInput | null }) {
  return run(async () => {
    const data = composerSchema.parse(input);
    const store = await getStore();
    const book = input.book ? await resolveBook(store, input.book) : null;
    const post = await store.createPost({ ...data, bookId: book?.id ?? null });
    revalidatePath("/activity");
    return post;
  });
}

const cursor = z.string().max(200).nullable();

export async function loadFeedAction(tab: "following" | "discover", c: string | null) {
  return run(async () => (await getStore()).getFeed(z.enum(["following", "discover"]).parse(tab), cursor.parse(c)));
}

export async function loadUserPostsAction(userId: string, c: string | null) {
  return run(async () => (await getStore()).getUserPosts(id.parse(userId), cursor.parse(c)));
}

export async function loadBookmarksAction(c: string | null) {
  return run(async () => (await getStore()).listBookmarks(cursor.parse(c)));
}

export async function addCommentAction(postId: string, body: string, parentId: string | null) {
  return run(async () => {
    const store = await getStore();
    const comment = await store.addComment(id.parse(postId), z.string().max(2000, "Comments are limited to 2,000 characters.").parse(body), parentId ? id.parse(parentId) : null);
    revalidatePath(`/post/${postId}`);
    return comment;
  });
}

export async function deleteCommentAction(commentId: string, postId: string) {
  return run(async () => {
    await (await getStore()).deleteComment(id.parse(commentId));
    revalidatePath(`/post/${postId}`);
  });
}

export async function markNotificationsReadAction() {
  return run(async () => {
    await (await getStore()).markNotificationsRead();
    revalidatePath("/", "layout");
  });
}

export async function searchReadersAction(q: string) {
  return run(async () => (await getStore()).searchProfiles(z.string().max(80).parse(q), 8));
}

export async function sendRecommendationAction(input: { recipientId: string; book: BookRefInput; message: string; parentId: string | null }) {
  return run(async () => {
    const store = await getStore();
    const book = await resolveBook(store, input.book);
    return store.sendRecommendation(id.parse(input.recipientId), book.id, z.string().max(1000).parse(input.message), input.parentId ? id.parse(input.parentId) : null);
  });
}
