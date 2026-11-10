import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { discoverCandidates, type SuggestionSources } from "../../src/lib/suggestions/discover.ts";
import {
  buildProfile,
  discoverySeeds,
  displayTitle,
  editionPopularity,
  entryWeight,
  explain,
  hasSignal,
  librarySignature,
  mergeCandidates,
  normSubject,
  rankCandidates,
  scoreCandidate,
  workKey,
  type Candidate,
  type LibraryEntry,
} from "../../src/lib/suggestions/engine.ts";

let n = 0;
function entry(over: Partial<LibraryEntry> = {}): LibraryEntry {
  n += 1;
  return {
    bookId: `book-${n}`, title: `Book ${n}`, authors: ["Someone Else"], genres: [], moods: [], subjects: [],
    status: "read", rating: null, favourite: false, olWorkId: null, isbn13: null, ...over,
  };
}
function cand(over: Partial<Candidate> = {}): Candidate {
  n += 1;
  return {
    bookId: null, slug: null, olWorkId: `OL${n}W`, olEditionId: null, isbn13: null, title: `Candidate ${n}`, authors: ["New Writer"],
    coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg", publishedYear: 1900, genres: [], moods: [], subjects: [], popularity: 0,
    origins: [{ kind: "subject", subject: "gothic" }], ...over,
  };
}

const dorian = entry({ title: "The Picture of Dorian Gray", authors: ["Oscar Wilde"], genres: ["gothic", "classics"], subjects: ["Art and morality", "Dandies", "Gothic fiction", "Portraits"], rating: 5 });

describe("normalising metadata", () => {
  test("catalogue noise is dropped, useful headings are cleaned", () => {
    assert.equal(normSubject("Fiction"), null);
    assert.equal(normSubject("Accessible book"), null);
    assert.equal(normSubject("nyt:hardcover-fiction=2020-01-01"), null);
    assert.equal(normSubject("Fiction, romance, general"), "romance");
    assert.equal(normSubject("Gothic fiction"), "gothic");
    assert.equal(normSubject("Murder -- Investigation"), "murder");
  });
  test("editions and subtitles of one book share a key", () => {
    assert.equal(workKey({ title: "The Brothers Karamazov: A Novel", authors: ["Fyodor Dostoevsky"] }), workKey({ title: "Brothers Karamazov (Penguin Classics)", authors: ["Fëdor Dostoevsky"] }));
    assert.notEqual(workKey({ title: "Emma", authors: ["Jane Austen"] }), workKey({ title: "Emma", authors: ["Someone Else"] }));
  });
});

describe("taste profile", () => {
  test("Read counts more than Reading, which counts more than Want to Read; ratings and favourites adjust", () => {
    assert.ok(entryWeight({ status: "read", rating: null, favourite: false }) > entryWeight({ status: "reading", rating: null, favourite: false }));
    assert.ok(entryWeight({ status: "reading", rating: null, favourite: false }) > entryWeight({ status: "want_to_read", rating: null, favourite: false }));
    assert.ok(entryWeight({ status: "read", rating: 5, favourite: false }) > entryWeight({ status: "read", rating: 2, favourite: false }));
    assert.ok(entryWeight({ status: "read", rating: null, favourite: true }) > entryWeight({ status: "read", rating: null, favourite: false }));
    assert.equal(entryWeight({ status: "dnf", rating: null, favourite: false }), 0);
  });

  test("the same candidate scores higher when its author is on Read than on Want to Read", () => {
    const c = cand({ authors: ["Shirley Jackson"] });
    const read = scoreCandidate(buildProfile([entry({ authors: ["Shirley Jackson"], status: "read", rating: 5 }), entry({ authors: ["Other"] })]), c);
    const want = scoreCandidate(buildProfile([entry({ authors: ["Shirley Jackson"], status: "want_to_read" }), entry({ authors: ["Other"], status: "read", rating: 5 })]), c);
    assert.ok(read.score > want.score, `${read.score} should beat ${want.score}`);
  });

  test("taste is aggregated across books: a theme shared by several books outweighs one book's quirk", () => {
    const library = [
      entry({ subjects: ["Haunted houses", "Grief"] }),
      entry({ subjects: ["Haunted houses", "Sisters"] }),
      entry({ subjects: ["Haunted houses"] }),
      entry({ subjects: ["Sailing"] }),
    ];
    const p = buildProfile(library);
    assert.equal(discoverySeeds(p).subjects[0], "haunted houses");
    const haunted = scoreCandidate(p, cand({ subjects: ["Haunted houses"] }));
    const sailing = scoreCandidate(p, cand({ subjects: ["Sailing"] }));
    assert.ok(haunted.score > sailing.score);
    assert.ok(haunted.components.library > sailing.components.library, "more of the library points at it");
  });
});

