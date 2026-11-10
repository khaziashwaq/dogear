// The suggestion lifecycle end to end over the local store, with Open Library replaced by fakes:
// shelf change → refresh → ranked, explained, persisted → dismiss / add → never again.
// Runs in a temporary working directory so the real .data/ demo database is never touched.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import type { SuggestionSources } from "../../src/lib/suggestions/discover.ts";
import type { Candidate } from "../../src/lib/suggestions/engine.ts";

const dir = mkdtempSync(path.join(tmpdir(), "dogear-suggest-"));
const home = process.cwd();
process.chdir(dir);
after(() => {
  process.chdir(home);
  rmSync(dir, { recursive: true, force: true });
});

type Store = import("../../src/lib/data/demo/store.ts").DemoStore;
type Service = typeof import("../../src/lib/suggestions/service.ts");
let as: (id: string) => Store;
let svc: Service;
let reader: (name: string) => string;
let book: (title: string, author: string, extra?: { genres?: string[]; subjects?: string[]; olWorkId?: string }) => string;

before(async () => {
  const { DemoStore } = await import("../../src/lib/data/demo/store.ts");
  const { getDemoDB, newId } = await import("../../src/lib/data/demo/db.ts");
  svc = await import("../../src/lib/suggestions/service.ts");
  const db = getDemoDB();
  as = (id) => new DemoStore(id);
  reader = (name) => {
    const id = newId();
    db.profiles.push({
      id, username: name, displayName: name, bio: "", avatarUrl: null, coverUrl: null, pronouns: null, location: null, website: null,
      accent: "burgundy", motif: "dogear", favouriteGenres: [], favouriteAuthors: [], readingGoal: null, onboarded: true, createdAt: new Date().toISOString(),
    });
    return id;
  };
  book = (title, author, extra = {}) => {
    const id = newId();
    db.books.push({
      id, slug: `${title.toLowerCase().replace(/\W+/g, "-")}-${id.slice(0, 6)}`, title, subtitle: null, authors: [author], description: null, coverUrl: null,
      isbn13: null, isbn10: null, olWorkId: extra.olWorkId ?? null, olEditionId: null, publishedYear: null, publisher: null, pageCount: null, language: null,
      genres: extra.genres ?? [], moods: [], subjects: extra.subjects ?? [], createdAt: new Date().toISOString(),
    });
    return id;
  };
});

let k = 0;
const ol = (title: string, author: string, subjects: string[], genres: string[] = []): Candidate => ({
  bookId: null, slug: null, olWorkId: `OL${900 + ++k}W`, olEditionId: null, isbn13: null, title, authors: [author],
  coverUrl: `https://covers.openlibrary.org/b/id/${k}-L.jpg?default=false`, publishedYear: 1900, genres, moods: [], subjects, popularity: 0.3,
  origins: [{ kind: "subject", subject: subjects[0] ?? "x" }],
});

/** Fake Open Library: a few gothic books, counting every call. */
function fakeSources(overrides: Partial<SuggestionSources> = {}) {
  const calls = { n: 0 };
  const shelf = [
    ol("Carmilla", "Sheridan Le Fanu", ["Gothic fiction", "Vampires", "Portraits"], ["gothic"]),
    ol("The Haunting of Hill House", "Shirley Jackson", ["Haunted houses", "Gothic fiction"], ["gothic", "horror"]),
    ol("Salome", "Oscar Wilde", ["Drama", "Decadence"]),
    ol("A Cookbook", "Chef", ["Baking"]),
  ];
  const sources: SuggestionSources = {
    subject: async () => (calls.n++, shelf),
    author: async () => (calls.n++, shelf),
    community: async () => [],
    catalogue: async () => [],
    workSubjects: async () => (calls.n++, ["Art and morality", "Dandies"]),
    ...overrides,
  };
  return { sources, calls };
}

const titles = async (s: Store) => (await s.listSuggestions(null, 50)).items.map((x) => x.book.title).sort();

