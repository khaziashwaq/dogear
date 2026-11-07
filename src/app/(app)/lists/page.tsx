import type { Metadata } from "next";
import { ListCard } from "@/components/list/list-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { getStore, getViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Lists" };

export default async function ListsPage() {
  const [store, viewer] = await Promise.all([getStore(), getViewer()]);
  const [mine, followed, popular] = await Promise.all([
    viewer ? store.listListsByUser(viewer.id) : Promise.resolve([]),
    viewer ? store.followedLists() : Promise.resolve([]),
    store.popularLists(18),
  ]);
  const seen = new Set([...mine, ...followed].map((l) => l.id));
  const community = popular.filter((l) => !seen.has(l.id));

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl leading-none sm:text-6xl">Lists<span className="text-burgundy">.</span></h1>
          <p className="hand mt-1 text-2xl text-ink-soft">books that belong together, for reasons only a reader would understand</p>
        </div>
        {viewer && <ButtonLink href="/lists/new">Start a list</ButtonLink>}
      </header>

      {viewer && (
        <section className="mb-14" aria-labelledby="mine">
          <SectionHeading title="Your lists" href={`/u/${viewer.username}/lists`} action="On your profile" />
          <h2 id="mine" className="sr-only">Your lists</h2>
          {mine.length === 0 ? (
            <EmptyState
              title="You haven't made a list yet"
              body="Books that destroyed you. Books that feel like a particular song. Books everyone should read."
              action={<ButtonLink href="/lists/new">Make your first list</ButtonLink>}
            />
          ) : (
            <div className="masonry columns-1 sm:columns-2 lg:columns-3">{mine.map((l) => <ListCard key={l.id} list={l} showOwner={false} />)}</div>
          )}
        </section>
      )}

      {followed.length > 0 && (
        <section className="mb-14">
          <SectionHeading title="Lists you follow" />
          <div className="masonry columns-1 sm:columns-2 lg:columns-3">{followed.map((l) => <ListCard key={l.id} list={l} />)}</div>
        </section>
      )}

      {community.length > 0 && (
        <section>
          <SectionHeading title="Popular with readers" />
          <div className="masonry columns-1 sm:columns-2 lg:columns-3">{community.map((l) => <ListCard key={l.id} list={l} />)}</div>
        </section>
      )}
    </div>
  );
}
