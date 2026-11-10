// Personalised suggestions: private to each reader, saved atomically, dismissed books never return.
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { asAnon, asRole, asUser, createDb, createUser, pgError, type Db } from "./harness.ts";

type Row = Record<string, unknown>;
let db: Db;

async function addBook(title: string, olWorkId: string | null = null) {
  const r = await asRole(db, { as: "service" }, (tx) =>
    tx.query("insert into public.books (slug, title, authors, ol_work_id, subjects) values ($1, $2, '{Ann Author}', $3, '{gothic}') returning id", [
      `${title.toLowerCase().replace(/\W+/g, "-")}-${Math.random().toString(36).slice(2, 7)}`, title, olWorkId,
    ]),
  );
  return (r.rows[0] as { id: string }).id;
}

const item = (workKey: string, extra: Row = {}) => ({
  workKey,
  bookId: null,
  olWorkId: null,
  book: { title: workKey.split("|")[0], authors: ["Ann Author"], coverUrl: "https://covers.openlibrary.org/b/id/123-L.jpg?default=false" },
  score: 0.5,
  reasons: [{ kind: "genre", genre: "gothic", count: 2, verb: "read" }],
  sourceBookIds: [],
  ...extra,
});

const save = (who: string, signature: string | null, items: unknown[] | null) =>
  asUser(db, who, (tx) => tx.query("select public.save_suggestions($1, $2::jsonb) as n", [signature, items == null ? null : JSON.stringify(items)])).then(
    (r) => (r.rows[0] as { n: number }).n,
  );
const list = (who: string) =>
  asUser(db, who, (tx) => tx.query("select work_key, status, score::float8 as score from public.book_suggestions order by work_key")).then((r) => r.rows as Row[]);

before(async () => {
  db = await createDb();
});

describe("book suggestions", () => {
  test("a reader only ever sees and changes their own; signed-out callers get nothing", async () => {
    const [me, other] = await Promise.all([createUser(db, "sugg_me"), createUser(db, "sugg_other")]);
    await save(me, "sig-1", [item("alpha|author"), item("beta|author")]);
    assert.equal((await list(me)).length, 2);
    assert.equal((await list(other)).length, 0, "another reader sees none of them");

    const changed = await asUser(db, other, (tx) => tx.query("update public.book_suggestions set status = 'dismissed'"));
    assert.equal(changed.affectedRows, 0);
    assert.equal(await pgError(asUser(db, other, (tx) => tx.query("insert into public.book_suggestions (user_id, work_key, book, score) values ($1, 'x|y', '{\"title\":\"X\"}', 0.5)", [me]))), "42501");
    assert.equal(await pgError(asUser(db, me, (tx) => tx.query("update public.book_suggestions set user_id = $1", [other]))), "42501");
    assert.equal(await pgError(asAnon(db, (tx) => tx.query("select * from public.book_suggestions"))), "42501");
    assert.equal(await pgError(asAnon(db, (tx) => tx.query("select public.save_suggestions('x', '[]')"))), "42501");
    assert.equal(await pgError(asAnon(db, (tx) => tx.query("select * from public.co_shelved_books()"))), "42501");
  });

  test("refreshing replaces what's waiting, but dismissed and added books stay put and never come back", async () => {
    const me = await createUser(db, "sugg_cycle");
    await save(me, "sig-1", [item("alpha|author"), item("beta|author"), item("gamma|author")]);
    await asUser(db, me, (tx) => tx.query("update public.book_suggestions set status = 'dismissed' where work_key = 'beta|author'"));
    await asUser(db, me, (tx) => tx.query("update public.book_suggestions set status = 'added' where work_key = 'gamma|author'"));

    // The next list (say the engine missed the exclusion) offers beta again, drops alpha, adds delta.
    await save(me, "sig-2", [item("beta|author", { score: 0.9 }), item("delta|author")]);
    const rows = await list(me);
    assert.deepEqual(rows.map((r) => [r.work_key, r.status]), [
      ["beta|author", "dismissed"],
      ["delta|author", "suggested"],
      ["gamma|author", "added"],
    ]);
    assert.equal(rows.find((r) => r.work_key === "beta|author")!.score, 0.5, "a dismissed suggestion isn't rescored either");

    const run = (await asUser(db, me, (tx) => tx.query("select signature from public.suggestion_runs"))).rows[0] as Row;
    assert.equal(run.signature, "sig-2");
  });

  test("a failed refresh (null items) keeps the current list and only records the attempt", async () => {
    const me = await createUser(db, "sugg_offline");
    await save(me, "sig-1", [item("alpha|author")]);
    assert.equal(await save(me, null, null), 0);
    assert.equal((await list(me)).length, 1);
    const run = (await asUser(db, me, (tx) => tx.query("select signature from public.suggestion_runs"))).rows[0] as Row;
    assert.equal(run.signature, "sig-1", "the list is still the one made from sig-1");
  });

  test("a book shelved from anywhere else is marked added, not left waiting", async () => {
    const me = await createUser(db, "sugg_shelved");
    const book = await addBook("Carmilla", "OL123W");
    await save(me, "sig-1", [item("carmilla|author", { olWorkId: "OL123W" })]);
    await asUser(db, me, (tx) => tx.query("insert into public.user_books (user_id, book_id, status) values ($1, $2, 'want_to_read')", [me, book]));
    await save(me, "sig-2", []);
    assert.deepEqual((await list(me)).map((r) => r.status), ["added"]);
  });

  test("bad input is refused: too many, foreign covers, a score out of range", async () => {
    const me = await createUser(db, "sugg_bad");
    const many = Array.from({ length: 61 }, (_, i) => item(`book${i}|author`));
    assert.equal(await pgError(save(me, "s", many)), "22023");
    assert.equal(await pgError(save(me, "s", [item("x|y", { book: { title: "X", coverUrl: "https://evil.example/x.jpg" } })])), "23514");
    assert.equal(await pgError(save(me, "s", [item("x|y", { score: 2 })])), "23514");
    assert.equal((await list(me)).length, 0, "nothing half-saved");
  });
});

