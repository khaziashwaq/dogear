import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCover } from "@/components/book/book-cover";
import { ShareImages } from "@/components/review/review-share";
import { ButtonLink } from "@/components/ui/button";
import { Sparkle, Squiggle } from "@/components/ui/doodles";
import { Stars } from "@/components/ui/stars";
import { getStore, getViewer } from "@/lib/auth";
import { lookupProfile } from "@/lib/profile-lookup";
import type { ReadingRecap } from "@/lib/types";
import { authorLine, cn } from "@/lib/utils";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function period(sp: Record<string, string | string[] | undefined>) {
  const now = new Date();
  const year = Math.min(now.getFullYear(), Math.max(2000, Number(sp.year) || now.getFullYear()));
  const m = Number(sp.month);
  const month = m >= 1 && m <= 12 && !(year === now.getFullYear() && m > now.getMonth() + 1) ? m : null;
  return { year, month, now };
}

export async function generateMetadata({ params, searchParams }: PageProps<"/u/[username]/recap">): Promise<Metadata> {
  const { username } = await params;
  const { year, month } = period(await searchParams);
  const name = month ? `${MONTHS[month - 1]} ${year}` : `${year} Yearbook`;
  const card = `/u/${username}/recap/card?year=${year}${month ? `&month=${month}` : ""}&format=og`;
  return { title: `${name} · @${username}`, openGraph: { title: `@${username}'s ${name}`, images: [card] }, twitter: { card: "summary_large_image", images: [card] } };
}

/**
 * The Reading Yearbook (a year) or a monthly recap: what someone finished, loved and marked.
 * Only what the data says: a section with nothing to show is left out, never filled in.
 */
export default async function RecapPage({ params, searchParams }: PageProps<"/u/[username]/recap">) {
  const profile = await lookupProfile((await params).username);
  if (!profile || !profile.username) notFound();
  const { year, month, now } = period(await searchParams);
  const [store, viewer] = await Promise.all([getStore(), getViewer()]);
  const r = await store.readingRecap(profile.id, year, month);
  const own = viewer?.id === profile.id;
  const first = profile.displayName.split(" ")[0] || profile.username;
  const base = `/u/${profile.username}/recap`;
  const href = (y: number, m: number | null) => `${base}?year=${y}${m ? `&month=${m}` : ""}`;
  const prev = month ? (month === 1 ? href(year - 1, 12) : href(year, month - 1)) : href(year - 1, null);
  const nextAllowed = month ? !(year === now.getFullYear() && month >= now.getMonth() + 1) : year < now.getFullYear();
  const next = month ? (month === 12 ? href(year + 1, 1) : href(year, month + 1)) : href(year + 1, null);
  const name = month ? `${MONTHS[month - 1]} ${year}` : `${year}`;

  return (
    <div className="space-y-10">
      <nav aria-label="Recap period" className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link href={prev} className="grid size-9 place-items-center border border-line-strong hover:border-ink" aria-label="Earlier"><ChevronLeft className="size-4" /></Link>
          {nextAllowed ? (
            <Link href={next} className="grid size-9 place-items-center border border-line-strong hover:border-ink" aria-label="Later"><ChevronRight className="size-4" /></Link>
          ) : (
            <span className="grid size-9 place-items-center border border-line text-ink-faint" aria-hidden><ChevronRight className="size-4" /></span>
          )}
          <Link href={href(year, null)} aria-current={!month ? "page" : undefined} className={cn("ml-2 border px-3 py-1.5 font-mono text-sm", !month ? "border-ink bg-ink text-paper" : "border-line-strong hover:border-ink")}>
            {year}
          </Link>
        </div>
        <div className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Months">
          {MONTHS.map((m, i) => {
            const future = year === now.getFullYear() && i > now.getMonth();
            return future ? null : (
              <Link key={m} href={href(year, i + 1)} aria-current={month === i + 1 ? "page" : undefined} className={cn("shrink-0 px-2 py-1 font-mono text-xs uppercase", month === i + 1 ? "bg-burgundy text-paper" : "text-ink-soft hover:text-ink")}>
                {m.slice(0, 3)}
              </Link>
            );
          })}
        </div>
      </nav>

      <section className="relative overflow-hidden bg-ink px-6 py-10 text-paper sm:px-12 sm:py-14" aria-labelledby="recap-h">
        <Sparkle className="absolute right-8 top-8 size-8 text-butter" />
        <p className="meta text-rose">{own ? "your" : `${first}'s`} {month ? "month" : "yearbook"}</p>
        <h1 id="recap-h" className="mt-2 text-6xl leading-[0.95] sm:text-8xl">
          {name}
          <span className="text-rose">,</span> <span className="italic">in books</span>
        </h1>
        <Squiggle className="mt-5 text-butter" />
        {r.completions === 0 ? (
          <p className="hand mt-8 text-3xl text-butter">
            {own ? `nothing finished ${month ? "this month" : "this year"} yet — the page is still blank` : `no finished books here yet`}
          </p>
        ) : (
          <dl className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat k="books finished" v={r.completions} note={r.rereads ? `${r.rereads} re-read${r.rereads > 1 ? "s" : ""}` : null} tone="border-rose" />
            <Stat k="pages" v={r.booksWithPages ? r.pages.toLocaleString("en-GB") : "—"} note={r.booksWithPages < r.distinctBooks ? `${r.booksWithPages} of ${r.distinctBooks} books had a page count` : null} tone="border-butter" />
            <Stat k="average rating" v={r.averageRating ? `${r.averageRating}★` : "—"} note={null} tone="border-sage" />
            <Stat k="lines marked" v={r.annotations} note={null} tone="border-paper/40" />
          </dl>
        )}
      </section>

      {r.completions > 0 && (
        <div className="grid gap-8 md:grid-cols-[1.1fr_1fr]">
          {r.favouriteBook && (
            <section className="paper flex gap-6 p-6" aria-labelledby="fav-h">
              <Link href={`/book/${r.favouriteBook.slug}`} className="shrink-0">
                <BookCover title={r.favouriteBook.title} authors={r.favouriteBook.authors} coverUrl={r.favouriteBook.coverUrl} size="lg" />
              </Link>
              <div className="min-w-0">
                <h2 id="fav-h" className="meta">the one {month ? "this month" : "of the year"}</h2>
                <p className="mt-2 font-serif text-3xl leading-tight">{r.favouriteBook.title}</p>
                <p className="meta mt-1 normal-case tracking-normal">{authorLine(r.favouriteBook.authors)}</p>
                <Stars value={r.favouriteBook.rating} size="md" className="mt-3" />
              </div>
            </section>
          )}
          <section className="grid grid-cols-2 gap-4" aria-label="Highlights">
            {r.topAuthor && <Fact k="most-read author" v={r.topAuthor.name} n={`${r.topAuthor.count} ${r.topAuthor.count === 1 ? "book" : "books"}`} tone="bg-butter/50" />}
            {r.topGenre && <Fact k="genre you kept returning to" v={r.topGenre.name} n={`${r.topGenre.count} ${r.topGenre.count === 1 ? "book" : "books"}`} tone="bg-rose/40" />}
            {!month && r.busiestMonth && <Fact k="busiest month" v={MONTHS[r.busiestMonth.month - 1]} n={`${r.busiestMonth.count} finished`} tone="bg-sage/40" />}
            {r.mostHighlighted && <Fact k="most underlined" v={r.mostHighlighted.title} n={`${r.mostHighlighted.count} lines`} tone="bg-paper-deep" />}
          </section>
        </div>
      )}

      {r.lovedLine && (
        <figure className="border-l-4 border-burgundy pl-6">
          <p className="meta">the line readers loved most</p>
          <blockquote className="mt-2 max-w-3xl font-serif text-3xl italic leading-snug">
            <Link href={`/quotes/${r.lovedLine.quoteId}`} className="hover:text-burgundy">&ldquo;{r.lovedLine.body}&rdquo;</Link>
          </blockquote>
          <figcaption className="meta mt-2 normal-case tracking-normal">{r.lovedLine.title} · {r.lovedLine.likes} {r.lovedLine.likes === 1 ? "like" : "likes"}</figcaption>
        </figure>
      )}

      {r.timeline.length > 0 && <Timeline r={r} />}

      <div className="flex flex-wrap items-center gap-3">
        {r.completions > 0 && (
          <ShareImages
            pagePath={href(year, month)}
            cardPath={`/u/${profile.username}/recap/card?year=${year}${month ? `&month=${month}` : ""}`}
            title={`${first}'s ${name} in books`}
            fileStem={`dogear-${profile.username}-${year}${month ? `-${String(month).padStart(2, "0")}` : ""}`}
            formats={["portrait", "story", "og"]}
            dialogTitle={month ? "Share this month" : "Share your yearbook"}
          />
        )}
        <ButtonLink href={`/u/${profile.username}/stats?year=${year}`} variant="paper">All the numbers</ButtonLink>
      </div>
    </div>
  );
}

