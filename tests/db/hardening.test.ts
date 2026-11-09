// Phase One security and data-integrity rules, exercised as real API roles against the migrated schema.
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { asAnon, asRole, asUser, createDb, createUser, pgError, type Db } from "./harness.ts";

type Row = Record<string, unknown>;
const one = async <T = Row>(p: Promise<{ rows: unknown[] }>) => (await p).rows[0] as T;
const count = async (p: Promise<{ rows: unknown[] }>) => Number(((await p).rows[0] as { n: number }).n);

let db: Db;
let ada: string, ben: string, cy: string;
let book: string;

async function addBook(title: string) {
  const r = await asRole(db, { as: "service" }, (tx) =>
    tx.query("insert into public.books (slug, title, authors) values ($1, $2, '{Author}') returning id", [title.toLowerCase().replace(/\W+/g, "-"), title]),
  );
  return (r.rows[0] as { id: string }).id;
}

before(async () => {
  db = await createDb();
  ada = await createUser(db, "ada");
  ben = await createUser(db, "ben");
  cy = await createUser(db, "cyd");
  book = await addBook("Piranesi");
});

describe("catalogue", () => {
  test("readers can't add or edit shared books directly", async () => {
    assert.equal(await pgError(asUser(db, ada, (tx) => tx.query("insert into public.books (slug, title) values ('x', 'X')"))), "42501");
    assert.equal(await pgError(asUser(db, ada, (tx) => tx.query("update public.books set title = 'Vandalised' where id = $1", [book]))), "42501");
    const t = await one<{ title: string }>(db.query("select title from public.books where id = $1", [book]));
    assert.equal(t.title, "Piranesi");
  });
  test("the server (service role) can add books, but only with Open Library covers", async () => {
    await addBook("Circe");
    const bad = asRole(db, { as: "service" }, (tx) =>
      tx.query("insert into public.books (slug, title, cover_url) values ('bad', 'Bad', 'https://evil.example/x.jpg')"),
    );
    assert.equal(await pgError(bad), "23514");
  });
});

describe("URL columns", () => {
  test("profile links and images are validated by the database", async () => {
    const set = (col: string, v: string) => pgError(asUser(db, ada, (tx) => tx.query(`update public.profiles set ${col} = $1 where id = $2`, [v, ada])));
    assert.equal(await set("website", "javascript:alert(1)"), "23514");
    assert.equal(await set("website", "http://plain.example"), "23514");
    assert.equal(await set("website", "https://ada.example/blog"), null);
    assert.equal(await set("avatar_url", "https://tracker.example/pixel.gif"), "23514");
    assert.equal(await set("avatar_url", "https://lh3.googleusercontent.com/a/abc123=s96-c"), null);
    assert.equal(await set("avatar_url", `https://abcd.supabase.co/storage/v1/object/public/media/${ada}/avatar-1.png`), null);
    assert.equal(await set("cover_url", "https://lh3.googleusercontent.com/a/abc"), "23514");
  });
  test("sign-up ignores a provider photo we don't accept instead of failing", async () => {
    const id = crypto.randomUUID();
    await db.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2)", [id, JSON.stringify({ name: "Dee", avatar_url: "http://x.example/a.png" })]);
    const p = await one<{ avatar_url: string | null; display_name: string }>(db.query("select avatar_url, display_name from public.profiles where id = $1", [id]));
    assert.equal(p.avatar_url, null);
    assert.equal(p.display_name, "Dee");
  });
});

describe("storage", () => {
  const upload = (who: string, name: string) =>
    pgError(asUser(db, who, (tx) => tx.query("insert into storage.objects (bucket_id, name, owner) values ('media', $1, $2)", [name, who])));
  test("only raster images, only in your own folder", async () => {
    assert.equal(await upload(ada, `${ada}/avatar-1.png`), null);
    assert.equal(await upload(ada, `${ben}/avatar-1.png`), "42501");
    assert.equal(await upload(ada, `${ada}/page.html`), "42501");
    assert.equal(await upload(ada, `${ada}/logo.svg`), "42501");
    assert.equal(await upload(ada, `${ada}/nested/a.png`), "42501");
  });
  test("bucket limits are set", async () => {
    const b = await one<{ file_size_limit: number; allowed_mime_types: string[] }>(db.query("select file_size_limit, allowed_mime_types from storage.buckets where id = 'media'"));
    assert.equal(Number(b.file_size_limit), 2 * 1024 * 1024);
    assert.deepEqual(b.allowed_mime_types, ["image/jpeg", "image/png", "image/webp", "image/gif"]);
  });
});

