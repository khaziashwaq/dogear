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

describe("demo store: reading life", () => {
  const log = (s: Store, bookId: string, extra: Partial<Parameters<Store["logBook"]>[0]> = {}) =>
    s.logBook({ bookId, finishedOn: null, rating: null, reread: false, notes: null, review: null, quote: null, visibility: "public", share: false, ...extra });

  test("one rating: a review's stars become the shelf rating, a new shelf rating updates the review", async () => {
    const s = as(ids.ada);
    const b = book("Rated");
    const r = await s.createReview({ bookId: b, rating: 4.5, title: null, body: "Lovely", containsSpoilers: false, isReread: false, visibility: "public" });
    assert.equal((await s.getUserBook(b))?.rating, 4.5);
    await s.setRating(b, 3);
    assert.equal((await s.getReview(r.id))?.rating, 3);
  });
  test("logging closes the read in progress, back-dates safely, and posts nothing unless asked", async () => {
    const s = as(ids.ada);
    const b = book("Logged");
    const before = (await s.getUserPosts(ids.ada, null, 200)).items.length;
    await s.setShelfStatus(b, "reading");
    await log(s, b, { finishedOn: "2026-03-14", rating: 4, notes: "Cried on the train" });
    const sessions = await s.listSessions(b);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].status, "finished");
    assert.equal(sessions[0].finishedOn, "2026-03-14");
    assert.ok(!sessions[0].startedOn || sessions[0].startedOn <= "2026-03-14");
    assert.equal((await s.getUserBook(b))?.status, "read");
    assert.equal((await s.getUserPosts(ids.ada, null, 200)).items.length, before);
  });
  test("a review and a line in one go; the review stands in for the 'finished' post", async () => {
    const s = as(ids.ada);
    const b = book("Everything");
    const r = await log(s, b, { rating: 5, review: { title: null, body: "Loved it", containsSpoilers: false }, quote: { body: "All that we see", page: null }, share: true });
    assert.ok(r.reviewId && r.quoteId);
    assert.equal(r.postId, null);
  });
  test("the same day twice is one read; a re-read is another", async () => {
    const s = as(ids.ada);
    const b = book("Twice");
    await log(s, b, { finishedOn: "2026-05-01" });
    await log(s, b, { finishedOn: "2026-05-01", notes: "second thoughts" });
    await log(s, b, { finishedOn: "2026-06-01", reread: true });
    const rows = (await s.listSessions(b)).map((x) => [x.finishedOn, x.isReread, x.notes]).sort();
    assert.deepEqual(rows, [["2026-05-01", false, "second thoughts"], ["2026-06-01", true, null]]);
  });
  test("an invalid part saves nothing", async () => {
    const s = as(ids.ada);
    const b = book("Atomic");
    await assert.rejects(log(s, b, { rating: 4, quote: { body: "x".repeat(2001), page: null } }));
    assert.equal(await s.getUserBook(b), null);
    assert.equal((await s.listSessions(b)).length, 0);
  });
  test("stats: year-scoped, re-reads for the owner, pages only where known, diary private", async () => {
    const owner = as(ids.ben);
    const long = book("Long");
    const db = (await import("../../src/lib/data/demo/db.ts")).getDemoDB();
    db.books.find((x) => x.id === long)!.pageCount = 400;
    const short = book("Short");
    await log(owner, long, { finishedOn: "2025-02-10", rating: 4 });
    await log(owner, long, { finishedOn: "2025-09-01", reread: true });
    await log(owner, short, { finishedOn: "2025-02-20", rating: 2 });
    const mine = await owner.getProfileStats(ids.ben, 2025);
    assert.equal(mine.booksReadThisYear, 3);
    assert.equal(mine.distinctBooksThisYear, 2);
    assert.equal(mine.rereadsThisYear, 1);
    assert.equal(mine.pagesReadThisYear, 400);
    assert.equal(mine.booksWithPagesThisYear, 1);
    assert.equal(mine.averageRating, 3);
    const theirs = await as(ids.ada).getProfileStats(ids.ben, 2025);
    assert.equal(theirs.rereadsThisYear, 0);
    assert.equal(theirs.sessionsThisYear, 0);
  });
  test("reordering must cover the whole list", async () => {
    const s = as(ids.ada);
    const list = await s.createList({ title: "Order", description: null, coverStyle: "rose", coverImageUrl: null, visibility: "public", isRanked: true });
    const [x, y] = [book("X"), book("Y")];
    await s.addBookToList(list.id, x, null);
    await s.addBookToList(list.id, y, null);
    await s.reorderList(list.id, [y, x]);
    assert.deepEqual((await s.getList(list.id))?.books.map((b) => b.bookId), [y, x]);
    await assert.rejects(s.reorderList(list.id, [y]));
  });
  test("comments can be edited by their author only", async () => {
    const b = book("Talk");
    const post = await as(ids.ada).createPost({ kind: "update", bookId: b, body: "p.1", progressPages: null, progressPercent: null, visibility: "public" });
    const c = await as(ids.ben).addComment(post.id, "Hello", null);
    const edited = await as(ids.ben).updateComment(c.id, "Hello again");
    assert.equal(edited.body, "Hello again");
    assert.ok(edited.editedAt);
    await assert.rejects(as(ids.ada).updateComment(c.id, "Hijacked"));
  });
});

