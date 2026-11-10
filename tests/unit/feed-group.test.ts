import assert from "node:assert/strict";
import { test } from "node:test";
import { groupFeed } from "../../src/lib/feed-group.ts";
import type { Post } from "../../src/lib/types.ts";

const at = (h: number) => new Date(Date.UTC(2026, 10, 10, 12) - h * 3600_000).toISOString();
const post = (id: string, userId: string, kind: Post["kind"], hoursAgo: number, extra: Partial<Post> = {}) =>
  ({ id, userId, kind, createdAt: at(hoursAgo), body: null, likesCount: 0, commentsCount: 0, ...extra }) as Post;

test("a run of plain 'finished' posts by one reader becomes one group", () => {
  const items = groupFeed([post("a", "u1", "finished", 1), post("b", "u1", "finished", 3), post("c", "u1", "finished", 5), post("d", "u2", "review", 6)]);
  assert.equal(items.length, 2);
  assert.equal(items[0].kind, "group");
  assert.equal(items[0].kind === "group" && items[0].posts.length, 3);
});

test("anything with words, likes or comments stays on its own; so do other readers and old posts", () => {
  const items = groupFeed([
    post("a", "u1", "finished", 1),
    post("b", "u1", "finished", 2, { body: "Loved it" }),
    post("c", "u1", "finished", 3, { likesCount: 2 }),
    post("d", "u2", "finished", 4),
    post("e", "u2", "finished", 60),
    post("f", "u1", "started", 61),
  ]);
  assert.deepEqual(items.map((i) => i.kind), ["post", "post", "post", "post", "post", "post"]);
});
