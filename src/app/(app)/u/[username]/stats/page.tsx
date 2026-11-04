import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkle, Squiggle } from "@/components/ui/doodles";
import { getStore } from "@/lib/auth";
import { lookupProfile } from "@/lib/profile-lookup";
import { cn } from "@/lib/utils";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export default async function StatsPage({ params, searchParams }: PageProps<"/u/[username]/stats">) {
  const profile = await lookupProfile((await params).username);
  if (!profile) notFound();
  const now = new Date().getFullYear();
  const sp = await searchParams;
  const year = Math.min(now, Math.max(2000, Number(sp.year) || now));
  const store = await getStore();
  const s = await store.getProfileStats(profile.id, year);
  const maxMonth = Math.max(1, ...s.byMonth);
  const maxRating = Math.max(1, ...s.ratingDistribution);
  const maxGenre = Math.max(1, ...s.topGenres.map((g) => g.count));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {[now, now - 1, now - 2].map((y) => (
          <Link key={y} href={`/u/${profile.username}/stats?year=${y}`} aria-current={y === year ? "page" : undefined} className={cn("border px-3 py-1 font-mono text-sm", y === year ? "border-ink bg-ink text-paper" : "border-line-strong hover:border-ink")}>{y}</Link>
        ))}
      </div>

      <section className="relative overflow-hidden border border-ink bg-ink p-6 text-paper sm:p-10" aria-label={`${year} in books`}>
        <Sparkle className="absolute right-6 top-6 size-8 text-butter" />
        <p className="meta text-rose">{profile.displayName}&rsquo;s</p>
        <h2 className="text-6xl leading-none sm:text-8xl">{year}<span className="text-rose">,</span> <span className="italic">in books</span></h2>
        <Squiggle className="mt-4 text-butter" />
        <dl className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {[
            { k: "books finished", v: s.booksReadThisYear },
            { k: "pages turned", v: s.pagesReadThisYear.toLocaleString("en-GB") },
            { k: "average rating", v: s.averageRating ? `${s.averageRating}★` : "—" },
            { k: "on the go", v: s.currentlyReading },
          ].map((x, i) => (
            <div key={x.k} className={cn("border-t pt-3", ["border-rose", "border-butter", "border-sage", "border-paper/40"][i])}>
              <dt className="meta text-paper/60">{x.k}</dt>
              <dd className="mt-1 font-serif text-5xl">{x.v}</dd>
            </div>
          ))}
        </dl>
        {profile.readingGoal && (
          <p className="hand mt-8 text-3xl text-butter">
            {s.booksReadThisYear >= profile.readingGoal ? `goal of ${profile.readingGoal} reached ✦` : `${profile.readingGoal - s.booksReadThisYear} to go to hit ${profile.readingGoal}`}
          </p>
        )}
      </section>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <section className="paper p-6">
          <h3 className="text-2xl">Month by month</h3>
          <div className="mt-6 flex h-40 items-end gap-1.5" role="img" aria-label={`Books finished per month: ${s.byMonth.join(", ")}`}>
            {s.byMonth.map((n, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="meta">{n || ""}</span>
                <div className="w-full bg-burgundy/80" style={{ height: `${(n / maxMonth) * 100}%`, minHeight: n ? 6 : 2, opacity: n ? 1 : 0.2 }} />
                <span className="meta">{MONTHS[i]}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="paper p-6">
          <h3 className="text-2xl">How generous with stars</h3>
          <div className="mt-6 flex h-40 items-end gap-1.5" role="img" aria-label="Rating distribution">
            {s.ratingDistribution.map((n, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="meta">{n || ""}</span>
                <div className="w-full bg-sage-deep" style={{ height: `${(n / maxRating) * 100}%`, minHeight: n ? 6 : 2, opacity: n ? 1 : 0.2 }} />
                <span className="meta">{(i + 1) / 2}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="border border-line-strong bg-rose/30 p-6">
          <h3 className="text-2xl">Top genres <span className="font-sans text-sm text-ink-soft">(all time)</span></h3>
          {s.topGenres.length === 0 ? <p className="mt-4 text-sm text-ink-soft">Finish a few books to see your genres.</p> : (
            <ul className="mt-4 space-y-2">
              {s.topGenres.map((g) => (
                <li key={g.genre} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 font-serif text-lg italic">{g.genre}</span>
                  <span className="h-3 bg-burgundy" style={{ width: `${(g.count / maxGenre) * 100}%` }} />
                  <span className="meta">{g.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-line-strong bg-butter/50 p-6">
          <h3 className="text-2xl">Most-read authors</h3>
          {s.topAuthors.length === 0 ? <p className="mt-4 text-sm text-ink-soft">No authors yet.</p> : (
            <ol className="mt-4 space-y-1">
              {s.topAuthors.map((a, i) => (
                <li key={a.author} className="flex items-baseline gap-3">
                  <span className="font-serif text-2xl italic text-burgundy">{i + 1}</span>
                  <Link href={`/search?q=${encodeURIComponent(a.author)}`} className="font-serif text-xl hover:text-burgundy">{a.author}</Link>
                  <span className="meta">{a.count} {a.count === 1 ? "book" : "books"}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      <p className="meta mt-6">{s.booksRead} books read all time · {s.reviewsCount} reviews · {s.quotesCount} quotes · {s.listsCount} lists</p>
    </div>
  );
}