describe("demo store: social & discovery", () => {
  test("feed filters keep only the chosen kinds", async () => {
    const page = await as(ids.ada).getFeed("discover", null, 50, "reviews");
    assert.ok(page.items.every((p) => p.kind === "review"));
  });
  test("similar readers: never yourself, never blocked or already followed, best match first", async () => {
    const s = as(ids.ada);
    const rows = await s.similarReaders(10);
    assert.ok(rows.every((r) => r.profile.id !== ids.ada));
    const following = new Set(await s.followingIds());
    assert.ok(rows.every((r) => !following.has(r.profile.id)));
    for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].score >= rows[i].score);
  });
  test("invites: preview, redeem once (new readers only), follow the inviter, count without names", async () => {
    const host = as(ids.ada);
    const inv = await host.createInvite({ expiresInDays: 7, maxUses: null });
    const preview = await as(null).invitePreview(inv.code);
    assert.equal(preview?.valid, true);
    const { getDemoDB, newId } = await import("../../src/lib/data/demo/db.ts");
    const db = getDemoDB();
    const fresh = newId();
    db.profiles.push({ ...db.profiles.find((p) => p.id === ids.ben)!, id: fresh, username: "newbie", createdAt: new Date().toISOString() });
    assert.equal(await as(fresh).redeemInvite(inv.code), true);
    assert.equal(await as(fresh).redeemInvite(inv.code), false);
    assert.ok((await as(fresh).followingIds()).includes(ids.ada));
    assert.equal((await host.listInvites()).find((i) => i.code === inv.code)?.uses, 1);
    // An established reader (joined long ago) can't claim an invite.
    assert.equal(await as(ids.ben).redeemInvite(inv.code), false);
  });
  test("recap: a month and a year, nothing invented", async () => {
    const s = as(ids.ben);
    const b = book("Recap");
    await s.logBook({ bookId: b, finishedOn: "2024-04-02", rating: 5, reread: false, notes: null, review: null, quote: null, visibility: "public", share: false });
    const april = await s.readingRecap(ids.ben, 2024, 4);
    assert.equal(april.completions, 1);
    assert.equal(april.favouriteBook?.id, b);
    assert.equal(april.lovedLine, null);
    const march = await s.readingRecap(ids.ben, 2024, 3);
    assert.equal(march.completions, 0);
    assert.equal(march.favouriteBook, null);
  });
  test("import: skips books already shelved unless overwriting; never posts", async () => {
    const s = as(ids.ada);
    const b = book("Imported");
    const before = (await s.getUserPosts(ids.ada, null, 500)).items.length;
    assert.equal(await s.importShelfEntry({ bookId: b, status: "read", rating: 4, finishedOn: "2019-06-01", shelves: ["classics"], overwrite: false }), "imported");
    assert.equal(await s.importShelfEntry({ bookId: b, status: "want_to_read", rating: null, finishedOn: null, shelves: [], overwrite: false }), "skipped");
    assert.equal((await s.getUserBook(b))?.status, "read");
    assert.equal((await s.getUserPosts(ids.ada, null, 500)).items.length, before);
    const undated = book("Undated");
    await s.importShelfEntry({ bookId: undated, status: "read", rating: null, finishedOn: null, shelves: [], overwrite: false });
    const stats = await s.getProfileStats(ids.ada, new Date().getFullYear());
    assert.ok(!(await s.readingRecap(ids.ada, new Date().getFullYear(), null)).timeline.some((t) => t.id === undated));
    assert.ok(stats.booksRead > 0);
  });
  test("list search finds public lists with books, by title", async () => {
    const s = as(ids.ada);
    const list = await s.createList({ title: "Rainy Sunday reads", description: null, coverStyle: "rose", coverImageUrl: null, visibility: "public", isRanked: false });
    await s.addBookToList(list.id, book("Rainy"), null);
    const found = await as(ids.ben).searchLists("rainy sunday", "popular");
    assert.ok(found.some((l) => l.id === list.id));
  });
});
