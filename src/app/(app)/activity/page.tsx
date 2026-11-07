import type { Metadata } from "next";
import Link from "next/link";
import { loadFeedAction } from "@/app/actions/social";
import { BookshelfRow, SpineMark } from "@/components/book/bookshelf";
import { Composer } from "@/components/feed/composer";
import { FeedList } from "@/components/feed/feed-list";
import { ReaderRow } from "@/components/profile/reader-card";
import { ButtonLink } from "@/components/ui/button";
import { Sparkle } from "@/components/ui/doodles";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireViewer, getStore } from "@/lib/auth";
import { bookHref } from "@/lib/book-ref";
import { authorLine, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage({ searchParams }: PageProps<"/activity">) {
  const viewer = await requireViewer("/activity");
  const sp = await searchParams;
  const tab = sp.tab === "discover" ? "discover" : "following";
  const store = await getStore();
  const [feed, reading, suggested, trending] = await Promise.all([
    store.getFeed(tab, null),
    store.getShelf(viewer.id, { status: "reading" }),
    store.suggestedReaders(4),
    store.trendingBooks(5),
  ]);

  const load = async (cursor: string) => {
    "use server";
    return loadFeedAction(tab, cursor);
  };

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Reading past midnight" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    // Feed and sidebar sit together and centre as a pair, so extra width becomes even margins, not a gap between them.
    <div className="grid gap-10 lg:grid-cols-[minmax(0,44rem)_300px] lg:justify-center">
      <div className="min-w-0 max-w-2xl lg:max-w-none">
        <header className="mb-6">
          <p className="meta">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="mt-1 text-4xl leading-none sm:text-5xl">
            {greeting}, <span className="italic text-burgundy">{viewer.displayName.split(" ")[0] || viewer.username}</span>
          </h1>
        </header>

        <Composer viewer={viewer} suggestions={reading.map((r) => r.book)} autoFocus={sp.compose === "1"} />

        <nav aria-label="Feed" className="sticky top-[57px] z-10 -mx-4 mt-8 flex gap-6 border-b border-line bg-paper/95 px-4 backdrop-blur md:top-0 md:mx-0 md:px-0">
          {(["following", "discover"] as const).map((t) => (
            <Link
              key={t}
              href={t === "following" ? "/activity" : "/activity?tab=discover"}
              aria-current={tab === t ? "page" : undefined}
              className={cn("relative py-3 font-serif text-xl capitalize transition-colors", tab === t ? "text-ink" : "text-ink-faint hover:text-ink")}
            >
              {t}
              {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-burgundy" />}
            </Link>
          ))}
        </nav>

        <div className="mt-6">
          <FeedList
            key={tab}
            initial={feed}
            load={load}
            empty={
              <EmptyState
                title={tab === "following" ? "Your feed is a blank page" : "Nothing new out there yet"}
                body={tab === "following" ? "Follow a few readers and their reviews, quotes and lists will show up here." : "Be the first: post an update or share a quote."}
                note="every great shelf starts with one book"
                action={<><ButtonLink href="/discover">Find readers</ButtonLink><ButtonLink href="/activity?tab=discover" variant="paper">See Discover</ButtonLink></>}
              />
            }
          />
        </div>
      </div>

      <aside className="hidden space-y-10 lg:block">
        <section>
          <SectionHeading kicker="on the nightstand" title="Currently reading" href={`/u/${viewer.username}/shelves?status=reading`} action="Shelf" />
          {reading.length === 0 ? (
            <p className="text-sm text-ink-soft">Nothing on the go. <Link href="/discover" className="link-underline text-burgundy">Find your next book</Link>.</p>
          ) : (
            <BookshelfRow
              label="Currently reading"
              layout="fit"
              size="sm"
              fitCount={6}
              items={reading.slice(0, 4).map((ub) => {
                const pct = ub.progressPages && ub.book.pageCount ? Math.min(100, Math.round((ub.progressPages / ub.book.pageCount) * 100)) : null;
                return {
                  key: ub.id,
                  book: ub.book,
                  mark: pct != null ? <SpineMark>{pct}</SpineMark> : undefined,
                  details:
                    pct != null ? (
                      <div className="flex items-center gap-1.5">
                        <div className="h-1 flex-1 rounded-full bg-paper-shade"><div className="h-full rounded-full bg-sage-deep" style={{ width: `${pct}%` }} /></div>
                        <span className="meta text-[0.625rem]">{pct}%</span>
                      </div>
                    ) : undefined,
                };
              })}
            />
          )}
        </section>

        {suggested.length > 0 && (
          <section>
            <SectionHeading kicker="kindred spirits" title="Readers to follow" href="/discover#readers" />
            <div className="space-y-4">
              {suggested.map((p) => <ReaderRow key={p.id} profile={p} note={p.favouriteGenres.slice(0, 2).join(" · ")} />)}
            </div>
          </section>
        )}

        {trending.length > 0 && (
          <section className="relative">
            <Sparkle className="absolute -right-1 top-0 text-burgundy" />
            <SectionHeading kicker="this month" title="Everyone's reading" href="/discover" />
            <ol className="space-y-3">
              {trending.map((b, i) => (
                <li key={b.id}>
                  <Link href={bookHref(b)} className="group flex items-baseline gap-3">
                    <span className="w-5 font-serif text-2xl italic text-rose-deep">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-serif text-lg leading-tight group-hover:text-burgundy">{b.title}</span>
                      <span className="meta block truncate normal-case tracking-normal">{authorLine(b.authors)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}
      </aside>
    </div>
  );
}
