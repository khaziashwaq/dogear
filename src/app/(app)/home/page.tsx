import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PostCard } from "@/components/feed/post-card";
import { HomeShelves } from "@/components/shelf/home-shelves";
import { ReadingGoal } from "@/components/shelf/reading-goal";
import { requireViewer, getStore } from "@/lib/auth";

export const metadata: Metadata = { title: "Your shelves" };

export default async function HomePage({ searchParams }: PageProps<"/home">) {
  const sp = await searchParams;
  // The feed used to live here; keep old links (?tab=, ?compose=) working.
  if (sp.tab || sp.compose) {
    const q = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    redirect(`/activity?${q}`);
  }
  const viewer = await requireViewer("/home");
  const store = await getStore();
  const now = new Date();
  const [read, reading, want, circle, stats] = await Promise.all([
    store.getShelf(viewer.id, { status: "read", sort: "recent" }),
    store.getShelf(viewer.id, { status: "reading", sort: "recent" }),
    store.getShelf(viewer.id, { status: "want_to_read", sort: "recent" }),
    store.getFeed("following", null, 3),
    store.getProfileStats(viewer.id, now.getFullYear()),
  ]);


  return (
    // --home-chrome: everything on screen besides the three shelves (top bars, banner, page header, cornices,
    // and each shelf's plank and menu row), so the bookcase fits the viewport without scrolling.
    <div className="mx-auto max-w-[1600px] [--home-chrome:360px] sm:[--home-chrome:340px] md:[--home-chrome:232px]">
      <h1 className="sr-only">Your shelves</h1>

      {/* Keyed on the shelves' contents so a server refresh (e.g. "Add a book" from the create menu) remounts with fresh data. */}
      <HomeShelves
        allShelvesHref={`/u/${viewer.username}/shelves`}
        goal={
          <ReadingGoal
            goal={viewer.readingGoal}
            done={stats.booksReadThisYear}
            thisMonth={stats.byMonth[now.getMonth()] ?? 0}
            month={now.getMonth()}
            recapHref={`/u/${viewer.username}/recap`}
            settingsHref="/settings"
          />
        } key={[read, reading, want].map((s) => s.map((ub) => ub.bookId).join(",")).join("|")} initial={{ read, reading, want_to_read: want }} />

      {circle.items.length > 0 && (
        <section className="mt-16" aria-labelledby="circle">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 id="circle" className="text-3xl">Lately in your circle</h2>
            <Link href="/activity" className="link-underline text-sm text-burgundy">All activity</Link>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {circle.items.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
