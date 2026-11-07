import { LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCover } from "@/components/book/book-cover";
import { BookshelfSection, SpineMark } from "@/components/book/bookshelf";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Stars } from "@/components/ui/stars";
import { getStore, getViewer } from "@/lib/auth";
import { bookHref } from "@/lib/book-ref";
import { lookupProfile } from "@/lib/profile-lookup";
import type { ShelfQuery, ShelfSort, ShelfStatus } from "@/lib/types";
import { authorLine, cn, formatDate } from "@/lib/utils";

const STATUSES: { key: ShelfStatus; label: string }[] = [
  { key: "reading", label: "Currently reading" },
  { key: "want_to_read", label: "Want to read" },
  { key: "read", label: "Read" },
  { key: "dnf", label: "Did not finish" },
];
const SORTS: { key: ShelfSort; label: string }[] = [
  { key: "recent", label: "Recently shelved" },
  { key: "title", label: "Title" },
  { key: "author", label: "Author" },
  { key: "rating", label: "Rating" },
  { key: "year", label: "Year published" },
];

export default async function ShelvesPage({ params, searchParams }: PageProps<"/u/[username]/shelves">) {
  const profile = await lookupProfile((await params).username);
  if (!profile) notFound();
  const sp = await searchParams;
  const status = STATUSES.find((s) => s.key === sp.status)?.key;
  const favourites = sp.fav === "1";
  const shelf = typeof sp.shelf === "string" ? sp.shelf : undefined;
  const sort = SORTS.find((s) => s.key === sp.sort)?.key ?? "recent";
  const view = sp.view === "list" ? "list" : "grid";
  const [store, viewer] = await Promise.all([getStore(), getViewer()]);
  const query: ShelfQuery = { status, favourites, shelf, sort };
  const [books, summary] = await Promise.all([store.getShelf(profile.id, query), store.getShelfSummary(profile.id)]);
  const own = viewer?.id === profile.id;

  const base = `/u/${profile.username}/shelves`;
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { status, fav: favourites ? "1" : undefined, shelf, sort: sort === "recent" ? undefined : sort, view: view === "grid" ? undefined : view, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  const title = status ? STATUSES.find((s) => s.key === status)!.label : favourites ? "Favourites" : shelf ? shelf : "All shelves";
  const filtered = Boolean(status || favourites || shelf);
  const groups = [...STATUSES, { key: "none" as const, label: "Shelved without a status" }]
    .map((st) => ({ key: st.key, label: st.label as string | null, books: books.filter((ub) => (ub.status ?? "none") === st.key) }))
    .filter((g) => g.books.length > 0);
  const total = summary.counts.read + summary.counts.reading + summary.counts.want_to_read + summary.counts.dnf;

  const pill = (active: boolean) => cn("flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors", active ? "bg-ink text-paper" : "hover:bg-paper-deep");

  return (
    <div className="grid gap-8 md:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Shelves" className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:overflow-visible md:px-0">
        <Link href={href({ status: undefined, fav: undefined, shelf: undefined })} className={cn(pill(!status && !favourites && !shelf), "shrink-0")}>All <span className="meta text-current opacity-70">{total}</span></Link>
        {STATUSES.map((s) => (
          <Link key={s.key} href={href({ status: s.key, fav: undefined, shelf: undefined })} className={cn(pill(status === s.key), "shrink-0")}>
            {s.label} <span className="meta text-current opacity-70">{summary.counts[s.key]}</span>
          </Link>
        ))}
        <Link href={href({ status: undefined, fav: "1", shelf: undefined })} className={cn(pill(favourites), "shrink-0")}>Favourites ♥ <span className="meta text-current opacity-70">{summary.counts.favourites}</span></Link>
        {summary.custom.length > 0 && <p className="meta hidden px-3 pt-4 md:block">your shelves</p>}
        {summary.custom.map((c) => (
          <Link key={c.name} href={href({ status: undefined, fav: undefined, shelf: c.name })} className={cn(pill(shelf === c.name), "shrink-0 italic")}>
            {c.name} <span className="meta not-italic text-current opacity-70">{c.count}</span>
          </Link>
        ))}
      </nav>

      <div className="min-w-0">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-3xl capitalize">{title} <span className="font-sans text-base text-ink-faint">({books.length})</span></h2>
          <div className="flex items-center gap-2">
            <details className="relative">
              <summary className="meta cursor-pointer list-none border border-line-strong bg-card px-3 py-2 hover:border-ink">sort: {SORTS.find((s) => s.key === sort)!.label}</summary>
              <div className="absolute right-0 z-10 mt-1 w-48 border border-line-strong bg-card py-1 shadow-[var(--shadow-lift)]">
                {SORTS.map((s) => <Link key={s.key} href={href({ sort: s.key === "recent" ? undefined : s.key })} className={cn("block px-3 py-1.5 text-sm hover:bg-paper-deep", s.key === sort && "text-burgundy")}>{s.label}</Link>)}
              </div>
            </details>
            <div className="flex border border-line-strong bg-card" role="group" aria-label="View">
              <Link href={href({ view: undefined })} aria-label="Bookshelf" aria-current={view === "grid" ? "true" : undefined} className={cn("p-2", view === "grid" ? "bg-ink text-paper" : "text-ink-soft hover:text-ink")}><LayoutGrid className="size-4" /></Link>
              <Link href={href({ view: "list" })} aria-label="List" aria-current={view === "list" ? "true" : undefined} className={cn("p-2", view === "list" ? "bg-ink text-paper" : "text-ink-soft hover:text-ink")}><List className="size-4" /></Link>
            </div>
          </div>
        </div>

        {books.length === 0 ? (
          <EmptyState
            title="This shelf is empty"
            body={own ? "Find a book and tap Want to read, Reading or Read to start filling it." : `${profile.displayName} hasn't shelved anything here yet.`}
            note={own ? "dust-free, at least" : undefined}
            action={own ? <ButtonLink href="/discover">Browse books</ButtonLink> : undefined}
          />
        ) : view === "grid" ? (
          // On "All", each reading status gets its own shelf; a filtered view is one long run of shelves.
          <div className="space-y-12">
            {(filtered ? [{ key: "all", label: null as string | null, books }] : groups).map((g) => (
              <BookshelfSection
                key={g.key}
                id={`shelf-${g.key}`}
                title={g.label ?? title}
                count={g.books.length}
                headingHidden={!g.label}
                label={g.label ?? title}
                size="md"
                priorityCount={6}
                items={g.books.map((ub) => ({
                  key: ub.id,
                  book: ub.book,
                  mark: ub.isFavourite ? <SpineMark tone="burgundy"><span aria-hidden>♥</span></SpineMark> : undefined,
                  details: (
                    <div className="flex items-center gap-2">
                      <Stars value={ub.rating} size="xs" />
                      {ub.isFavourite && <span className="meta text-burgundy">favourite</span>}
                      {ub.status === "reading" && ub.progressPages && ub.book.pageCount ? <span className="meta">{Math.round((ub.progressPages / ub.book.pageCount) * 100)}%</span> : null}
                    </div>
                  ),
                }))}
              />
            ))}
          </div>
        ) : (
          <ol className="divide-y divide-line border-y border-line">
            {books.map((ub, i) => (
              <li key={ub.id}>
                <Link href={bookHref(ub.book)} className="group flex items-center gap-4 py-3 hover:bg-card">
                  <span className="hidden w-6 text-right font-serif text-lg italic text-ink-faint sm:block">{i + 1}</span>
                  <BookCover title={ub.book.title} authors={ub.book.authors} coverUrl={ub.book.coverUrl} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-lg leading-tight group-hover:text-burgundy">{ub.book.title}</p>
                    <p className="meta truncate normal-case tracking-normal">{authorLine(ub.book.authors)}{ub.book.publishedYear ? ` · ${ub.book.publishedYear}` : ""}</p>
                    {ub.shelves.length > 0 && <p className="hand mt-0.5 truncate text-lg leading-none text-burgundy">{ub.shelves.join(", ")}</p>}
                  </div>
                  <div className="hidden text-right sm:block">
                    <Stars value={ub.rating} size="xs" />
                    <p className="meta">{ub.finishedAt ? `finished ${formatDate(ub.finishedAt)}` : ub.startedAt ? `started ${formatDate(ub.startedAt)}` : formatDate(ub.updatedAt)}</p>
                  </div>
                  <span className="meta w-20 shrink-0 text-right">{ub.status?.replace(/_/g, " ") ?? ""}{ub.isFavourite ? " ♥" : ""}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