describe("scoring and explanations", () => {
  test("author matches explain themselves with the book that caused them", () => {
    const s = scoreCandidate(buildProfile([dorian]), cand({ title: "The Importance of Being Earnest", authors: ["Oscar Wilde"] }));
    assert.ok(s.components.author > 0.5);
    assert.equal(s.reasons[0].kind, "author");
    assert.equal(explain(s.reasons[0]), "Because you loved The Picture of Dorian Gray, also by Oscar Wilde.");
    assert.deepEqual(s.sourceBookIds.includes(dorian.bookId), true);
  });

  test("genre and subject matches name the shared themes and the book they come from", () => {
    const s = scoreCandidate(buildProfile([dorian]), cand({ title: "Carmilla", authors: ["Sheridan Le Fanu"], genres: ["gothic"], subjects: ["Gothic fiction", "Portraits", "Vampires"] }));
    assert.ok(s.components.topic > 0 && s.components.themes > 0);
    const themes = s.reasons.find((r) => r.kind === "themes");
    assert.ok(themes, "a themes reason");
    assert.match(explain(themes!), /^Similar themes to The Picture of Dorian Gray: .*portraits/);
  });

  test("every reason names only metadata that actually matched", () => {
    const p = buildProfile([dorian, entry({ authors: ["Mary Shelley"], genres: ["horror"], subjects: ["Monsters"] })]);
    const s = scoreCandidate(p, cand({ authors: ["Bram Stoker"], genres: ["horror"], subjects: ["Vampires"] }));
    for (const r of s.reasons) {
      const text = explain(r);
      assert.ok(!/Oscar Wilde|Dorian|Monsters|Vampires/.test(text), `unexpected claim: ${text}`);
    }
    assert.ok(s.reasons.some((r) => r.kind === "genre" && r.genre === "horror"));
  });

  test("a book with no metadata in common is not suggested", () => {
    const ranked = rankCandidates(buildProfile([dorian]), [cand({ authors: ["Nobody"], genres: ["cookery"], subjects: ["Baking"] })]);
    assert.equal(ranked.length, 0);
  });

  test("one book is enough to suggest from", () => {
    const ranked = rankCandidates(buildProfile([dorian]), [cand({ genres: ["gothic"], subjects: ["Gothic fiction", "Dandies"] })]);
    assert.equal(ranked.length, 1);
  });

  test("popularity only breaks ties; it never outranks taste", () => {
    const p = buildProfile([dorian]);
    const loved = scoreCandidate(p, cand({ subjects: ["Gothic fiction", "Dandies", "Art and morality"], popularity: 0 }));
    const famous = scoreCandidate(p, cand({ subjects: ["Gothic fiction"], popularity: 1 }));
    assert.ok(loved.score > famous.score);
    assert.equal(editionPopularity(1), 0);
    assert.equal(editionPopularity(5000), 1);
  });

  test("Dogear readers who loved the same book are named honestly", () => {
    const p = buildProfile([dorian]);
    const s = scoreCandidate(p, cand({ genres: ["gothic"], origins: [{ kind: "readers", count: 3, viaBookIds: [dorian.bookId] }] }));
    const r = s.reasons.find((x) => x.kind === "readers");
    assert.ok(r);
    assert.equal(explain(r!), "3 readers who loved The Picture of Dorian Gray also loved this.");
  });
});

