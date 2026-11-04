import type { Metadata } from "next";
import Link from "next/link";
import { BookCover } from "@/components/book/book-cover";
import { DeleteSessionButton } from "@/components/review/delete-session-button";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Stars } from "@/components/ui/stars";
import { getStore, requireViewer } from "@/lib/auth";
import { bookHref } from "@/lib/book-ref";
import type { ReadingSession } from "@/lib/types";
import { authorLine, cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Reading diary" };

const STATUS = { finished: { label: "finished", tone: "bg-sage/50" }, reading: { label: "reading", tone: "bg-butter/70" }, abandoned: { label: "did not finish", tone: "bg-rose/50" } };

export default async function DiaryPage() {
  const viewer = await requireViewer("/diary");
  const store = await getStore();
  const [sessions, shelf] = await Promise.all([store.listSessions(), store.getShelf(viewer.id, {})]);
  const ratings = new Map(shelf.map((u) => [u.bookId, u.rating]));

  const groups = new Map<string, ReadingSession[]>();
  for (const s of sessions) {
    const d = s.finishedOn ?? s.startedOn ?? s.createdAt.slice(0, 10);
    const key = new Date(d).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="meta text-burgundy">private · only you can see this</p>
      <h1 className="mt-1 text-5xl leading-none">Reading diary<span className="text-burgundy">.</span></h1>
      <p className="hand mt-1 text-2xl text-ink-soft">every book, every time — re-reads included</p>

      {sessions.length === 0 ? (
        <EmptyState className="mt-10" title="Your diary is blank" body="Start reading something, or log dates for a book you've finished from its page." action={<ButtonLink href="/discover">Find a book</ButtonLink>} />
      ) : (
        <div className="mt-10 space-y-12">
          {[...groups.entries()].map(([month, items]) => (
            <section key={month} aria-label={month}>
              <h2 className="sticky top-[57px] z-10 -mx-2 bg-paper/95 px-2 py-2 font-serif text-3xl italic backdrop-blur md:top-0">{month}</h2>
              <ol className="relative mt-2 border-l border-line-strong pl-6">
                {items.map((s) => (
                  <li key={s.id} className="relative py-4">
                    <span className={cn("absolute -left-[31px] top-7 size-3 rounded-full border-2 border-paper", s.status === "finished" ? "bg-sage-deep" : s.status === "reading" ? "bg-butter-deep" : "bg-rose-deep")} aria-hidden />
                    <div className="flex gap-4">
                      <Link href={bookHref(s.book)} className="shrink-0"><BookCover title={s.book.title} authors={s.book.authors} coverUrl={s.book.coverUrl} size="sm" /></Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Link href={bookHref(s.book)} className="font-serif text-xl leading-tight hover:text-burgundy">{s.book.title}</Link>
                            <p className="meta normal-case tracking-normal">{authorLine(s.book.authors)}</p>
                          </div>
                          <DeleteSessionButton id={s.id} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={cn("meta rounded-full px-2 py-0.5 text-ink", STATUS[s.status].tone)}>{STATUS[s.status].label}</span>
                          {s.isReread && <span className="meta rounded-full border border-line-strong px-2 py-0.5">re-read</span>}
                          <span className="meta normal-case tracking-normal">
                            {s.startedOn ? formatDate(s.startedOn) : "?"} → {s.finishedOn ? formatDate(s.finishedOn) : s.status === "reading" ? "now" : "?"}
                          </span>
                          {s.status === "finished" && <Stars value={ratings.get(s.bookId) ?? null} size="xs" />}
                        </div>
                        {s.notes && <p className="hand mt-2 text-xl leading-tight text-burgundy">{s.notes}</p>}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
