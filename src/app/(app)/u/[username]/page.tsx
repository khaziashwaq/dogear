import Link from "next/link";
import { notFound } from "next/navigation";
import { loadUserPostsAction } from "@/app/actions/social";
import { BookshelfRow } from "@/components/book/bookshelf";
import { FeedList } from "@/components/feed/feed-list";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { getStore, getViewer } from "@/lib/auth";
import { lookupProfile } from "@/lib/profile-lookup";
import { ButtonLink } from "@/components/ui/button";

export default async function ProfileOverview({ params }: PageProps<"/u/[username]">) {
  const profile = await lookupProfile((await params).username);
  if (!profile) notFound();
  const [store, viewer] = await Promise.all([getStore(), getViewer()]);
  const own = viewer?.id === profile.id;
  const [favourites, reading, posts] = await Promise.all([
    store.getFavouriteBooks(profile.id, 4),
    store.getShelf(profile.id, { status: "reading" }),
    store.getUserPosts(profile.id, null),
  ]);
  const load = async (cursor: string) => {
    "use server";
    return loadUserPostsAction(profile.id, cursor);
  };

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-12">
        <section aria-labelledby="favs">
          <SectionHeading kicker="the hall of fame" title="Favourite books" />
          <h2 id="favs" className="sr-only">Favourite books</h2>
          {favourites.length === 0 ? (
            <p className="text-sm text-ink-soft">{own ? "Heart a book on its page to pin it here." : "No favourites pinned yet."}</p>
          ) : (
            <BookshelfRow label="Favourite books" layout="fit" size="lg" fitCount={6} priorityCount={4} items={favourites.map((b) => ({ key: b.id, book: b }))} />
          )}
        </section>

        <section aria-labelledby="activity">
          <SectionHeading kicker="lately" title="Recent activity" />
          <h2 id="activity" className="sr-only">Recent activity</h2>
          <FeedList
            initial={posts}
            load={load}
            empty={
              <EmptyState
                title={own ? "Your story starts here" : "Quiet for now"}
                body={own ? "Shelve a book, post an update or save a quote — it'll show up here." : `${profile.displayName} hasn't posted anything yet.`}
                action={own ? <ButtonLink href="/discover">Find a book</ButtonLink> : undefined}
              />
            }
          />
        </section>
      </div>

      <aside className="space-y-10">
        {reading.length > 0 && (
          <section>
            <SectionHeading title="On the nightstand" />
            <BookshelfRow label="On the nightstand" size="sm" items={reading.slice(0, 6).map((ub) => ({ key: ub.id, book: ub.book }))} />
          </section>
        )}
        {profile.favouriteGenres.length > 0 && (
          <section>
            <SectionHeading title="Loves" />
            <div className="flex flex-wrap gap-2">{profile.favouriteGenres.map((g, i) => <Chip key={g} href={`/discover?genre=${encodeURIComponent(g)}`} tone={(["sage", "rose", "butter"] as const)[i % 3]}>{g}</Chip>)}</div>
          </section>
        )}
        {profile.favouriteAuthors.length > 0 && (
          <section>
            <SectionHeading title="Favourite authors" />
            <ul className="space-y-1">
              {profile.favouriteAuthors.map((a) => (
                <li key={a}><Link href={`/search?q=${encodeURIComponent(a)}`} className="font-serif text-lg italic hover:text-burgundy">{a}</Link></li>
              ))}
            </ul>
          </section>
        )}
        {profile.readingGoal && (
          <GoalCard profileId={profile.id} goal={profile.readingGoal} />
        )}
      </aside>
    </div>
  );
}

async function GoalCard({ profileId, goal }: { profileId: string; goal: number }) {
  const store = await getStore();
  const year = new Date().getFullYear();
  const stats = await store.getProfileStats(profileId, year);
  const pct = Math.min(100, Math.round((stats.booksReadThisYear / goal) * 100));
  return (
    <section className="border border-line-strong bg-butter/40 p-5">
      <p className="meta">{year} reading goal</p>
      <p className="mt-1 font-serif text-4xl leading-none">{stats.booksReadThisYear}<span className="text-xl text-ink-soft"> / {goal}</span></p>
      <div className="mt-3 h-2 rounded-full bg-paper"><div className="h-full rounded-full bg-burgundy" style={{ width: `${pct}%` }} /></div>
      <p className="hand mt-2 text-xl text-ink-soft">{pct >= 100 ? "goal smashed ✦" : `${pct}% of the way`}</p>
    </section>
  );
}
