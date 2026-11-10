import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BookshelfRow, SpineMark } from "@/components/book/bookshelf";
import { DiscoverTile } from "@/components/feed/discover-tile";
import { ListCard } from "@/components/list/list-card";
import { ReaderCard } from "@/components/profile/reader-card";
import { ReviewCard } from "@/components/review/review-card";
import { chipClass } from "@/components/ui/chip";
import { Sparkle } from "@/components/ui/doodles";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { SearchBox } from "@/components/ui/search-box";
import { SuggestionsFeed, SuggestionsSkeleton } from "@/components/suggestions/suggestions-feed";
import { getStore, getViewer } from "@/lib/auth";
import { GENRES, MOODS } from "@/lib/data/seed/books";
import { MOOD_RULES } from "@/lib/moods";
import { openLibrarySubject } from "@/lib/openlibrary";
import type { Book, Profile, SavedBook } from "@/lib/types";
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
    if (local.length < 12) {
      // Fill out from Open Library: the genre's subject, or the headings that define the mood
      // (src/lib/moods.ts), so these pages are never empty just because few books are shelved yet.
      const seen = new Set(local.map((b) => b.title.toLowerCase()));
      const subjects = genre ? [genre] : (MOOD_RULES[mood!]?.subjects ?? []);
      const found = (await Promise.all(subjects.map((sub) => openLibrarySubject(sub, 18)))).flat();
      for (const b of found) {
        const k = b.title.toLowerCase();
        if (!seen.has(k)) {
          seen.add(k);
          more.push(b);
        }
      }
      more = more.slice(0, 24);
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
          <BookshelfRow
            className="mt-8"
            label={`${genre ?? m?.label} books`}
            size="md"
            priorityCount={6}
            items={[...local, ...more].map((b) => ({ key: b.id ?? b.olWorkId ?? b.title, book: b }))}
          />
        )}
        {more.length > 0 && <p className="meta mt-8 text-center">More {genre} from Open Library</p>}
      </div>
    );
  }

  const viewer = await getViewer();
  const [trending, feed, lists, suggested, recent, fromCircle, similar] = await Promise.all([
    store.trendingBooks(12),
    store.getFeed("discover", null, 30),
    store.popularLists(6),
    store.suggestedReaders(6),
    store.recentlyReviewedBooks(8),
    viewer ? lovedByFollowing(viewer.id) : Promise.resolve([]),
    viewer ? store.similarReaders(6) : Promise.resolve([]),
  ]);
  // Suggestions that aren't already in "similar taste".
  const readers = suggested.filter((r) => !similar.some((s) => s.profile.id === r.id));
  const popularReviews = feed.items
    .flatMap((p) => (p.kind === "review" && p.review && !p.review.containsSpoilers ? [{ review: p.review, likes: p.likesCount }] : []))
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 3);
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

      {viewer && (
        <section className="mt-12 max-w-3xl" aria-labelledby="for-you">
          <SectionHeading kicker="from your shelves" title="Suggested for you" href="/discover/for-you" action="All suggestions" />
          <h2 id="for-you" className="sr-only">Suggested for you</h2>
          <Suspense fallback={<SuggestionsSkeleton compact />}>
            <SuggestionsFeed compact />
          </Suspense>
        </section>
      )}

      {trending.length > 0 && (
        <section className="mt-12" aria-labelledby="trending">
          <SectionHeading kicker="this month" title="Trending books" />
          <h2 id="trending" className="sr-only">Trending books</h2>
          <BookshelfRow
            label="Trending books"
            layout="scroll"
            size="md"
            priorityCount={4}
            className="-mx-4 px-4 sm:mx-0 sm:px-0"
            items={trending.map((b, i) => ({
              key: b.id,
              book: b,
              mark: <SpineMark>{i + 1}</SpineMark>,
            }))}
          />
        </section>
      )}

      {fromCircle.length > 0 && (
        <section className="mt-12" aria-labelledby="circle-h">
          <SectionHeading kicker="from your circle" title="Loved by readers you follow" />
          <h2 id="circle-h" className="sr-only">Loved by readers you follow</h2>
          <BookshelfRow
            label="Loved by readers you follow"
            layout="scroll"
            size="md"
            className="-mx-4 px-4 sm:mx-0 sm:px-0"
            items={fromCircle.map(({ book, by }) => ({
              key: book.id,
              book,
              details: (
                <p className="hand text-lg leading-none text-burgundy">
                  loved by {by.slice(0, 2).map((p) => p.displayName.split(" ")[0]).join(" & ")}
                  {by.length > 2 ? ` +${by.length - 2}` : ""}
                </p>
              ),
            }))}
          />
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

      {popularReviews.length > 0 && (
        <section className="mt-14">
          <SectionHeading kicker="the margins" title="Popular reviews" />
          <div className="grid gap-5 lg:grid-cols-3">
            {popularReviews.map(({ review }) => <ReviewCard key={review.id} review={review} showBook />)}
          </div>
        </section>
      )}

      {lists.length > 0 && (
        <section className="mt-14">
          <SectionHeading kicker="collections" title="Trending lists" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((l) => <ListCard key={l.id} list={l} />)}
          </div>
        </section>
      )}

      {similar.length > 0 && (
        <section className="mt-14" id="similar">
          <SectionHeading kicker="kindred spirits" title="Readers with similar taste" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {similar.map((r) => (
              <ReaderCard
                key={r.profile.id}
                profile={r.profile}
                // A low percentage reads as a put-down; the reasons say enough on their own.
                match={r.score >= 20 ? r.score : undefined}
                why={[
                  r.sharedBooks ? `${r.sharedBooks} ${r.sharedBooks === 1 ? "book" : "books"} in common` : null,
                  r.agreement != null && r.agreement >= 0.75 ? "you rate them alike" : null,
                  r.sharedFavourites ? `${r.sharedFavourites} shared ${r.sharedFavourites === 1 ? "favourite" : "favourites"}` : null,
                  r.sharedAuthors.length ? `both love ${r.sharedAuthors.slice(0, 2).join(" & ")}` : null,
                  !r.sharedAuthors.length && r.sharedGenres.length ? `both read ${r.sharedGenres.slice(0, 2).join(" & ")}` : null,
                ].filter((x): x is string => Boolean(x)).slice(0, 3)}
              />
            ))}
          </div>
        </section>
      )}

      {readers.length > 0 && (
        <section className="mt-14" id="readers">
          <SectionHeading kicker="say hello" title="Interesting readers" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {readers.map((r) => <ReaderCard key={r.id} profile={r} />)}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="mt-14">
          <SectionHeading kicker="fresh ink" title="Recently reviewed" />
          <BookshelfRow label="Recently reviewed" size="sm" items={recent.map((b) => ({ key: b.id, book: b }))} />
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

/**
 * Books the people you follow rated 4★ or more that aren't on any of your shelves yet,
 * most-loved first. Reads at most eight followed readers' shelves.
 */
async function lovedByFollowing(viewerId: string): Promise<{ book: SavedBook; by: Profile[]; score: number }[]> {
  const store = await getStore();
  const [following, mine] = await Promise.all([store.listFollowing(viewerId), store.getShelf(viewerId, {})]);
  if (following.length === 0) return [];
  const have = new Set(mine.map((ub) => ub.bookId));
  const shelves = await Promise.all(following.slice(0, 8).map(async (p) => ({ p, books: await store.getShelf(p.id, { status: "read", sort: "rating" }) })));
  const picks = new Map<string, { book: SavedBook; by: Profile[]; score: number }>();
  for (const { p, books } of shelves) {
    for (const ub of books) {
      if (have.has(ub.bookId) || (ub.rating ?? 0) < 4) continue;
      const entry = picks.get(ub.bookId) ?? { book: ub.book, by: [], score: 0 };
      entry.by.push(p);
      entry.score += ub.rating ?? 0;
      picks.set(ub.bookId, entry);
    }
  }
  return [...picks.values()].sort((a, b) => b.by.length - a.by.length || b.score - a.score).slice(0, 14);
}
