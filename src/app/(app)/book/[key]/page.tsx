import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookshelfRow } from "@/components/book/bookshelf";
import { ReadingJournal } from "@/components/book/reading-journal";
import { ShelfActions } from "@/components/book/shelf-actions";
import { PostCard } from "@/components/feed/post-card";
import { ListCard } from "@/components/list/list-card";
import { Avatar } from "@/components/profile/avatar";
import { MarginaliaFeed } from "@/components/quote/marginalia-feed";
import { ReviewCard } from "@/components/review/review-card";
import { Highlighter } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SectionHeading } from "@/components/ui/section-heading";
import { Stars } from "@/components/ui/stars";
import { getStore, getViewer } from "@/lib/auth";
import { lookupBook } from "@/lib/book-lookup";
import { emptyStats } from "@/lib/data/store";
import { authorLine, cn, plural } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/book/[key]">): Promise<Metadata> {
  const book = await lookupBook((await params).key);
  if (!book) return { title: "Book not found" };
  return { title: `${book.title} by ${authorLine(book.authors)}`, description: book.description?.slice(0, 160) };
}

const STATUS_LABEL = { read: "read it", reading: "reading", want_to_read: "wants to", dnf: "DNF" } as const;

const SORTS = [
  { key: "recent", label: "Newest" },
  { key: "liked", label: "Most liked" },
  { key: "rating", label: "Highest rated" },
] as const;