describe("filtering", () => {
  const library = [
    entry({ title: "Rebecca", authors: ["Daphne du Maurier"], genres: ["gothic"], status: "read", olWorkId: "OL1W" }),
    entry({ title: "Jane Eyre", authors: ["Charlotte Brontë"], genres: ["gothic"], status: "reading", isbn13: "9780141441146" }),
    entry({ title: "Wuthering Heights", authors: ["Emily Brontë"], genres: ["gothic"], status: "want_to_read" }),
  ];
  const p = buildProfile(library);

  test("nothing already on Read, Reading or Want to Read comes back, under any edition", () => {
    const ranked = rankCandidates(p, [
      cand({ title: "Rebecca", authors: ["Daphne Du Maurier"], olWorkId: "OL1W", genres: ["gothic"] }),
      cand({ title: "Jane Eyre: An Autobiography", authors: ["Charlotte Bronte"], genres: ["gothic"] }),
      cand({ title: "Some edition", authors: ["X"], isbn13: "9780141441146", genres: ["gothic"] }),
      cand({ title: "Wuthering Heights (Penguin Classics)", authors: ["Emily Brontë"], genres: ["gothic"] }),
      cand({ title: "The Haunting of Hill House", authors: ["Shirley Jackson"], genres: ["gothic"] }),
    ]);
    assert.deepEqual(ranked.map((r) => r.candidate.title), ["The Haunting of Hill House"]);
  });

  test("dismissed (or already added) suggestions are never suggested again", () => {
    const hill = cand({ title: "The Haunting of Hill House", authors: ["Shirley Jackson"], genres: ["gothic"] });
    assert.equal(rankCandidates(p, [hill], { exclude: [`key:${workKey(hill)}`] }).length, 0);
    assert.equal(rankCandidates(p, [{ ...hill, title: "The Haunting of Hill House: A Novel" }], { exclude: [`key:${workKey(hill)}`] }).length, 0, "nor another edition of it");
    assert.equal(rankCandidates(p, [hill], { exclude: [`ol:${hill.olWorkId}`] }).length, 0);
  });

  test("duplicate editions found by different lookups merge into one suggestion", () => {
    const merged = mergeCandidates([
      cand({ title: "Carmilla", authors: ["J. Sheridan Le Fanu"], olWorkId: "OL9W", coverUrl: null, origins: [{ kind: "subject", subject: "vampires" }] }),
      cand({ title: "Carmilla", authors: ["Sheridan Le Fanu"], olWorkId: "OL9W", origins: [{ kind: "author", author: "Le Fanu" }] }),
    ]);
    assert.equal(merged.length, 1);
    assert.ok(merged[0].coverUrl, "keeps the cover from whichever copy had one");
    assert.equal(merged[0].origins.length, 2);
  });

  test("study guides and author-less records are skipped", () => {
    const ranked = rankCandidates(p, [
      cand({ title: "SparkNotes: The Haunting of Hill House", genres: ["gothic"] }),
      cand({ title: "Study Guide to Rebecca", genres: ["gothic"] }),
      cand({ title: "Untitled", authors: [], genres: ["gothic"] }),
    ]);
    assert.equal(ranked.length, 0);
  });

  test("one prolific author can't fill the top of the list", () => {
    const many = Array.from({ length: 6 }, (_, i) => cand({ title: `Jackson ${i}`, authors: ["Shirley Jackson"], genres: ["gothic"] }));
    const others = Array.from({ length: 4 }, (_, i) => cand({ title: `Other ${i}`, authors: [`Writer ${i}`], genres: ["gothic"] }));
    const top = rankCandidates(buildProfile([...library, entry({ authors: ["Shirley Jackson"], genres: ["gothic"], rating: 5 })]), [...many, ...others]).slice(0, 6);
    assert.ok(top.filter((s) => s.candidate.authors[0] === "Shirley Jackson").length <= 2);
  });
});

