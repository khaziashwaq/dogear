// Phases Three and Four: readers with similar taste, invite links, and reading recaps.
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { asAnon, asRole, asUser, createDb, createUser, pgError, type Db } from "./harness.ts";

type Row = Record<string, unknown>;
let db: Db;

async function addBook(title: string, extra: { pages?: number; genres?: string[]; author?: string } = {}) {
  const r = await asRole(db, { as: "service" }, (tx) =>
    tx.query("insert into public.books (slug, title, authors, page_count, genres) values ($1, $2, $3, $4, $5) returning id", [
      `${title.toLowerCase().replace(/\W+/g, "-")}-${Math.random().toString(36).slice(2, 7)}`, title, [extra.author ?? "Ann Author"], extra.pages ?? null, extra.genres ?? [],
    ]),
  );
  return (r.rows[0] as { id: string }).id;
}
const shelve = (who: string, book: string, status: string, rating: number | null = null, favourite = false) =>
  asUser(db, who, (tx) => tx.query("insert into public.user_books (user_id, book_id, status, rating, is_favourite) values ($1, $2, $3, $4, $5)", [who, book, status, rating, favourite]));
const setTaste = (who: string, genres: string[], authors: string[]) =>
  db.query("update public.profiles set favourite_genres = $2, favourite_authors = $3 where id = $1", [who, genres, authors]);

before(async () => {
  db = await createDb();
});