export default async function BookPage({ params, searchParams }: PageProps<"/book/[key]">) {
  const { key } = await params;
  const sp = await searchParams;
  const sort = SORTS.find((s) => s.key === sp.sort)?.key ?? "recent";
  const msort = sp.marks === "recent" ? "recent" : "popular";
  const book = await lookupBook(key);
  if (!book) notFound();
  if (book.slug && key !== book.slug) redirect(`/book/${book.slug}`);

  const [store, viewer] = await Promise.all([getStore(), getViewer()]);
  const id = book.id;
  const [stats, userBook, allReviews, marginalia, lists, readers, posts, following, myReviews, myQuotes, sessions] = await Promise.all([
    id ? store.getBookStats(id) : emptyStats(),
    id ? store.getUserBook(id) : null,
    id ? store.listReviewsForBook(id, 60) : [],
    id ? store.listMarginalia({ tab: msort, bookId: id }, null, 12) : { items: [], nextCursor: null },
    id ? store.listListsForBook(id, 6) : [],
    id ? store.getBookReaders(id, 30) : [],
    id ? store.getBookPosts(id, 4) : [],
    viewer ? store.listFollowing(viewer.id) : [],
    viewer && id ? store.listReviewsByUser(viewer.id, 200).then((rs) => rs.filter((r) => r.bookId === id)) : [],
    viewer && id ? store.listQuotesByUser(viewer.id, 200).then((qs) => qs.filter((q) => q.bookId === id)) : [],
    viewer && id ? store.listSessions(id) : [],
  ]);
  const reviews = [...allReviews]
    .sort((a, b) =>
      sort === "liked"
        ? b.likesCount - a.likesCount || b.createdAt.localeCompare(a.createdAt)
        : sort === "rating"
          ? (b.rating ?? 0) - (a.rating ?? 0) || b.likesCount - a.likesCount
          : b.createdAt.localeCompare(a.createdAt),
    )
    .slice(0, 12);
  const readingNow = readers.filter((r) => r.status === "reading");
  const shelvedIt = readers.filter((r) => r.status !== "reading");
  const maxBucket = Math.max(1, ...stats.histogram);
  const followingIds = new Set(following.map((f) => f.id));
  const friendsWhoRead = readers.filter((r) => followingIds.has(r.profile.id));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-10 md:grid-cols-[280px_minmax(0,1fr)] lg:gap-14">
        {/* left column */}
        <div className="md:sticky md:top-8 md:self-start">
          <div className="mb-6 text-center md:hidden" aria-hidden>
            <p className="font-serif text-4xl leading-none">{book.title}</p>
            <p className="mt-1 font-serif text-xl italic text-ink-soft">{authorLine(book.authors)}</p>
          </div>
          <div className="relative mx-auto w-48 sm:w-60 md:w-full">
            <BookshelfRow
              decorative
              face="cover"
              layout="fit"
              size="xl"
              align="center"
              priorityCount={1}
              items={[{ key: book.id ?? book.olWorkId ?? book.title, book, badge: <div className="tape -top-3 left-1/2 z-10 -translate-x-1/2 -rotate-2" aria-hidden /> }]}
            />
          </div>
          <div className="mt-8">
            <ShelfActions book={book} userBook={userBook} signedIn={Boolean(viewer)} following={following} />
          </div>
          {viewer && (
            <ButtonLink href={`/quotes/new?book=${encodeURIComponent(book.slug ?? book.olWorkId ?? "")}`} variant="paper" className="mt-3 w-full">
              <Highlighter className="size-4" /> Add a highlight
            </ButtonLink>
          )}
        </div>

        {/* right column */}
        <div className="min-w-0">
          <p className="meta text-burgundy">{book.publishedYear ?? "undated"}{book.publisher ? ` · ${book.publisher}` : ""}</p>
          <h1 className="mt-2 text-5xl leading-[0.95] sm:text-6xl">{book.title}</h1>
          {book.subtitle && <p className="mt-2 font-serif text-2xl italic text-ink-soft">{book.subtitle}</p>}
          <p className="mt-3 text-lg">by <span className="font-serif text-2xl italic">{authorLine(book.authors)}</span></p>

          <div className="mt-5 flex flex-wrap gap-2">
            {book.genres.map((g) => <Chip key={g} href={`/discover?genre=${encodeURIComponent(g)}`} tone="sage">{g}</Chip>)}
            {book.moods.map((m) => <Chip key={m} href={`/discover?mood=${m}`} tone="rose">{m.replace("-", " ")}</Chip>)}
          </div>

          {/* in-page sections, like tabs on a long page */}
          <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-x-5 gap-y-1 border-b border-line pb-2 text-sm">
            <a href="#reviews-h" className="text-ink-soft hover:text-burgundy">Reviews <span className="font-mono text-xs">{allReviews.length}</span></a>
            <a href="#marginalia" className="text-ink-soft hover:text-burgundy">Marginalia <span className="font-mono text-xs">{marginalia.items.length}{marginalia.nextCursor ? "+" : ""}</span></a>
            {readers.length > 0 && <a href="#readers" className="text-ink-soft hover:text-burgundy">Readers <span className="font-mono text-xs">{readers.length}</span></a>}
          </nav>

          {/* stats strip */}
          <dl className="mt-8 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
            <div className="bg-card p-4">
              <dt className="meta">community rating</dt>
              <dd className="mt-1 flex items-baseline gap-2"><span className="font-serif text-4xl">{stats.avgRating?.toFixed(1) ?? "—"}</span><Stars value={stats.avgRating ? Math.round(stats.avgRating * 2) / 2 : null} size="xs" /></dd>
              <dd className="meta mt-1 normal-case tracking-normal">{plural(stats.ratingsCount, "rating")}</dd>
            </div>
            <div className="bg-card p-4"><dt className="meta">readers</dt><dd className="mt-1 font-serif text-4xl">{stats.readersCount}</dd><dd className="meta mt-1 normal-case tracking-normal">{stats.wantCount} want to read</dd></div>
            <div className="bg-card p-4"><dt className="meta">reading now</dt><dd className="mt-1 font-serif text-4xl">{stats.readingCount}</dd><dd className="meta mt-1 normal-case tracking-normal">{book.pageCount ? `${book.pageCount} pages` : "pages unknown"}</dd></div>
            <div className="bg-card p-4" aria-label="Rating distribution">
              <dt className="meta">spread</dt>
              <dd className="mt-2 flex h-12 items-end gap-0.5" aria-hidden>
                {stats.histogram.map((n, i) => <span key={i} className="flex-1 bg-burgundy/70" style={{ height: `${Math.max(4, (n / maxBucket) * 100)}%`, opacity: n ? 1 : 0.25 }} />)}
              </dd>
              <dd className="meta mt-1 flex justify-between"><span>½</span><span>★★★★★</span></dd>
            </div>
          </dl>

          {friendsWhoRead.length > 0 && (
            <p className="hand mt-4 text-2xl text-burgundy">
              {friendsWhoRead.slice(0, 3).map((r) => r.profile.displayName.split(" ")[0]).join(", ")}
              {friendsWhoRead.length > 3 ? ` & ${friendsWhoRead.length - 3} more` : ""} from your circle shelved this
            </p>
          )}

          {book.description && (
            <section className="mt-8 max-w-2xl" aria-label="Description">
              <p className="drop-cap whitespace-pre-line text-[1.05rem] leading-relaxed text-ink/90">{book.description}</p>
            </section>
          )}

          <dl className="meta mt-6 flex flex-wrap gap-x-6 gap-y-1">
            {book.isbn13 && <div><dt className="inline">ISBN </dt><dd className="inline text-ink">{book.isbn13}</dd></div>}
            {book.language && <div><dt className="inline">Language </dt><dd className="inline text-ink">{book.language}</dd></div>}
            {book.olWorkId && <div><a className="link-underline text-ink" href={`https://openlibrary.org/works/${book.olWorkId}`} target="_blank" rel="noreferrer">Open Library ↗</a></div>}
          </dl>

          {viewer && id && book.slug && (
            <ReadingJournal book={{ ...book, id, slug: book.slug }} userBook={userBook} reviews={myReviews} quotes={myQuotes} sessions={sessions} />
          )}

          {/* reviews */}
          <section className="mt-14" aria-labelledby="reviews-h">
            <SectionHeading kicker="the margins" title="Reviews" />
            <h2 id="reviews-h" className="sr-only">Reviews</h2>
            {allReviews.length > 1 && (
              <nav aria-label="Sort reviews" className="-mt-1 mb-5 flex flex-wrap gap-1">
                {SORTS.map((s) => (
                  <Link
                    key={s.key}
                    href={s.key === "recent" ? `/book/${book.slug ?? key}#reviews-h` : `/book/${book.slug ?? key}?sort=${s.key}#reviews-h`}
                    scroll={false}
                    aria-current={sort === s.key ? "true" : undefined}
                    className={cn("px-3 py-1 text-sm transition-colors", sort === s.key ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-deep hover:text-ink")}
                  >
                    {s.label}
                  </Link>
                ))}
              </nav>
            )}
            {reviews.length === 0 ? (
              <div className="border border-dashed border-line-strong p-6 text-center">
                <p className="font-serif text-xl">No one has reviewed this yet.</p>
                <p className="hand text-xl text-ink-soft">first word is yours</p>
                <ButtonLink href={`/review/new?book=${encodeURIComponent(book.slug ?? book.olWorkId ?? "")}`} className="mt-4">Write the first review</ButtonLink>
              </div>
            ) : (
              <div className="space-y-5">{reviews.map((r) => <ReviewCard key={r.id} review={r} />)}</div>
            )}
          </section>

          {/* marginalia */}
          <section className="mt-14 scroll-mt-24" id="marginalia" aria-labelledby="marginalia-h">
            <SectionHeading kicker="dog-eared" title="Marginalia" />
            <h2 id="marginalia-h" className="sr-only">Marginalia</h2>
            <div className="-mt-1 mb-5 flex flex-wrap items-center justify-between gap-3">
              <nav aria-label="Sort marginalia" className="flex gap-1">
                {(["popular", "recent"] as const).map((m) => (
                  <Link
                    key={m}
                    href={`/book/${book.slug ?? key}?${new URLSearchParams({ ...(sort !== "recent" ? { sort } : {}), ...(m === "recent" ? { marks: "recent" } : {}) })}#marginalia`}
                    scroll={false}
                    aria-current={msort === m ? "true" : undefined}
                    className={cn("px-3 py-1 text-sm capitalize transition-colors", msort === m ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-deep hover:text-ink")}
                  >
                    {m}
                  </Link>
                ))}
              </nav>
              {viewer && <ButtonLink href={`/quotes/new?book=${encodeURIComponent(book.slug ?? book.olWorkId ?? "")}`} size="sm">Add a highlight</ButtonLink>}
            </div>
            {marginalia.items.length === 0 ? (
              <div className="border border-dashed border-line-strong p-6 text-center">
                <p className="font-serif text-xl">No one has marked a passage in this book yet.</p>
                <p className="hand text-xl text-ink-soft">the margins are wide open</p>
                {!viewer && <ButtonLink href={`/login?next=${encodeURIComponent(`/book/${book.slug ?? key}`)}`} variant="paper" className="mt-4">Sign in to add one</ButtonLink>}
              </div>
            ) : (
              <MarginaliaFeed key={msort} initial={marginalia} query={{ tab: msort, bookId: id }} showBook={false} />
            )}
          </section>

          {posts.length > 0 && (
            <section className="mt-14">
              <SectionHeading kicker="live" title="Readers right now" />
              <div className="space-y-5">{posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
            </section>
          )}

          {lists.length > 0 && (
            <section className="mt-14">
              <SectionHeading kicker="in good company" title="Lists featuring this book" />
              <div className="grid gap-5 sm:grid-cols-2">{lists.map((l) => <ListCard key={l.id} list={l} />)}</div>
            </section>
          )}

          {readingNow.length > 0 && (
            <section className="mt-14">
              <SectionHeading kicker="the reading room" title="Reading it now" />
              <ul className="flex flex-wrap gap-3">
                {readingNow.map((r) => (
                  <li key={r.profile.id}>
                    <Link href={`/u/${r.profile.username}`} className="flex items-center gap-2 rounded-full border border-sage-deep/40 bg-sage/25 py-1 pl-1 pr-3 text-sm hover:border-ink">
                      <Avatar profile={r.profile} size="xs" />
                      <span>{r.profile.displayName.split(" ")[0]}</span>
                      {followingIds.has(r.profile.id) && <span className="meta">following</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {shelvedIt.length > 0 && (
            <section className="mt-14 scroll-mt-24" id="readers">
              <SectionHeading kicker="in the stacks" title="People who've shelved it" />
              <ul className="flex flex-wrap gap-3">
                {shelvedIt.map((r) => (
                  <li key={r.profile.id}>
                    <Link href={`/u/${r.profile.username}`} className={cn("flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-3 text-sm hover:border-ink")}>
                      <Avatar profile={r.profile} size="xs" />
                      <span>{r.profile.displayName.split(" ")[0]}</span>
                      <span className="meta">{r.status ? STATUS_LABEL[r.status] : ""}{r.rating ? ` · ${r.rating}★` : ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