describe("immutable fields", () => {
  test("a recommendation's recipient can mark it seen but not rewrite it", async () => {
    const r = await asUser(db, ada, (tx) => tx.query("insert into public.recommendations (sender_id, recipient_id, book_id) values ($1, $2, $3) returning id", [ada, ben, book]));
    const id = (r.rows[0] as { id: string }).id;
    assert.equal(await pgError(asUser(db, ben, (tx) => tx.query("update public.recommendations set sender_id = $1 where id = $2", [cy, id]))), "42501");
    assert.equal(await pgError(asUser(db, ben, (tx) => tx.query("update public.recommendations set message = 'forged' where id = $1", [id]))), "42501");
    assert.equal(await pgError(asUser(db, ben, (tx) => tx.query("update public.recommendations set seen_at = now() where id = $1", [id]))), null);
  });
  test("reviews keep their book, comments keep their post, posts keep their parent's visibility", async () => {
    const other = await addBook("Other");
    const rv = await asUser(db, ada, (tx) => tx.query("insert into public.reviews (user_id, book_id, body, visibility) values ($1, $2, 'Lovely', 'followers') returning id", [ada, book]));
    const reviewId = (rv.rows[0] as { id: string }).id;
    assert.equal(await pgError(asUser(db, ada, (tx) => tx.query("update public.reviews set book_id = $1 where id = $2", [other, reviewId]))), "42501");

    // A review's post always takes the review's visibility and book, whatever the client sends.
    const post = await one<{ id: string; visibility: string; book_id: string }>(
      asUser(db, ada, (tx) => tx.query("insert into public.posts (user_id, kind, review_id, book_id, visibility) values ($1, 'review', $2, $3, 'public') returning id, visibility, book_id", [ada, reviewId, other])),
    );
    assert.equal(post.visibility, "followers");
    assert.equal(post.book_id, book);
    await asUser(db, ada, (tx) => tx.query("update public.posts set visibility = 'public' where id = $1", [post.id]));
    assert.equal((await one<{ visibility: string }>(db.query("select visibility from public.posts where id = $1", [post.id]))).visibility, "followers");

    // Nobody can wrap someone else's review in their own post.
    const rv2 = await asUser(db, ada, (tx) => tx.query("insert into public.reviews (user_id, book_id, body) values ($1, $2, 'Mine') returning id", [ada, book]));
    const hijack = asUser(db, ben, (tx) => tx.query("insert into public.posts (user_id, kind, review_id) values ($1, 'review', $2)", [ben, (rv2.rows[0] as { id: string }).id]));
    assert.equal(await pgError(hijack), "42501");

    await asUser(db, ben, (tx) => tx.query("insert into public.follows (follower_id, following_id) values ($1, $2)", [ben, ada]));
    const c = await asUser(db, ben, (tx) => tx.query("insert into public.comments (post_id, user_id, body) values ($1, $2, 'Hi') returning id", [post.id, ben]));
    const cid = (c.rows[0] as { id: string }).id;
    const pub = await asUser(db, ada, (tx) => tx.query("insert into public.posts (user_id, kind, book_id, body) values ($1, 'update', $2, 'p.10') returning id", [ada, book]));
    assert.equal(await pgError(asUser(db, ben, (tx) => tx.query("update public.comments set post_id = $1 where id = $2", [(pub.rows[0] as { id: string }).id, cid]))), "42501");
    assert.equal(await pgError(asUser(db, ben, (tx) => tx.query("update public.comments set body = 'Hi!' where id = $1", [cid]))), null);
  });
});