describe("readers with similar taste", () => {
  test("ranked by shared shelves, agreement, authors and genres; never blocked or already followed", async () => {
    const [me, twin, cousin, stranger, blocked, friend] = await Promise.all(["meme", "twin", "cousin", "stranger", "blocked", "friend"].map((u) => createUser(db, u)));
    const books = await Promise.all(["A", "B", "C", "D", "E"].map((t) => addBook(t)));
    for (const b of books) await shelve(me, b, "read", 4);
    for (const b of books) await shelve(twin, b, "read", 4); // same books, same stars
    await shelve(cousin, books[0], "read", 1); // one book, disagree
    await shelve(blocked, books[0], "read", 4);
    await shelve(friend, books[0], "read", 4);
    await setTaste(me, ["fantasy", "poetry"], ["Le Guin"]);
    await setTaste(stranger, ["fantasy"], ["Le Guin"]); // no shared books, shared taste
    await asUser(db, me, (tx) => tx.query("insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [me, blocked]));
    await asUser(db, me, (tx) => tx.query("insert into public.follows (follower_id, following_id) values ($1, $2)", [me, friend]));

    const rows = (await asUser(db, me, (tx) => tx.query("select profile->>'username' as u, score, shared_books, shared_authors from public.similar_readers(10)"))).rows as Row[];
    const names = rows.map((r) => r.u);
    assert.equal(names[0], "twin");
    assert.ok(names.includes("cousin") && names.includes("stranger"));
    assert.ok(!names.includes("blocked") && !names.includes("friend") && !names.includes("meme"));
    const twin0 = rows[0];
    assert.equal(twin0.shared_books, 5);
    assert.ok((twin0.score as number) > (rows.find((r) => r.u === "cousin")!.score as number));
    assert.deepEqual(rows.find((r) => r.u === "stranger")!.shared_authors, ["Le Guin"]);
    void twin;
    void cousin;
    void stranger;
  });
  test("signed-out callers get nothing", async () => {
    assert.equal(await pgError(asAnon(db, (tx) => tx.query("select * from public.similar_readers()"))), "42501");
  });
});

describe("invite links", () => {
  test("create, preview, redeem once (and follow the inviter); counts only for the inviter", async () => {
    const host = await createUser(db, "host");
    const guest = await createUser(db, "guest");
    const code = "abcDEF123_xyz";
    await asUser(db, host, (tx) => tx.query("insert into public.invites (code, inviter_id, max_uses) values ($1, $2, 2)", [code, host]));
    const preview = (await asAnon(db, (tx) => tx.query("select public.invite_preview($1) as p", [code]))).rows[0] as { p: Row };
    assert.equal(preview.p.valid, true);
    assert.equal((preview.p.inviter as Row).username, "host");

    const first = (await asUser(db, guest, (tx) => tx.query("select public.redeem_invite($1) as ok", [code]))).rows[0] as { ok: boolean };
    const again = (await asUser(db, guest, (tx) => tx.query("select public.redeem_invite($1) as ok", [code]))).rows[0] as { ok: boolean };
    assert.equal(first.ok, true);
    assert.equal(again.ok, false);
    const follows = (await db.query("select 1 from public.follows where follower_id = $1 and following_id = $2", [guest, host])).rows.length;
    assert.equal(follows, 1);
    const inv = (await asUser(db, host, (tx) => tx.query("select uses from public.invites where code = $1", [code]))).rows[0] as { uses: number };
    assert.equal(inv.uses, 1);
    // The inviter can't list who joined, and nobody can bump the counter by hand.
    assert.equal(await pgError(asUser(db, host, (tx) => tx.query("select * from public.invite_redemptions"))), "42501");
    assert.equal(await pgError(asUser(db, host, (tx) => tx.query("update public.invites set uses = 99 where code = $1", [code]))), "42501");
  });
  test("expired or used-up links don't work, and you can't invite yourself", async () => {
    const host = await createUser(db, "host2");
    const late = await createUser(db, "late");
    await asUser(db, host, (tx) => tx.query("insert into public.invites (code, inviter_id, expires_at) values ('expired_code_1', $1, now() - interval '1 day')", [host]));
    const r = (await asUser(db, late, (tx) => tx.query("select public.redeem_invite('expired_code_1') as ok"))).rows[0] as { ok: boolean };
    assert.equal(r.ok, false);
    await asUser(db, host, (tx) => tx.query("insert into public.invites (code, inviter_id) values ('self_invite_01', $1)", [host]));
    const s = (await asUser(db, host, (tx) => tx.query("select public.redeem_invite('self_invite_01') as ok"))).rows[0] as { ok: boolean };
    assert.equal(s.ok, false);
  });
});

describe("reading recap", () => {
  test("a year: favourite book, busiest month, most highlighted, timeline — and nothing invented", async () => {
    const reader = await createUser(db, "recap");
    const fave = await addBook("Fave", { pages: 300, genres: ["fantasy"], author: "Le Guin" });
    const ok = await addBook("Ok", { genres: ["fantasy"], author: "Le Guin" });
    const log = (b: string, day: string, rating: number | null) =>
      asUser(db, reader, (tx) => tx.query("select public.log_book(p_book_id => $1, p_finished_on => $2, p_rating => $3)", [b, day, rating]));
    await log(fave, "2026-04-02", 5);
    await log(ok, "2026-04-20", 3);
    await asUser(db, reader, (tx) => tx.query("insert into public.quotes (user_id, book_id, body, created_at) values ($1, $2, 'line one', '2026-04-03'), ($1, $2, 'line two', '2026-04-04')", [reader, fave]));

    const y = ((await asUser(db, reader, (tx) => tx.query("select public.reading_recap($1, 2026) as r", [reader]))).rows[0] as { r: Row }).r;
    assert.equal(y.completions, 2);
    assert.equal((y.favourite_book as Row).title, "Fave");
    assert.deepEqual(y.busiest_month, { month: 4, count: 2 });
    assert.equal((y.top_author as Row).name, "Le Guin");
    assert.equal((y.most_highlighted as Row).title, "Fave");
    assert.equal(y.loved_line, null, "no likes yet: no 'most loved line'");
    assert.equal(y.books_with_pages, 1);
    assert.deepEqual((y.timeline as Row[]).map((t) => t.day), ["2026-04-02", "2026-04-20"]);

    const m = ((await asUser(db, reader, (tx) => tx.query("select public.reading_recap($1, 2026, 3) as r", [reader]))).rows[0] as { r: Row }).r;
    assert.equal(m.completions, 0);
    assert.equal(m.favourite_book, null);
  });
});

describe("importing a shelf entry", () => {
  test("dated reads get a diary entry; existing books are skipped unless overwriting; nothing is posted", async () => {
    const r = await createUser(db, "importer");
    const a = await addBook("Imported");
    const imp = (b: string, status: string, rating: number | null, date: string | null, overwrite = false) =>
      asUser(db, r, (tx) => tx.query("select public.import_shelf_entry($1, $2::public.shelf_status, $3, $4, '{classics}', $5) as s", [b, status, rating, date, overwrite])).then((x) => (x.rows[0] as { s: string }).s);
    assert.equal(await imp(a, "read", 4, "2019-06-01"), "imported");
    assert.equal(await imp(a, "want_to_read", null, null), "skipped");
    assert.equal(await imp(a, "read", 5, "2019-06-01", true), "updated");
    const ub = (await db.query("select status, rating, finished_at::text, shelves from public.user_books where user_id = $1 and book_id = $2", [r, a])).rows[0];
    assert.deepEqual(ub, { status: "read", rating: "5.0", finished_at: "2019-06-01", shelves: ["classics"] });
    const sessions = (await db.query("select count(*)::int n from public.reading_sessions where user_id = $1 and book_id = $2", [r, a])).rows[0] as { n: number };
    assert.equal(sessions.n, 1);
    const posts = (await db.query("select count(*)::int n from public.posts where user_id = $1", [r])).rows[0] as { n: number };
    assert.equal(posts.n, 0);
  });
  test("an undated Read book counts all-time but not in this year's stats", async () => {
    const r = await createUser(db, "undated");
    const b = await addBook("Undated");
    await asUser(db, r, (tx) => tx.query("select public.import_shelf_entry($1, 'read')", [b]));
    const s = ((await asUser(db, r, (tx) => tx.query("select public.reading_stats($1, extract(year from now())::int) as s", [r]))).rows[0] as { s: Row }).s;
    assert.equal(s.completions, 0);
    assert.equal(s.books_read_all_time, 1);
  });
});
