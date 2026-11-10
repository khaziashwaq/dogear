import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { chipClass } from "@/components/ui/chip";
import type { ListSort } from "@/lib/types";
import { ListCard } from "@/components/list/list-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { getStore, getViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Lists" };

const SORTS: { key: ListSort; label: string }[] = [
  { key: "popular", label: "Most followed" },
  { key: "recent", label: "Recently updated" },
  { key: "books", label: "Most books" },
];

export default async function ListsPage({ searchParams }: PageProps<"/lists">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const sort = SORTS.find((s) => s.key === sp.sort)?.key ?? "popular";
  const searching = Boolean(q) || sort !== "popular";
  const [store, viewer] = await Promise.all([getStore(), getViewer()]);
  const [mine, followed, found] = await Promise.all([
    viewer && !searching ? store.listListsByUser(viewer.id) : Promise.resolve([]),
    viewer && !searching ? store.followedLists() : Promise.resolve([]),
    store.searchLists(q, sort, 30),
  ]);
  const seen = new Set([...mine, ...followed].map((l) => l.id));
  const community = found.filter((l) => !seen.has(l.id));

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl leading-none sm:text-6xl">Lists<span className="text-burgundy">.</span></h1>
          <p className="hand mt-1 text-2xl text-ink-soft">books that belong together, for reasons only a reader would understand</p>
        </div>
        {viewer && <ButtonLink href="/lists/new">Start a list</ButtonLink>}
      </header>

      <form role="search" className="mb-10 flex flex-wrap items-center gap-3" action="/lists">
        <label className="relative min-w-60 flex-1">
          <span className="sr-only">Search lists</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <input name="q" defaultValue={q} className="field pl-9" placeholder="Rainy Sunday reads, books that changed my life…" />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Sort by">
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={`/lists?${new URLSearchParams({ ...(q ? { q } : {}), ...(s.key === "popular" ? {} : { sort: s.key }) })}`}
              aria-current={sort === s.key ? "true" : undefined}
              className={chipClass("paper", sort === s.key, "shrink-0")}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </form>

      {viewer && !searching && (
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

      {community.length > 0 ? (
        <section>
          <SectionHeading title={q ? `Lists matching “${q}”` : searching ? SORTS.find((s) => s.key === sort)!.label : "Popular with readers"} />
          <div className="masonry columns-1 sm:columns-2 lg:columns-3">{community.map((l) => <ListCard key={l.id} list={l} />)}</div>
        </section>
      ) : (
        searching && <EmptyState title={q ? `No lists for “${q}”` : "No lists yet"} body="Try another word, or start one yourself." action={viewer ? <ButtonLink href="/lists/new">Start a list</ButtonLink> : undefined} />
      )}
    </div>
  );
}
