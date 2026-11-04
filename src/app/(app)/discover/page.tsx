import type { Metadata } from "next";
import Link from "next/link";
import { BookTile } from "@/components/book/book-tile";
import { DiscoverTile } from "@/components/feed/discover-tile";
import { ListCard } from "@/components/list/list-card";
import { ReaderCard } from "@/components/profile/reader-card";
import { chipClass } from "@/components/ui/chip";
import { Sparkle } from "@/components/ui/doodles";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { SearchBox } from "@/components/ui/search-box";
import { getStore } from "@/lib/auth";
import { GENRES, MOODS } from "@/lib/data/seed/books";
import { openLibrarySubject } from "@/lib/openlibrary";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Discover" };

export default async function DiscoverPage({ searchParams }: PageProps<"/discover">) {
  const sp = await searchParams;
  const genre = typeof sp.genre === "string" && (GENRES as readonly string[]).includes(sp.genre) ? sp.genre : null;
  const mood = typeof sp.mood === "string" && MOODS.some((m) => m.key === sp.mood) ? sp.mood : null;
  const store = await getStore();

  const filterBar = (
    <div className="space-y-3">
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <span className="meta shrink-0 self-center pr-1">mood</span>
        {MOODS.map((m) => (
          <Link key={m.key} href={mood === m.key ? "/discover" : `/discover?mood=${m.key}`} className={chipClass("rose", mood === m.key, "shrink-0")} aria-current={mood === m.key ? "page" : undefined}>
            {m.label}
          </Link>
        ))}
      </div>
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <span className="meta shrink-0 self-center pr-1">genre</span>
        {GENRES.map((g) => (
          <Link key={g} href={genre === g ? "/discover" : `/discover?genre=${encodeURIComponent(g)}`} className={chipClass("sage", genre === g, "shrink-0")} aria-current={genre === g ? "page" : undefined}>
            {g}
          </Link>
        ))}
      </div>
    </div>
  );

  if (genre || mood) {
    const local = genre ? await store.booksByGenre(genre, 30) : await store.booksByMood(mood!, 30);
    let more: Book[] = [];
    if (genre && local.length < 12) {
      const seen = new Set(local.map((b) => b.title.toLowerCase()));
      more = (await openLibrarySubject(genre, 18)).filter((b) => !seen.has(b.title.toLowerCase()));
    }
    const m = MOODS.find((x) => x.key === mood);
    return (
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <Link href="/discover" className="meta hover:text-ink">← all of discover</Link>
          <h1 className="mt-2 text-5xl capitalize leading-none sm:text-6xl">
            {genre ?? m?.label}
            <span className="text-burgundy">.</span>
          </h1>
          {m && <p className="hand mt-1 text-2xl text-ink-soft">{m.blurb}</p>}
        </header>
        {filterBar}
        {local.length + more.length === 0 ? (
          <EmptyState className="mt-10" title="No books here yet" body="Readers haven't tagged anything with this one. Search for a favourite and add it to your shelf." />
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
            {[...local, ...more].map((b, i) => <BookTile key={b.id ?? b.olWorkId} book={b} priority={i < 6} />)}
          </div>
        )}
        {more.length > 0 && <p className="meta mt-8 text-center">More {genre} from Open Library</p>}
      </div>
    );
  }

  const [trending, feed, lists, readers, recent] = await Promise.all([
    store.trendingBooks(12),
    store.getFeed("discover", null, 30),
    store.popularLists(6),
    store.suggestedReaders(6),
    store.recentlyReviewedBooks(8),
  ]);
  const tiles = feed.items.filter((p) => ["quote", "list", "review", "finished", "recommendation"].includes(p.kind === "repost" ? p.repostOf?.kind ?? "" : p.kind));

  return (
    <div className="mx-auto max-w-6xl">
      <header className="relative mb-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="meta text-burgundy">wander without a map</p>
          <h1 className="mt-1 text-5xl leading-none sm:text-6xl">Discover<span className="text-burgundy">.</span></h1>
          <p className="hand mt-1 text-2xl text-ink-soft">see what other people can&rsquo;t stop talking about</p>
        </div>
        <SearchBox className="md:w-80" />
        <Sparkle className="absolute right-2 top-0 hidden text-burgundy md:block" />
      </header>
      {filterBar}

      {trending.length > 0 && (
        <section className="mt-12" aria-labelledby="trending">
          <SectionHeading kicker="this month" title="Trending books" />
          <h2 id="trending" className="sr-only">Trending books</h2>
          <ul className="scrollbar-none -mx-4 flex gap-5 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
            {trending.map((b, i) => (
              <li key={b.id} className="relative w-28 shrink-0 sm:w-32">
                <span className="absolute -left-2 -top-3 z-10 font-serif text-4xl italic text-burgundy drop-shadow-[1px_1px_0_var(--color-paper)]">{i + 1}</span>
                <BookTile book={b} priority={i < 4} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12" aria-labelledby="pinboard">
        <SectionHeading kicker="from readers" title="The pinboard" />
        <h2 id="pinboard" className="sr-only">Community pinboard</h2>
        {tiles.length === 0 ? (
          <EmptyState title="The pinboard is empty" body="Quotes, lists and reviews from readers land here." />
        ) : (
          <div className="masonry columns-1 sm:columns-2 lg:columns-3">
            {tiles.map((p) => <div key={p.id}><DiscoverTile post={p} /></div>)}
          </div>
        )}
      </section>

      {lists.length > 0 && (
        <section className="mt-14">
          <SectionHeading kicker="collections" title="Popular lists" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((l) => <ListCard key={l.id} list={l} />)}
          </div>
        </section>
      )}

      {readers.length > 0 && (
        <section className="mt-14" id="readers">
          <SectionHeading kicker="kindred spirits" title="Interesting readers" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {readers.map((r) => <ReaderCard key={r.id} profile={r} />)}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="mt-14">
          <SectionHeading kicker="fresh ink" title="Recently reviewed" />
          <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-8">
            {recent.map((b) => <BookTile key={b.id} book={b} />)}
          </div>
        </section>
      )}

      <section className={cn("mt-14 grid gap-3 sm:grid-cols-3 lg:grid-cols-4")} aria-label="Moods">
        {MOODS.slice(0, 8).map((m, i) => (
          <Link key={m.key} href={`/discover?mood=${m.key}`} className={cn("group border border-line-strong p-5 transition-transform hover:-translate-y-1", ["bg-rose/40", "bg-butter/60", "bg-sage/40", "bg-paper-deep"][i % 4])} style={{ rotate: `${[-0.6, 0.4, 0.8, -0.3][i % 4]}deg` }}>
            <p className="font-serif text-2xl italic group-hover:text-burgundy">{m.label}</p>
            <p className="hand text-lg text-ink-soft">{m.blurb}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
