import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookCover } from "@/components/book/book-cover";
import { ShelfActions } from "@/components/book/shelf-actions";
import { PostCard } from "@/components/feed/post-card";
import { ListCard } from "@/components/list/list-card";
import { Avatar } from "@/components/profile/avatar";
import { QuoteCard } from "@/components/quote/quote-card";
import { ReviewCard } from "@/components/review/review-card";
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

export default async function BookPage({ params }: PageProps<"/book/[key]">) {
  const { key } = await params;
  const book = await lookupBook(key);
  if (!book) notFound();
  if (book.slug && key !== book.slug) redirect(`/book/${book.slug}`);

  const [store, viewer] = await Promise.all([getStore(), getViewer()]);
  const id = book.id;
  const [stats, userBook, reviews, quotes, lists, readers, posts, following] = await Promise.all([
    id ? store.getBookStats(id) : emptyStats(),
    id ? store.getUserBook(id) : null,
    id ? store.listReviewsForBook(id, 12) : [],
    id ? store.listQuotesForBook(id, 6) : [],
    id ? store.listListsForBook(id, 6) : [],
    id ? store.getBookReaders(id, 30) : [],
    id ? store.getBookPosts(id, 4) : [],
    viewer ? store.listFollowing(viewer.id) : [],
  ]);
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
            <div className="tape -top-3 left-1/2 z-10 -translate-x-1/2 -rotate-2" aria-hidden />
            <BookCover title={book.title} authors={book.authors} coverUrl={book.coverUrl} size="fill" priority className="rotate-[-1.5deg]" />
          </div>
          <div className="mt-8">
            <ShelfActions book={book} userBook={userBook} signedIn={Boolean(viewer)} following={following} />
          </div>
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

          {/* reviews */}
          <section className="mt-14" aria-labelledby="reviews-h">
            <SectionHeading kicker="the margins" title="Reviews" />
            <h2 id="reviews-h" className="sr-only">Reviews</h2>
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

          {quotes.length > 0 && (
            <section className="mt-14">
              <SectionHeading kicker="underlined" title="Favourite passages" />
              <div className="masonry columns-1 sm:columns-2">
                {quotes.map((q) => <Link key={q.id} href={q.postId ? `/post/${q.postId}` : `/quotes/${q.id}`} className="block"><QuoteCard quote={q} linkBook={false} /></Link>)}
              </div>
            </section>
          )}

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

          {readers.length > 0 && (
            <section className="mt-14">
              <SectionHeading kicker="the reading room" title="People who've shelved it" />
              <ul className="flex flex-wrap gap-3">
                {readers.map((r) => (
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
