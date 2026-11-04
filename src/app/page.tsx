import Link from "next/link";
import { BookCover } from "@/components/book/book-cover";
import { Logo } from "@/components/brand/logo";
import { DemoBanner } from "@/components/layout/demo-banner";
import { ListCover } from "@/components/list/list-cover";
import { Avatar } from "@/components/profile/avatar";
import { QuoteCard } from "@/components/quote/quote-card";
import { ButtonLink } from "@/components/ui/button";
import { Arrow, Leaf, Sparkle, Squiggle, Underline } from "@/components/ui/doodles";
import { Stars } from "@/components/ui/stars";
import { getStore, getViewer } from "@/lib/auth";
import { bookHref } from "@/lib/book-ref";
import { MOODS } from "@/lib/data/seed/books";
import { authorLine, excerpt } from "@/lib/utils";

export default async function Landing() {
  const [store, viewer] = await Promise.all([getStore(), getViewer()]);
  const [trending, lists, reviewed] = await Promise.all([store.trendingBooks(9), store.popularLists(3), store.recentlyReviewedBooks(1)]);
  const [reviews, quotes] = await Promise.all([
    reviewed[0] ? store.listReviewsForBook(reviewed[0].id, 1) : Promise.resolve([]),
    trending[0] ? store.listQuotesForBook(trending.find((b) => b.slug === "piranesi")?.id ?? trending[0].id, 1) : Promise.resolve([]),
  ]);
  const review = reviews[0];
  const quote = quotes[0];
  const hero = trending.slice(0, 5);
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
            <ButtonLink href="/home" size="sm">Your feed →</ButtonLink>
          ) : (
            <>
              <Link href="/login" className="text-sm text-ink-soft hover:text-ink">Sign in</Link>
              <ButtonLink href="/signup" size="sm" variant="burgundy">Join</ButtonLink>
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
              <ButtonLink href={viewer ? "/home" : "/signup"} size="lg" variant="burgundy">{viewer ? "Open your feed" : "Start your shelf"}</ButtonLink>
              <ButtonLink href="/discover" size="lg" variant="paper">Wander around</ButtonLink>
            </div>
            <p className="hand mt-6 flex items-center gap-2 text-2xl text-ink-soft">
              <Sparkle className="text-burgundy" /> free, forever-ish, no algorithms judging you
            </p>
          </div>

          {/* scrapbook collage */}
          <div className="relative mx-auto h-[420px] w-full max-w-[460px] sm:h-[500px]" aria-label="Books readers love right now">
            <div className="absolute inset-6 rotate-2 border border-line bg-paper-deep shadow-[var(--shadow-paper)]" aria-hidden />
            {hero.map((b, i) => {
              const pos = [
                "left-[4%] top-[6%] -rotate-6",
                "left-[38%] top-[0%] rotate-3",
                "right-[2%] top-[22%] rotate-[8deg]",
                "left-[14%] top-[44%] rotate-2",
                "left-[48%] top-[50%] -rotate-3",
              ][i];
              return (
                <Link key={b.id} href={bookHref(b)} className={`absolute ${pos} transition-transform duration-300 hover:z-20 hover:-translate-y-2 hover:rotate-0`}>
                  <BookCover title={b.title} authors={b.authors} coverUrl={b.coverUrl} size="lg" priority={i < 2} />
                </Link>
              );
            })}
            <div className="tape left-[30%] top-[2%] z-10 rotate-[-8deg]" aria-hidden />
            <div className="tape tape-rose right-[6%] top-[20%] z-10 rotate-12" aria-hidden />
            <p className="hand absolute -left-2 bottom-2 z-10 max-w-[10rem] -rotate-6 text-2xl leading-none text-burgundy sm:-left-10">
              what everyone&rsquo;s reading this month
            </p>
            <Arrow className="absolute bottom-12 left-28 z-10 rotate-[-20deg] text-burgundy sm:left-20" />
          </div>
        </section>

        {/* ── Mood marquee ─────────────────────────────────── */}
        <section aria-label="Browse by mood" className="border-y border-ink bg-ink py-3 text-paper">
          <div className="scrollbar-none flex gap-8 overflow-x-auto whitespace-nowrap px-5">
            {[...MOODS, ...MOODS].map((m, i) => (
              <Link key={i} href={`/discover?mood=${m.key}`} className="font-serif text-xl italic hover:text-butter" tabIndex={i >= MOODS.length ? -1 : undefined} aria-hidden={i >= MOODS.length || undefined}>
                {m.label} <span className="mx-3 not-italic text-rose">✦</span>
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
              <div className="mt-8 grid grid-cols-3 gap-3 border-b-8 border-burgundy-deep/80 pb-1 sm:grid-cols-5" aria-hidden>
                {shelf.slice(0, 5).map((b, i) => (
                  <BookCover key={b.id} title={b.title} authors={b.authors} coverUrl={b.coverUrl} size="fill" className={i > 2 ? "hidden sm:block" : ""} />
                ))}
              </div>
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
              <ButtonLink href={viewer ? "/home" : "/signup"} size="lg">{viewer ? "Back to your feed" : "Make your shelf"}</ButtonLink>
              <p className="hand text-2xl text-burgundy">your people are already here →</p>
            </div>
          </div>
        </section>

        {trending.length > 0 && (
          <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8" aria-labelledby="trending-heading">
            <h2 id="trending-heading" className="text-3xl">Trending on dogear.</h2>
            <ul className="scrollbar-none mt-6 flex gap-5 overflow-x-auto pb-4">
              {trending.map((b) => (
                <li key={b.id} className="w-32 shrink-0">
                  <Link href={bookHref(b)} className="group block">
                    <BookCover title={b.title} authors={b.authors} coverUrl={b.coverUrl} size="fill" className="transition-transform group-hover:-translate-y-1" />
                    <p className="mt-2 line-clamp-2 font-serif leading-tight group-hover:text-burgundy">{b.title}</p>
                    <p className="meta truncate normal-case tracking-normal">{authorLine(b.authors)}</p>
                  </Link>
                </li>
              ))}
            </ul>
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