describe("suggestion lifecycle", () => {
  test("empty library: nothing suggested, and the page explains why", async () => {
    const me = reader("sug_empty");
    const view = await svc.loadSuggestions(as(me), fakeSources().sources);
    assert.equal(view.state, "empty-library");
  });

  test("adding a book builds explained suggestions, excluding everything shelved and anything unrelated", async () => {
    const me = reader("sug_one");
    const s = as(me);
    const dorian = book("The Picture of Dorian Gray", "Oscar Wilde", { genres: ["gothic"], olWorkId: "OL1W" });
    await s.setShelfStatus(dorian, "read");
    await s.setRating(dorian, 5);
    const { sources } = fakeSources();
    const view = await svc.loadSuggestions(s, sources);
    assert.equal(view.state, "ready");
    assert.deepEqual(await titles(s), ["Carmilla", "Salome", "The Haunting of Hill House"]);
    // Subject headings were fetched once for the shelved book and stored on the catalogue record.
    assert.deepEqual((await s.tasteLibrary())[0].subjects, ["Art and morality", "Dandies"]);
    const salome = (await s.listSuggestions(null, 50)).items.find((x) => x.book.title === "Salome")!;
    assert.equal(salome.reasons[0].kind, "author");
    assert.ok(salome.sourceBookIds.includes(dorian));
  });

  test("unchanged shelves: no lookups at all; a shelf change rebuilds once", async () => {
    const me = reader("sug_idem");
    const s = as(me);
    await s.setShelfStatus(book("Dracula", "Bram Stoker", { genres: ["gothic"] }), "read");
    const { sources, calls } = fakeSources();
    await svc.refreshSuggestions(s, sources);
    const before = calls.n;
    assert.equal((await svc.refreshSuggestions(s, sources)).outcome, "fresh");
    assert.equal(calls.n, before, "no Open Library calls when nothing changed");
    // Moving a book between shelves is a change.
    await s.setShelfStatus(book("Frankenstein", "Mary Shelley", { genres: ["gothic"] }), "want_to_read");
    assert.equal((await svc.refreshSuggestions(s, sources)).outcome, "refreshed");
  });

  test("dismissed books stay gone through later refreshes; Undo brings them back", async () => {
    const me = reader("sug_dismiss");
    const s = as(me);
    await s.setShelfStatus(book("Rebecca", "Daphne du Maurier", { genres: ["gothic"] }), "read");
    const { sources } = fakeSources();
    await svc.refreshSuggestions(s, sources);
    const carmilla = (await s.listSuggestions(null, 50)).items.find((x) => x.book.title === "Carmilla")!;
    await s.setSuggestionStatus(carmilla.id, "dismissed");
    await s.setShelfStatus(book("Jamaica Inn", "Daphne du Maurier", { genres: ["gothic"] }), "reading");
    await svc.refreshSuggestions(s, sources);
    assert.ok(!(await titles(s)).includes("Carmilla"));
    await s.setSuggestionStatus(carmilla.id, "suggested");
    assert.ok((await titles(s)).includes("Carmilla"));
  });

  test("a suggestion added to Want to Read is marked added and never suggested again", async () => {
    const me = reader("sug_add");
    const s = as(me);
    await s.setShelfStatus(book("Jane Eyre", "Charlotte Brontë", { genres: ["gothic"] }), "read");
    const { sources } = fakeSources();
    await svc.refreshSuggestions(s, sources);
    const hill = (await s.listSuggestions(null, 50)).items.find((x) => x.book.title === "The Haunting of Hill House")!;
    // What addSuggestionAction does: add to the catalogue, shelve, mark added.
    const saved = await s.upsertBook({ ...hill.book, olWorkId: hill.book.olWorkId });
    await s.setShelfStatus(saved.id, "want_to_read");
    await s.setSuggestionStatus(hill.id, "added");
    await svc.refreshSuggestions(s, sources);
    assert.ok(!(await titles(s)).includes("The Haunting of Hill House"));
    assert.equal((await s.closedSuggestionKeys()).includes(`ol:${hill.book.olWorkId}`), true);
  });

  test("removing the last book clears what's waiting", async () => {
    const me = reader("sug_remove");
    const s = as(me);
    const b = book("Carmilla's cousin", "Anon", { genres: ["gothic"] });
    await s.setShelfStatus(b, "read");
    await svc.refreshSuggestions(s, fakeSources().sources);
    assert.ok((await titles(s)).length > 0);
    await s.setShelfStatus(b, null);
    assert.equal((await svc.loadSuggestions(s, fakeSources().sources)).state, "empty-library");
    assert.deepEqual(await titles(s), []);
  });

  test("Open Library down: the current list is kept, and the next visit backs off instead of hammering", async () => {
    const me = reader("sug_offline");
    const s = as(me);
    await s.setShelfStatus(book("Dracula", "Bram Stoker", { genres: ["gothic"] }), "read");
    await svc.refreshSuggestions(s, fakeSources().sources);
    const kept = await titles(s);
    await s.setShelfStatus(book("The Monk", "Matthew Lewis", { genres: ["gothic"] }), "read");
    let calls = 0;
    const down = fakeSources({
      subject: async () => (calls++, null),
      author: async () => {
        calls++;
        throw new Error("timeout");
      },
      workSubjects: async () => null,
    }).sources;
    assert.equal((await svc.refreshSuggestions(s, down)).outcome, "failed");
    assert.deepEqual(await titles(s), kept);
    const before = calls;
    assert.equal((await svc.refreshSuggestions(s, down)).outcome, "busy");
    assert.equal(calls, before, "no new lookups during the backoff");
    const view = await svc.loadSuggestions(s, down, 12);
    assert.equal(view.state, "ready");
  });

  test("suggestions are private to their reader", async () => {
    const [me, other] = [reader("sug_priv_a"), reader("sug_priv_b")];
    await as(me).setShelfStatus(book("Rebecca 2", "Daphne du Maurier", { genres: ["gothic"] }), "read");
    await svc.refreshSuggestions(as(me), fakeSources().sources);
    const mine = (await as(me).listSuggestions(null, 50)).items;
    assert.ok(mine.length > 0);
    assert.equal((await as(other).listSuggestions(null, 50)).items.length, 0);
    assert.equal(await as(other).getSuggestion(mine[0].id), null);
    await assert.rejects(as(other).setSuggestionStatus(mine[0].id, "dismissed"));
  });
});

describe("Open Library titles", () => {
  test("the English title wins over a translation or the original script", async () => {
    const { englishTitle } = await import("../../src/lib/openlibrary.ts");
    assert.equal(englishTitle("Der Sundenbock - Roman", "The Scapegoat"), "The Scapegoat");
    assert.equal(englishTitle("Crime and Punishment", "Преступление и наказание"), "Crime and Punishment");
    assert.equal(englishTitle("Kafka on the Shore", "海辺のカフカ"), "Kafka on the Shore");
    assert.equal(englishTitle(undefined, "jamaica inn"), "Jamaica Inn");
  });
});
