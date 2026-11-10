// Phase Two: one rating per reader and book, logging a finished book, atomic reviews and
// reordering, and stats aggregated in the database.
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { asAnon, asRole, asUser, createDb, createUser, pgError, type Db } from "./harness.ts";

type Row = Record<string, unknown>;
const one = async <T = Row>(p: Promise<{ rows: unknown[] }>) => (await p).rows[0] as T;

let db: Db;
let ada: string, ben: string;

async function addBook(title: string, extra: { pages?: number; genres?: string[] } = {}) {
  const r = await asRole(db, { as: "service" }, (tx) =>
    tx.query("insert into public.books (slug, title, authors, page_count, genres) values ($1, $2, '{Ann Author}', $3, $4) returning id", [
      `${title.toLowerCase().replace(/\W+/g, "-")}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      extra.pages ?? null,
      extra.genres ?? [],
    ]),
  );
  return (r.rows[0] as { id: string }).id;
}
const logBook = (who: string, book: string, args: Row = {}) =>
  asUser(db, who, (tx) =>
    tx.query(
      `select public.log_book(p_book_id => $1, p_finished_on => $2, p_rating => $3, p_reread => $4, p_notes => $5,
         p_review_body => $6, p_quote_body => $7, p_share => $8, p_visibility => $9::public.visibility) as r`,
      [book, args.date ?? null, args.rating ?? null, args.reread ?? false, args.notes ?? null, args.review ?? null, args.quote ?? null, args.share ?? false, args.visibility ?? "public"],
    ),
  ).then((r) => (r.rows[0] as { r: Row }).r);
const shelf = (who: string, book: string) =>
  one<{ status: string; rating: string | null; finished_at: string | null }>(db.query("select status, rating, finished_at::text from public.user_books where user_id = $1 and book_id = $2", [who, book]));

before(async () => {
  db = await createDb();
  ada = await createUser(db, "ada");
  ben = await createUser(db, "ben");
});

describe("one rating per reader and book", () => {
  test("stars on a review become the shelf rating, and a new shelf rating updates the review", async () => {
    const b = await addBook("Rated");
    await asUser(db, ada, (tx) => tx.query("select public.publish_review($1, 'Wonderful', 4.5)", [b]));
    assert.equal(Number((await shelf(ada, b)).rating), 4.5);
    await asUser(db, ada, (tx) => tx.query("update public.user_books set rating = 3 where user_id = $1 and book_id = $2", [ada, b]));
    const r = await one<{ rating: string }>(db.query("select rating from public.reviews where user_id = $1 and book_id = $2", [ada, b]));
    assert.equal(Number(r.rating), 3);
  });
  test("a review written without stars shows the reader's rating", async () => {
    const b = await addBook("Unstarred");
    await asUser(db, ada, (tx) => tx.query("insert into public.user_books (user_id, book_id, status, rating) values ($1, $2, 'read', 4)", [ada, b]));
    await asUser(db, ada, (tx) => tx.query("select public.publish_review($1, 'No stars given')", [b]));
    const r = await one<{ rating: string }>(db.query("select rating from public.reviews where user_id = $1 and book_id = $2", [ada, b]));
    assert.equal(Number(r.rating), 4);
  });
});

describe("publishing a review", () => {
  test("creates the review and its post together, and shelves the book", async () => {
    const b = await addBook("Published");
    const id = await one<{ id: string }>(asUser(db, ben, (tx) => tx.query("select public.publish_review($1, 'Great', null, 'A title', false, false, 'followers') as id", [b])));
    const post = await one<{ visibility: string }>(db.query("select visibility from public.posts where review_id = $1", [id.id]));
    assert.equal(post.visibility, "followers");
    assert.equal((await shelf(ben, b)).status, "read");
  });
  test("nothing is left behind when it fails", async () => {
    const b = await addBook("Failing");
    // An empty body violates the reviews check, so neither the review nor a post may exist.
    assert.equal(await pgError(asUser(db, ben, (tx) => tx.query("select public.publish_review($1, '')", [b]))), "23514");
    const n = await one<{ n: number }>(db.query("select count(*)::int n from public.posts where user_id = $1 and book_id = $2", [ben, b]));
    assert.equal(n.n, 0);
  });
});

describe("logging a finished book", () => {
  test("closes the read in progress, shelves it as Read with the date and rating, posts nothing by default", async () => {
    const b = await addBook("Logged");
    await asUser(db, ada, (tx) => tx.query("select public.set_shelf_status($1, 'reading')", [b]));
    await logBook(ada, b, { date: "2026-03-14", rating: 4, notes: "Cried on the train" });
    const sessions = (await db.query("select status, finished_on::text, notes from public.reading_sessions where user_id = $1 and book_id = $2", [ada, b])).rows;
    assert.deepEqual(sessions, [{ status: "finished", finished_on: "2026-03-14", notes: "Cried on the train" }]);
    assert.deepEqual(await shelf(ada, b), { status: "read", rating: "4.0", finished_at: "2026-03-14" });
    const posts = await one<{ n: number }>(db.query("select count(*)::int n from public.posts where user_id = $1 and book_id = $2", [ada, b]));
    assert.equal(posts.n, 0);
  });
  test("a review, a favourite line and sharing, all in one go", async () => {
    const b = await addBook("Everything");
    const r = await logBook(ada, b, { rating: 5, review: "Loved it", quote: "All that we see or seem", share: true });
    assert.ok(r.review_id && r.quote_id);
    assert.equal(r.post_id, null, "the review already announces it; no extra 'finished' post");
    const kinds = (await db.query("select kind::text from public.posts where user_id = $1 and book_id = $2 order by kind::text", [ada, b])).rows.map((x) => (x as { kind: string }).kind);
    assert.deepEqual(kinds, ["quote", "review"]);
  });
  test("logging the same day twice is one read; a re-read is another", async () => {
    const b = await addBook("Twice");
    await logBook(ben, b, { date: "2026-05-01" });
    await logBook(ben, b, { date: "2026-05-01", notes: "second thoughts" });
    await logBook(ben, b, { date: "2026-06-01", reread: true });
    const rows = (await db.query("select finished_on::text, is_reread, notes from public.reading_sessions where user_id = $1 and book_id = $2 order by finished_on", [ben, b])).rows;
    assert.deepEqual(rows, [
      { finished_on: "2026-05-01", is_reread: false, notes: "second thoughts" },
      { finished_on: "2026-06-01", is_reread: true, notes: null },
    ]);
  });
  test("if any part fails, none of it is saved", async () => {
    const b = await addBook("Atomic");
    const tooLong = "x".repeat(2001); // quotes.body is at most 2000 characters
    assert.equal(await pgError(logBook(ben, b, { rating: 4, quote: tooLong })), "23514");
    assert.equal(await shelf(ben, b), undefined);
    const n = await one<{ n: number }>(db.query("select count(*)::int n from public.reading_sessions where user_id = $1 and book_id = $2", [ben, b]));
    assert.equal(n.n, 0);
  });
  test("signed-out callers can't log", async () => {
    const b = await addBook("Anon");
    assert.equal(await pgError(asAnon(db, (tx) => tx.query("select public.log_book($1)", [b]))), "42501");
  });
});

describe("reordering a list", () => {
  test("one statement, owner only, and the order must cover the whole list", async () => {
    const [x, y, z] = [await addBook("X"), await addBook("Y"), await addBook("Z")];
    const list = await one<{ id: string }>(asUser(db, ada, (tx) => tx.query("insert into public.lists (user_id, title) values ($1, 'Mine') returning id", [ada])));
    for (const [i, b] of [x, y, z].entries()) {
      await asUser(db, ada, (tx) => tx.query("insert into public.list_books (list_id, book_id, position) values ($1, $2, $3)", [list.id, b, i]));
    }
    await asUser(db, ada, (tx) => tx.query("select public.reorder_list($1, $2)", [list.id, [z, x, y]]));
    const order = (await db.query("select book_id from public.list_books where list_id = $1 order by position", [list.id])).rows.map((r) => (r as { book_id: string }).book_id);
    assert.deepEqual(order, [z, x, y]);
    assert.equal(await pgError(asUser(db, ada, (tx) => tx.query("select public.reorder_list($1, $2)", [list.id, [z, x]]))), "22023");
    assert.equal(await pgError(asUser(db, ben, (tx) => tx.query("select public.reorder_list($1, $2)", [list.id, [x, y, z]]))), "42501");
  });
});

describe("reading stats", () => {
  test("year-scoped, counts re-reads for the owner, pages only where known", async () => {
    const reader = await createUser(db, "cyd");
    const a = await addBook("Long", { pages: 400, genres: ["fantasy"] });
    const c = await addBook("Short", { genres: ["poetry"] });
    const old = await addBook("Old", { pages: 100, genres: ["mystery"] });
    await logBook(reader, a, { date: "2026-02-10", rating: 4 });
    await logBook(reader, a, { date: "2026-09-01", reread: true });
    await logBook(reader, c, { date: "2026-02-20", rating: 2 });
    await logBook(reader, old, { date: "2025-12-31", rating: 5 });

    const own = (await one<{ s: Row }>(asUser(db, reader, (tx) => tx.query("select public.reading_stats($1, 2026) as s", [reader])))).s;
    assert.equal(own.completions, 3);
    assert.equal(own.distinct_books, 2);
    assert.equal(own.rereads, 1);
    assert.equal(own.pages, 400);
    assert.equal(own.books_with_pages, 1);
    assert.equal(Number(own.average_rating), 3);
    assert.deepEqual((own.by_month as number[]).slice(0, 3), [0, 2, 0]);
    assert.deepEqual((own.top_genres as { genre: string }[]).map((g) => g.genre).sort(), ["fantasy", "poetry"]);
    assert.equal((own.rating_distribution as number[])[3], 1); // one 2-star (index 3 = 2.0)

    // Someone else sees one completion per book from the public shelf, never the private diary.
    const other = (await one<{ s: Row }>(asUser(db, ada, (tx) => tx.query("select public.reading_stats($1, 2026) as s", [reader])))).s;
    assert.equal(other.rereads, 0);
    assert.equal(other.sessions, 0);
    assert.equal(other.distinct_books, 2);
  });
});