function Stat({ k, v, note, tone }: { k: string; v: string | number; note: string | null; tone: string }) {
  return (
    <div className={cn("border-t pt-3", tone)}>
      <dt className="meta text-paper/60">{k}</dt>
      <dd className="mt-1 font-serif text-5xl">{v}</dd>
      {note && <dd className="mt-1 text-xs text-paper/60">{note}</dd>}
    </div>
  );
}

function Fact({ k, v, n, tone }: { k: string; v: string; n: string; tone: string }) {
  return (
    <div className={cn("border border-line-strong p-4", tone)}>
      <p className="meta">{k}</p>
      <p className="mt-1 line-clamp-2 font-serif text-2xl capitalize leading-tight">{v}</p>
      <p className="hand text-lg text-ink-soft">{n}</p>
    </div>
  );
}

/** Every book finished, in order — by month across a year, by day within a month. */
function Timeline({ r }: { r: ReadingRecap }) {
  const groups = r.month
    ? [{ label: null as string | null, items: r.timeline }]
    : MONTHS.map((m, i) => ({ label: m, items: r.timeline.filter((t) => Number(t.day.slice(5, 7)) === i + 1) })).filter((g) => g.items.length);
  return (
    <section aria-labelledby="tl-h">
      <h2 id="tl-h" className="text-3xl">The reading line</h2>
      {/* Months side by side across a year (it reads left to right, like a calendar); one run within a month. */}
      <ol className={cn("mt-5", r.month ? "" : "grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3")}>
        {groups.map((g) => (
          <li key={g.label ?? "month"} className="border-l-2 border-line pl-4">
            {g.label && <p className="meta mb-2 text-burgundy">{g.label}</p>}
            <ul className="flex flex-wrap gap-4">
              {g.items.map((t, i) => (
                <li key={`${t.id}-${i}`} className="w-24">
                  <Link href={`/book/${t.slug}`} className="group block">
                    <BookCover title={t.title} authors={t.authors} coverUrl={t.coverUrl} size="md" className="transition-transform group-hover:-translate-y-1" />
                    <span className="mt-1 line-clamp-2 block font-serif text-sm leading-tight">{t.title}</span>
                    <span className="meta block normal-case tracking-normal">
                      {new Date(`${t.day}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      {t.reread ? " · re-read" : ""}
                    </span>
                    {t.rating != null && <Stars value={t.rating} size="xs" />}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
