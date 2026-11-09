// The local store must follow the same rules as the database (tests/db/hardening.test.ts).
// Runs in a temporary working directory so the real .data/ demo database is never touched.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";

const dir = mkdtempSync(path.join(tmpdir(), "dogear-demo-"));
const home = process.cwd();
process.chdir(dir);
after(() => {
  process.chdir(home);
  rmSync(dir, { recursive: true, force: true });
});

type Store = import("../../src/lib/data/demo/store.ts").DemoStore;
let as: (id: string | null) => Store;
let ids: Record<string, string>;
let book: (title: string) => string;

before(async () => {
  const { DemoStore } = await import("../../src/lib/data/demo/store.ts");
  const { getDemoDB, newId } = await import("../../src/lib/data/demo/db.ts");
  const db = getDemoDB();
  as = (id) => new DemoStore(id);
  // Three distinct seeded readers.
  const readers = db.profiles.filter((p) => p.username).slice(0, 3);
  ids = { ada: readers[0].id, ben: readers[1].id, cyd: readers[2].id };
  book = (title) => {
    const id = newId();
    db.books.push({
      id, slug: `${title.toLowerCase()}-${id.slice(0, 6)}`, title, subtitle: null, authors: ["A"], description: null, coverUrl: null, isbn13: null, isbn10: null,
      olWorkId: null, olEditionId: null, publishedYear: null, publisher: null, pageCount: null, language: null, genres: [], moods: [], createdAt: new Date().toISOString(),
    });
    return id;
  };
});

const sessions = async (s: Store, b: string) => (await s.listSessions(b)).map((x) => ({ status: x.status, isReread: x.isReread }));

describe("demo store: shelf moves", () => {
  test("one honest diary; nothing posted unless asked", async () => {
    const s = as(ids.ada);
    const b = book("Middlemarch");
    const postsBefore = (await s.getUserPosts(ids.ada, null, 100)).items.length;
    await s.setShelfStatus(b, "want_to_read");
    await s.setShelfStatus(b, "reading");
    await s.setShelfStatus(b, "read");
    assert.deepEqual(await sessions(s, b), [{ status: "finished", isReread: false }]);
    assert.equal((await s.getUserPosts(ids.ada, null, 100)).items.length, postsBefore);
    await s.setShelfStatus(b, "reading"); // not finished after all
    assert.deepEqual(await sessions(s, b), [{ status: "reading", isReread: false }]);
    await s.setShelfStatus(b, "read");
    await s.setShelfStatus(b, "want_to_read");
    await s.setShelfStatus(b, "read"); // away and back the same day
    assert.equal((await sessions(s, b)).filter((x) => x.status === "finished").length, 1);
    await s.setShelfStatus(b, "reading", { reread: true });
    assert.equal((await sessions(s, b)).filter((x) => x.isReread).length, 1);
  });
  test("share posts; undo removes the post, the diary entry and the shelf entry", async () => {
    const s = as(ids.ben);
    const b = book("Stoner");
    const before = (await s.getUserPosts(ids.ben, null, 100)).items.length;
    const move = await s.setShelfStatus(b, "reading", { share: true });
    assert.equal((await s.getUserPosts(ids.ben, null, 100)).items.length, before + 1);
    await s.undoShelfMove(move.undo!);
    assert.equal((await s.getUserPosts(ids.ben, null, 100)).items.length, before);
    assert.deepEqual(await sessions(s, b), []);
    assert.equal(await s.getUserBook(b), null);
  });
  test("an undo record can't reach another reader's rows", async () => {
    const b = book("Gilead");
    const move = await as(ids.ada).setShelfStatus(b, "reading");
    await as(ids.ben).undoShelfMove(move.undo!);
    assert.equal((await sessions(as(ids.ada), b)).length, 1);
  });
});

describe("demo store: safety", () => {
  test("a block hides content both ways and removes follows", async () => {
    const [cyd, ben] = [as(ids.cyd), as(ids.ben)];
    const b = book("Beloved");
    const post = await cyd.createPost({ kind: "update", bookId: b, body: "reading", progressPages: null, progressPercent: null, visibility: "public" });
    await ben.follow(ids.cyd);
    await cyd.block(ids.ben);
    assert.equal(await ben.getPost(post.id), null);
    assert.equal(await cyd.getPost(post.id).then((p) => p?.id), post.id);
    await assert.rejects(ben.like(post.id));
    await assert.rejects(ben.follow(ids.cyd));
    assert.equal((await ben.listFollowing(ids.ben)).some((p) => p.id === ids.cyd), false);
    assert.deepEqual(await ben.relationship(ids.cyd), { following: false, blocked: false, muted: false });
    assert.equal((await cyd.relationship(ids.ben)).blocked, true);
    await cyd.unblock(ids.ben);
    assert.equal((await ben.getPost(post.id))?.id, post.id);
  });
  test("muting removes someone from your feeds", async () => {
    const ada = as(ids.ada);
    await ada.follow(ids.cyd);
    const b = book("Gilead II");
    await as(ids.cyd).createPost({ kind: "update", bookId: b, body: "hello", progressPages: null, progressPercent: null, visibility: "public" });
    const has = async () => (await ada.getFeed("following", null, 100)).items.some((p) => p.userId === ids.cyd);
    assert.equal(await has(), true);
    await ada.mute(ids.cyd);
    assert.equal(await has(), false);
    await ada.unmute(ids.cyd);
    assert.equal(await has(), true);
  });
  test("liking, unliking and liking again notifies once", async () => {
    const b = book("Once");
    const post = await as(ids.ada).createPost({ kind: "update", bookId: b, body: "x", progressPages: null, progressPercent: null, visibility: "public" });
    for (let i = 0; i < 3; i++) {
      await as(ids.ben).like(post.id);
      await as(ids.ben).unlike(post.id);
    }
    const n = (await as(ids.ada).listNotifications(200)).filter((x) => x.kind === "like" && x.postId === post.id);
    assert.equal(n.length, 1);
  });
  test("export contains your things; delete removes them", async () => {
    const s = as(ids.cyd);
    const data = await s.exportMyData();
    assert.equal((data.profile as { id: string }).id, ids.cyd);
    await s.deleteMyAccount();
    assert.equal(await as(null).getProfileById(ids.cyd), null);
  });
});