describe("blocking, muting, reporting", () => {
  test("a block hides posts both ways, removes follows and stops interactions", async () => {
    const p = await asUser(db, cy, (tx) => tx.query("insert into public.posts (user_id, kind, book_id, body) values ($1, 'update', $2, 'reading') returning id", [cy, book]));
    const postId = (p.rows[0] as { id: string }).id;
    await asUser(db, ben, (tx) => tx.query("insert into public.follows (follower_id, following_id) values ($1, $2)", [ben, cy]));
    await asUser(db, cy, (tx) => tx.query("insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [cy, ben]));

    assert.equal(await count(db.query("select count(*) n from public.follows where follower_id = $1 and following_id = $2", [ben, cy])), 0);
    assert.equal(await count(asUser(db, ben, (tx) => tx.query("select count(*) n from public.posts where id = $1", [postId]))), 0);
    assert.equal(await count(asAnon(db, (tx) => tx.query("select count(*) n from public.posts where id = $1", [postId]))), 1);
    assert.equal(await pgError(asUser(db, ben, (tx) => tx.query("insert into public.likes (user_id, post_id) values ($1, $2)", [ben, postId]))), "42501");
    assert.equal(await pgError(asUser(db, ben, (tx) => tx.query("insert into public.comments (post_id, user_id, body) values ($1, $2, 'x')", [postId, ben]))), "42501");
    assert.equal(await pgError(asUser(db, ben, (tx) => tx.query("insert into public.follows (follower_id, following_id) values ($1, $2)", [ben, cy]))), "42501");
    assert.equal(await pgError(asUser(db, ben, (tx) => tx.query("insert into public.recommendations (sender_id, recipient_id, book_id) values ($1, $2, $3)", [ben, cy, book]))), "42501");
    // The blocked reader can't see that they were blocked.
    assert.equal(await count(asUser(db, ben, (tx) => tx.query("select count(*) n from public.blocks"))), 0);
    await asUser(db, cy, (tx) => tx.query("delete from public.blocks where blocker_id = $1 and blocked_id = $2", [cy, ben]));
    assert.equal(await count(asUser(db, ben, (tx) => tx.query("select count(*) n from public.posts where id = $1", [postId]))), 1);
  });
  test("muting drops someone from your feeds without telling them", async () => {
    const dee = await createUser(db, "dee");
    await asUser(db, dee, (tx) => tx.query("insert into public.posts (user_id, kind, book_id, body) values ($1, 'update', $2, 'hello')", [dee, book]));
    await asUser(db, ada, (tx) => tx.query("insert into public.follows (follower_id, following_id) values ($1, $2)", [ada, dee]));
    const before = await count(asUser(db, ada, (tx) => tx.query("select count(*) n from public.following_posts() where user_id = $1", [dee])));
    await asUser(db, ada, (tx) => tx.query("insert into public.mutes (muter_id, muted_id) values ($1, $2)", [ada, dee]));
    const after = await count(asUser(db, ada, (tx) => tx.query("select count(*) n from public.following_posts() where user_id = $1", [dee])));
    const disc = await count(asUser(db, ada, (tx) => tx.query("select count(*) n from public.discover_posts() where user_id = $1", [dee])));
    assert.equal(before, 1);
    assert.equal(after, 0);
    assert.equal(disc, 0);
  });
  test("reports: file your own, once per item, and only see your own", async () => {
    const file = (who: string) => pgError(asUser(db, who, (tx) => tx.query("insert into public.reports (target_type, target_id, reason) values ('profile', $1, 'spam')", [cy])));
    assert.equal(await file(ada), null);
    assert.equal(await file(ada), "23505");
    assert.equal(await count(asUser(db, ben, (tx) => tx.query("select count(*) n from public.reports"))), 0);
    assert.equal(await pgError(asUser(db, ada, (tx) => tx.query("update public.reports set status = 'dismissed'"))), "42501");
  });
});

describe("abuse limits and notifications", () => {
  test("liking, unliking and liking again notifies the author once", async () => {
    const p = await asUser(db, ada, (tx) => tx.query("insert into public.posts (user_id, kind, book_id, body) values ($1, 'update', $2, 'once') returning id", [ada, book]));
    const postId = (p.rows[0] as { id: string }).id;
    for (let i = 0; i < 3; i++) {
      await asUser(db, ben, (tx) => tx.query("insert into public.likes (user_id, post_id) values ($1, $2)", [ben, postId]));
      await asUser(db, ben, (tx) => tx.query("delete from public.likes where user_id = $1 and post_id = $2", [ben, postId]));
    }
    assert.equal(await count(db.query("select count(*) n from public.notifications where post_id = $1 and kind = 'like'", [postId])), 1);
  });
  test("comment floods are rate-limited", async () => {
    const p = await asUser(db, ada, (tx) => tx.query("insert into public.posts (user_id, kind, book_id, body) values ($1, 'update', $2, 'busy') returning id", [ada, book]));
    const postId = (p.rows[0] as { id: string }).id;
    let code: string | null = null;
    for (let i = 0; i < 25 && !code; i++) {
      code = await pgError(asUser(db, cy, (tx) => tx.query("insert into public.comments (post_id, user_id, body) values ($1, $2, $3)", [postId, cy, `c${i}`])));
    }
    assert.equal(code, "DG429");
  });
});

describe("shelf moves", () => {
  const move = (who: string, b: string, status: string | null, opts: { reread?: boolean; share?: boolean } = {}) =>
    asUser(db, who, (tx) =>
      tx.query("select public.set_shelf_status($1, $2::public.shelf_status, $3, $4) as r", [b, status, opts.reread ?? false, opts.share ?? false]),
    ).then((r) => (r.rows[0] as { r: { changed: boolean; undo?: Row } }).r);
  const sessions = (who: string, b: string) =>
    db.query("select status, is_reread from public.reading_sessions where user_id = $1 and book_id = $2 order by created_at", [who, b]).then((r) => r.rows as { status: string; is_reread: boolean }[]);
  const posts = (who: string, b: string) => count(db.query("select count(*) n from public.posts where user_id = $1 and book_id = $2 and kind in ('started','finished')", [who, b]));

  test("moving between shelves keeps one honest diary and posts nothing unless asked", async () => {
    const b = await addBook("Middlemarch");
    await move(ada, b, "want_to_read");
    await move(ada, b, "reading");
    await move(ada, b, "read");
    assert.deepEqual(await sessions(ada, b), [{ status: "finished", is_reread: false }]);
    assert.equal(await posts(ada, b), 0);

    // An accidental drag back to Reading reopens the read instead of starting a re-read…
    await move(ada, b, "reading");
    assert.deepEqual(await sessions(ada, b), [{ status: "reading", is_reread: false }]);
    await move(ada, b, "read");
    assert.deepEqual(await sessions(ada, b), [{ status: "finished", is_reread: false }]);
    // …and away and back to Read the same day isn't a second read.
    await move(ada, b, "want_to_read");
    await move(ada, b, "read");
    assert.equal((await sessions(ada, b)).filter((s) => s.status === "finished").length, 1);

    // A deliberate re-read is its own session.
    await move(ada, b, "reading", { reread: true });
    assert.deepEqual((await sessions(ada, b)).at(-1), { status: "reading", is_reread: true });
  });

  test("sharing is explicit, and undo puts everything back", async () => {
    const b = await addBook("Stoner");
    const r = await move(ben, b, "reading", { share: true });
    assert.equal(await posts(ben, b), 1);
    assert.equal((await sessions(ben, b)).length, 1);
    await asUser(db, ben, (tx) => tx.query("select public.undo_shelf_move($1)", [JSON.stringify(r.undo)]));
    assert.equal(await posts(ben, b), 0);
    assert.equal((await sessions(ben, b)).length, 0);
    assert.equal(await count(db.query("select count(*) n from public.user_books where user_id = $1 and book_id = $2", [ben, b])), 0);
  });

  test("undo restores a closed read and the previous shelf", async () => {
    const b = await addBook("Beloved");
    await move(cy, b, "reading");
    const r = await move(cy, b, "read");
    await asUser(db, cy, (tx) => tx.query("select public.undo_shelf_move($1)", [JSON.stringify(r.undo)]));
    assert.deepEqual(await sessions(cy, b), [{ status: "reading", is_reread: false }]);
    const ub = await one<{ status: string; finished_at: string | null }>(db.query("select status, finished_at from public.user_books where user_id = $1 and book_id = $2", [cy, b]));
    assert.equal(ub.status, "reading");
    assert.equal(ub.finished_at, null);
  });

  test("an undo record can only touch its owner's rows", async () => {
    const b = await addBook("Gilead");
    const r = await move(ada, b, "reading");
    await asUser(db, ben, (tx) => tx.query("select public.undo_shelf_move($1)", [JSON.stringify(r.undo)]));
    assert.equal((await sessions(ada, b)).length, 1);
  });

  test("signed-out callers can't move shelves", async () => {
    assert.equal(await pgError(asAnon(db, (tx) => tx.query("select public.set_shelf_status($1, 'read')", [book]))), "42501");
  });
});

describe("feeds", () => {
  test("following feed: you and the readers you follow, within visibility rules", async () => {
    const eve = await createUser(db, "eve");
    const fay = await createUser(db, "fay");
    await asUser(db, fay, (tx) => tx.query("insert into public.posts (user_id, kind, book_id, body, visibility) values ($1, 'update', $2, 'secret', 'followers')", [fay, book]));
    assert.equal(await count(asUser(db, eve, (tx) => tx.query("select count(*) n from public.following_posts() where user_id = $1", [fay]))), 0);
    await asUser(db, eve, (tx) => tx.query("insert into public.follows (follower_id, following_id) values ($1, $2)", [eve, fay]));
    assert.equal(await count(asUser(db, eve, (tx) => tx.query("select count(*) n from public.following_posts() where user_id = $1", [fay]))), 1);
    // Followers-only never shows in Discover.
    assert.equal(await count(asUser(db, ada, (tx) => tx.query("select count(*) n from public.discover_posts() where user_id = $1", [fay]))), 0);
  });
});
