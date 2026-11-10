import "server-only";
import type { DataStore } from "@/lib/data/store";
import { subjectsToMoods } from "@/lib/moods";
import {
  openLibraryAuthorWorks,
  openLibrarySubjectWorks,
  openLibraryWorkSubjects,
  subjectsToGenres,
  type OpenLibraryWorkSummary,
} from "@/lib/openlibrary";
import type { SavedBook } from "@/lib/types";
import type { SuggestionSources } from "./discover";
import { editionPopularity, type Candidate, type Origin } from "./engine";

function fromOpenLibrary(w: OpenLibraryWorkSummary, origin: Origin): Candidate {
  return {
    bookId: null, slug: null, olWorkId: w.olWorkId, olEditionId: w.olEditionId, isbn13: null, title: w.title, authors: w.authors,
    coverUrl: w.coverUrl, publishedYear: w.publishedYear, genres: subjectsToGenres(w.subjects), moods: subjectsToMoods(w.subjects),
    subjects: w.subjects, popularity: editionPopularity(w.editionCount), origins: [origin],
  };
}

function fromCatalogue(b: SavedBook, subjects: string[], origin: Origin): Candidate {
  return {
    bookId: b.id, slug: b.slug, olWorkId: b.olWorkId, olEditionId: b.olEditionId, isbn13: b.isbn13, title: b.title, authors: b.authors,
    coverUrl: b.coverUrl, publishedYear: b.publishedYear, genres: b.genres, moods: b.moods, subjects, popularity: 0, origins: [origin],
  };
}

/** The real sources: Open Library (cached a day per lookup) and the reader's own Dogear data. */
export function liveSources(store: DataStore): SuggestionSources {
  return {
    async subject(subject) {
      const works = await openLibrarySubjectWorks(subject, 24);
      return works?.map((w) => fromOpenLibrary(w, { kind: "subject", subject })) ?? null;
    },
    async author(name) {
      const works = await openLibraryAuthorWorks(name, 12);
      return works?.map((w) => fromOpenLibrary(w, { kind: "author", author: name })) ?? null;
    },
    async community() {
      const rows = await store.coShelvedBooks(30);
      return rows.map((r) => fromCatalogue(r.book, r.subjects, { kind: "readers", count: r.readers, viaBookIds: r.viaBookIds }));
    },
    async catalogue(genre) {
      const books = await store.booksByGenre(genre, 24);
      return books.map((b) => fromCatalogue(b, b.subjects ?? [], { kind: "catalogue", genre }));
    },
    workSubjects: (olWorkId) => openLibraryWorkSubjects(olWorkId),
  };
}