describe("edge cases", () => {
  test("an empty library has no signal and nothing to rank", () => {
    const p = buildProfile([]);
    assert.equal(hasSignal(p), false);
    assert.deepEqual(rankCandidates(p, [cand({ genres: ["gothic"] })]), []);
  });

  test("books with no metadata at all still give an author signal; favourite genres seed an otherwise thin profile", () => {
    const thin = buildProfile([entry({ authors: [], genres: [], subjects: [] })]);
    assert.equal(hasSignal(thin), false);
    const seeded = buildProfile([entry({ authors: [], genres: [], subjects: [] })], { genres: ["poetry"] });
    assert.equal(hasSignal(seeded), true);
    const s = scoreCandidate(seeded, cand({ genres: ["poetry"] }));
    assert.equal(explain(s.reasons[0]), "Because poetry is one of your favourite genres.");
  });

  test("the library fingerprint changes with shelf, rating or favourite, not with order", () => {
    const a = [entry({ bookId: "a" }), entry({ bookId: "b" })];
    assert.equal(librarySignature(a), librarySignature([...a].reverse()));
    assert.notEqual(librarySignature(a), librarySignature([{ ...a[0], status: "reading" }, a[1]]));
    assert.notEqual(librarySignature(a), librarySignature([{ ...a[0], rating: 4 }, a[1]]));
    assert.notEqual(librarySignature(a), librarySignature([a[0]]));
  });
});

describe("candidate discovery", () => {
  const p = buildProfile([dorian, entry({ authors: ["Shirley Jackson"], genres: ["horror"], subjects: ["Haunted houses"] })]);
  const ok = (c: Candidate[]) => async () => c;

  test("asks a bounded number of lookups and gathers every source", async () => {
    const calls: string[] = [];
    const sources: SuggestionSources = {
      subject: async (s) => (calls.push(`subject:${s}`), [cand({ subjects: [s] })]),
      author: async (a) => (calls.push(`author:${a}`), [cand({ authors: [a] })]),
      community: async () => (calls.push("community"), []),
      catalogue: async (g) => (calls.push(`catalogue:${g}`), []),
      workSubjects: async () => [],
    };
    const found = await discoverCandidates(p, sources);
    assert.ok(found.attempted <= 4 + 3 + 1 + 3);
    assert.ok(calls.includes("author:Oscar Wilde") && calls.includes("author:Shirley Jackson"));
    assert.ok(calls.some((c) => c.startsWith("subject:")));
    assert.equal(found.failed, 0);
    assert.ok(found.candidates.length > 0);
  });

  test("Open Library failing (null or throwing) is counted, and what did answer is still used", async () => {
    const sources: SuggestionSources = {
      subject: async () => null,
      author: async () => {
        throw new Error("timeout");
      },
      community: ok([cand({ title: "From readers", genres: ["gothic"] })]),
      catalogue: ok([]),
      workSubjects: async () => null,
    };
    const found = await discoverCandidates(p, sources);
    assert.ok(found.failed > 0);
    assert.deepEqual(found.candidates.map((c) => c.title), ["From readers"]);
  });
});

describe("presentation", () => {
  test("a named author leads over a broad genre, however strong the genre", () => {
    const library = Array.from({ length: 6 }, () => entry({ genres: ["literary fiction"], rating: 5 }));
    library.push(entry({ title: "Rebecca", authors: ["Daphne du Maurier"], genres: ["gothic"], rating: 5 }));
    const s = scoreCandidate(buildProfile(library), cand({ title: "Jamaica Inn", authors: ["Daphne du Maurier"], genres: ["literary fiction"] }));
    assert.equal(s.reasons[0].kind, "author");
  });
  test("all-lowercase Open Library titles get title case; others are left alone", () => {
    assert.equal(displayTitle("jamaica inn"), "Jamaica Inn");
    assert.equal(displayTitle("the name of the rose"), "The Name of the Rose");
    assert.equal(displayTitle("e.e. cummings — Selected"), "e.e. cummings — Selected");
  });
});
