import type { Post } from "@/lib/types";

export type FeedItem = { kind: "post"; post: Post } | { kind: "group"; posts: Post[] };
const WINDOW = 36 * 3600_000;

/**
 * Consecutive "started" / "finished" posts by the same reader, with no words, likes or comments of
 * their own, within a day and a half: grouped. Anything someone wrote or reacted to stays on its own.
 */
export function groupFeed(posts: Post[]): FeedItem[] {
  const plain = (p: Post) => (p.kind === "started" || p.kind === "finished") && !p.body && !p.likesCount && !p.commentsCount;
  const out: FeedItem[] = [];
  for (const p of posts) {
    const last = out.at(-1);
    const run = last?.kind === "group" ? last.posts : last?.kind === "post" ? [last.post] : null;
    const head = run?.[0];
    if (
      run && head && plain(p) && plain(head) && head.userId === p.userId && head.kind === p.kind &&
      Math.abs(Date.parse(head.createdAt) - Date.parse(p.createdAt)) < WINDOW
    ) {
      out[out.length - 1] = { kind: "group", posts: [...run, p] };
    } else {
      out.push({ kind: "post", post: p });
    }
  }
  return out;
}
