import Link from "next/link";
import { BookCover } from "@/components/book/book-cover";
import { BookshelfRow } from "@/components/book/bookshelf";
import { Logo } from "@/components/brand/logo";
import { DemoBanner } from "@/components/layout/demo-banner";
import { ListCover } from "@/components/list/list-cover";
import { Avatar } from "@/components/profile/avatar";
import { QuoteCard } from "@/components/quote/quote-card";
import { ButtonLink } from "@/components/ui/button";
import { Arrow, Leaf, Sparkle, Squiggle, Underline } from "@/components/ui/doodles";
import { Stars } from "@/components/ui/stars";
import { getStore, getViewer } from "@/lib/auth";
import { MOODS } from "@/lib/data/seed/books";
import { excerpt } from "@/lib/utils";

export default async function Landing() {
  const [store, viewer] = await Promise.all([getStore(), getViewer()]);
  const [trending, lists, reviewed] = await Promise.all([store.trendingBooks(9), store.popularLists(3), store.recentlyReviewedBooks(1)]);
  const [reviews, quotes] = await Promise.all([
    reviewed[0] ? store.listReviewsForBook(reviewed[0].id, 1) : Promise.resolve([]),
    trending[0] ? store.listQuotesForBook(trending.find((b) => b.slug === "piranesi")?.id ?? trending[0].id, 1) : Promise.resolve([]),
  ]);
  const review = reviews[0];
  const quote = quotes[0];
  const hero = trending.slice(0, 9);
  const shelf = trending.slice(0, 9);
  const list = lists[0];

  return (
    <div className="overflow-x-clip">
      <DemoBanner />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-2 sm:gap-4" aria-label="Site">
          <Link href="/discover" className="hidden text-sm text-ink-soft hover:text-ink sm:inline">Discover</Link>
          {viewer ? (
            <ButtonLink href="/home" size="sm">Your shelves →</ButtonLink>
          ) : (
            <>
              <Link href="/login" className="text-sm text-ink-soft hover:text-ink">Sign in</Link>
              <ButtonLink href="/login" size="sm" variant="burgundy">Join</ButtonLink>
            </>
          )}
        </nav>
      </header>

      <main id="main">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-6 sm:px-8 md:grid-cols-[1.1fr_1fr] md:pt-14">
          <div className="relative z-10">
            <p className="meta text-burgundy">a social network for readers · est. 2026</p>
            <h1 className="mt-4 text-[2.9rem] leading-[0.95] sm:text-7xl">
              leave a little{" "}
              <span className="relative inline-block italic text-burgundy">
                piece
                <Underline className="text-rose" />
              </span>{" "}
              of yourself in every book.
            </h1>
            <p className="mt-6 max-w-md text-lg text-ink-soft">
              Shelves that look like you. Reviews with a voice. Lists named after Radiohead songs.
              dogear. is where readers find each other — and their next favourite book.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href={viewer ? "/home" : "/login"} size="lg" variant="burgundy">{viewer ? "Open your shelves" : "Start your shelf"}</ButtonLink>
              <ButtonLink href="/discover" size="lg" variant="paper">Wander around</ButtonLink>
            </div>
            <p className="hand mt-6 flex items-center gap-2 text-2xl text-ink-soft">
              <Sparkle className="text-burgundy" /> free, forever-ish, no algorithms judging you
            </p>
          </div>

          {/* scrapbook collage */}
          <div className="relative mx-auto h-[420px] w-full max-w-[460px] sm:h-[500px]" aria-label="Books readers love right now">
            <div className="absolute inset-6 rotate-2 border border-line bg-paper-deep shadow-[var(--shadow-paper)]" aria-hidden />
            {/* two little wall shelves pinned to the board */}
            <div className="absolute inset-x-[9%] top-[7%]">
              <BookshelfRow label="Trending this month" layout="fit" size="sm" fitCount={5} labels={false} priorityCount={5} items={hero.slice(0, 5).map((b) => ({ key: b.id, book: b }))} />
            </div>
            {hero.length > 5 && (
              <div className="absolute left-[30%] right-[5%] top-[53%]">
                <BookshelfRow label="More trending books" layout="fit" size="sm" fitCount={5} labels={false} align="center" items={hero.slice(5, 9).map((b) => ({ key: b.id, book: b }))} />
              </div>
            )}
            <div className="tape left-[30%] top-[2%] z-10 rotate-[-8deg]" aria-hidden />
            <div className="tape tape-rose right-[2%] top-[50%] z-10 rotate-12" aria-hidden />
            <p className="hand absolute -left-2 bottom-2 z-10 max-w-[10rem] -rotate-6 text-2xl leading-none text-burgundy sm:-left-10">
              what everyone&rsquo;s reading this month
            </p>
            <Arrow className="absolute bottom-12 left-28 z-10 rotate-[-20deg] text-burgundy sm:left-20" />
          </div>
        </section>

        {/* ── Mood marquee ─────────────────────────────────── */}
        <section aria-label="Browse by mood" className="mood-marquee overflow-hidden border-y border-ink bg-ink py-3 text-paper">
          <div className="mood-track flex w-max whitespace-nowrap">
            {[...MOODS, ...MOODS].map((m, i) => (
              <Link
                key={i}
                href={`/discover?mood=${m.key}`}
                className="group flex items-center font-serif text-xl italic hover:text-butter focus-visible:text-butter"
                tabIndex={i >= MOODS.length ? -1 : undefined}
                aria-hidden={i >= MOODS.length || undefined}
              >
                <span className="pl-6">{m.label}</span>
                {/* a pen-drawn sparkle: outline only, slightly uneven, like a doodle in the margin */}
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-rose)"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ml-6 size-5 shrink-0 transition-transform duration-300 group-hover:rotate-45 group-hover:scale-110"
                  style={{ rotate: `${(i % 3) * 9 - 9}deg` }}
                >
                  <path d="M12.2 2.6c.4 3.9 1.3 6.6 2.4 7.7 1.2 1.1 3.6 1.7 6.6 1.8-3.2.3-5.6 1-6.7 2.2-1.1 1.2-1.8 3.9-2.1 7.3-.5-3.5-1.3-6-2.5-7.2-1.2-1.2-3.4-1.9-6.3-2.3 3-.1 5.2-.8 6.4-1.9 1.2-1.2 1.9-3.9 2.2-7.6z" />
                  <path d="M19.4 3.4c.1.9.4 1.5.8 1.8.4.3.9.4 1.6.5-.7.1-1.2.3-1.5.6-.3.4-.5.9-.6 1.7" strokeWidth="1.1" />
                </svg>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Features, asymmetric ─────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <div className="grid gap-8 md:grid-cols-12">
            <div className="md:col-span-7">
              <p className="meta text-burgundy">01 — shelves</p>
              <h2 className="mt-2 text-4xl sm:text-5xl">A bookshelf you&rsquo;d want to screenshot.</h2>
              <p className="mt-3 max-w-lg text-ink-soft">Want to read, reading, read, did-not-finish, favourites — plus shelves only you would invent. Switch between covers and a tidy list.</p>
              <BookshelfRow decorative layout="fit" size="md" fitCount={9} className="mt-8" items={shelf.map((b) => ({ key: b.id, book: b }))} />
            </div>

            {review && (
              <figure className="paper dogear relative self-end p-6 md:col-span-5 md:rotate-1">
                <div className="tape -top-3 left-8 -rotate-3" aria-hidden />
                <p className="meta text-burgundy">02 — reviews</p>
                <div className="mt-4 flex gap-4">
                  <BookCover title={review.book.title} authors={review.book.authors} coverUrl={review.book.coverUrl} size="md" />
                  <div className="min-w-0">
                    <p className="font-serif text-xl leading-tight">{review.book.title}</p>
                    <Stars value={review.rating} className="mt-1" />
                    {review.title && <p className="mt-2 font-serif text-lg italic leading-tight">{review.title}</p>}
                  </div>
                </div>
                <blockquote className="mt-4 text-sm leading-relaxed text-ink/90">{excerpt(review.body, 230)}</blockquote>
                <figcaption className="mt-4 flex items-center gap-2 text-sm">
                  <Avatar profile={review.author} size="xs" /> {review.author.displayName}
                </figcaption>
              </figure>
            )}

            {list && (
              <Link href={`/lists/${list.id}`} className="group paper block overflow-hidden md:col-span-5 md:-rotate-1">
                <ListCover style={list.coverStyle} books={list.preview} />
                <div className="p-5">
                  <p className="meta text-burgundy">03 — lists</p>
                  <p className="mt-1 text-2xl leading-tight group-hover:text-burgundy">{list.title}</p>
                  <p className="mt-1 text-sm text-ink-soft">by @{list.owner.username} · {list.bookCount} books</p>
                </div>
              </Link>
            )}

            <div className="relative md:col-span-7 md:pl-10">
              <p className="meta text-burgundy">04 — quotes</p>
              <h2 className="mt-2 text-4xl">The lines you underlined, made shareable.</h2>
              {quote && <QuoteCard quote={quote} className="mt-6 max-w-lg -rotate-1" />}
              <Leaf className="absolute -right-2 bottom-0 hidden text-sage-deep md:block" />
            </div>
          </div>
        </section>

        {/* ── Signature ideas ──────────────────────────────── */}
        <section className="bg-paper-deep/70 py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <h2 className="max-w-2xl text-4xl sm:text-5xl">Reading is better when it&rsquo;s a little bit social.</h2>
            <Squiggle className="mt-3 text-burgundy" />
            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              {[
                { t: "Reading compatibility", b: "See how your ratings line up with a friend's. 87% compatible means you're borrowing each other's books.", tone: "bg-rose/40" },
                { t: "Pass the book", b: "Recommend a book straight to a friend with a little note in the margin. Watch it travel.", tone: "bg-butter/70" },
                { t: "Your reading year", b: "Pages, moods, favourite authors and your top genres, drawn like a zine you'd actually post.", tone: "bg-sage/50" },
              ].map((f, i) => (
                <div key={f.t} className={`border border-line-strong p-6 ${f.tone}`} style={{ rotate: `${[-0.8, 0.6, -0.4][i]}deg` }}>
                  <p className="font-serif text-2xl leading-tight">{f.t}</p>
                  <p className="mt-2 text-sm text-ink-soft">{f.b}</p>
                </div>
              ))}
            </div>
            <div className="mt-12 flex flex-wrap items-center gap-4">
              <ButtonLink href={viewer ? "/home" : "/login"} size="lg">{viewer ? "Back to your shelves" : "Make your shelf"}</ButtonLink>
              <p className="hand text-2xl text-burgundy">your people are already here →</p>
            </div>
          </div>
        </section>

        {trending.length > 0 && (
          <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8" aria-labelledby="trending-heading">
            <h2 id="trending-heading" className="text-3xl">Trending on dogear.</h2>
            <BookshelfRow label="Trending on dogear." layout="scroll" size="md" className="mt-6" items={trending.map((b) => ({ key: b.id, book: b }))} />
          </section>
        )}
      </main>

      <footer className="border-t border-line px-5 py-10 text-center">
        <Logo size="sm" />
        <p className="hand mt-2 text-xl text-ink-soft">made by readers, for readers</p>
        <p className="meta mt-4">Book data &amp; covers from Open Library</p>
      </footer>
    </div>
  );
}