describe("readers who loved the same books", () => {
  test("books loved by readers who share yours, minus what you've shelved, and never across a block", async () => {
    const [me, kin, blocked] = await Promise.all([createUser(db, "co_me"), createUser(db, "co_kin"), createUser(db, "co_blocked")]);
    const [shared, theirs, mineToo, fromBlocked, meh] = await Promise.all(["Shared", "Theirs", "Mine too", "From blocked", "Meh"].map((t) => addBook(t)));
    const shelve = (who: string, book: string, status: string, rating: number | null = null) =>
      asUser(db, who, (tx) => tx.query("insert into public.user_books (user_id, book_id, status, rating) values ($1, $2, $3, $4)", [who, book, status, rating]));
    await shelve(me, shared, "read", 5);
    await shelve(me, mineToo, "want_to_read");
    await shelve(kin, shared, "read", 4);
    await shelve(kin, theirs, "read", 5);
    await shelve(kin, mineToo, "read", 5);
    await shelve(kin, meh, "read", 2);
    await shelve(blocked, shared, "read", 5);
    await shelve(blocked, fromBlocked, "read", 5);
    await asUser(db, me, (tx) => tx.query("insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [me, blocked]));

    const rows = (await asUser(db, me, (tx) => tx.query("select book->>'title' as title, readers, via from public.co_shelved_books(10)"))).rows as Row[];
    assert.deepEqual(rows.map((r) => r.title), ["Theirs"]);
    assert.equal(rows[0].readers, 1);
    assert.deepEqual((rows[0].via as string[]).sort(), [shared, mineToo].sort(), "found through the books we share");
  });
});

describe("catalogue subjects", () => {
  test("readers can't write subject headings on catalogue books", async () => {
    const me = await createUser(db, "subj_me");
    const book = await addBook("Locked");
    assert.equal(await pgError(asUser(db, me, (tx) => tx.query("update public.books set subjects = '{spam}' where id = $1", [book]))), "42501");
  });
});
