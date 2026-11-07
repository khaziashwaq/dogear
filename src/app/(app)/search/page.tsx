import type { Metadata } from "next";
import { BookshelfRow } from "@/components/book/bookshelf";
import { ReaderRow } from "@/components/profile/reader-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchBox } from "@/components/ui/search-box";
import { SectionHeading } from "@/components/ui/section-heading";
import { getStore } from "@/lib/auth";
import { searchOpenLibrary } from "@/lib/openlibrary";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 120) : "";
  const store = await getStore();
  const [local, remote, readers] = q
    ? await Promise.all([store.searchBooks(q, 12), searchOpenLibrary(q, 24), store.searchProfiles(q, 8)])
    : [[], [], []];
  const seen = new Set(local.flatMap((b) => [b.olWorkId, `${b.title.toLowerCase()}|${b.authors[0]?.toLowerCase()}`]));
  const fromOL = remote.filter((b) => !seen.has(b.olWorkId) && !seen.has(`${b.title.toLowerCase()}|${b.authors[0]?.toLowerCase()}`));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-5xl leading-none">Search<span className="text-burgundy">.</span></h1>
      <SearchBox defaultValue={q} className="mt-5 max-w-xl" autoFocus={!q} />
      {!q ? (
        <p className="hand mt-8 text-2xl text-ink-soft">try a title, an author, an ISBN, or a reader&rsquo;s name</p>
      ) : local.length + fromOL.length + readers.length === 0 ? (
        <EmptyState className="mt-10" title={`Nothing for “${q}”`} body="Check the spelling, try just the author's surname, or paste an ISBN." />
      ) : (
        <div className="mt-10 space-y-12">
          {readers.length > 0 && (
            <section>
              <SectionHeading title="Readers" />
              <div className="grid gap-4 sm:grid-cols-2">{readers.map((p) => <ReaderRow key={p.id} profile={p} note={p.bio.slice(0, 60)} />)}</div>
            </section>
          )}
          {local.length > 0 && (
            <section>
              <SectionHeading kicker="on dogear." title="Books readers have shelved" />
              <BookshelfRow label="Books readers have shelved" size="md" priorityCount={8} items={local.map((b) => ({ key: b.id ?? b.title, book: b }))} />
            </section>
          )}
          {fromOL.length > 0 && (
            <section>
              <SectionHeading kicker="from Open Library" title="More books" />
              <BookshelfRow label="More books from Open Library" size="md" items={fromOL.map((b) => ({ key: b.olWorkId ?? b.title, book: b }))} />
            </section>
          )}
          {remote.length === 0 && local.length > 0 && <p className="meta">Open Library didn&rsquo;t respond — showing books already on dogear.</p>}
        </div>
      )}
    </div>
  );
}
