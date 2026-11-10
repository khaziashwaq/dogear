import { X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BookFilter } from "@/components/quote/book-filter";
import { MarginaliaFeed } from "@/components/quote/marginalia-feed";
import { ButtonLink } from "@/components/ui/button";
import { chipClass } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { getStore, getViewer } from "@/lib/auth";
import { GENRES } from "@/lib/data/seed/books";
import type { MarginaliaQuery } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Marginalia",
  description: "Passages readers have marked, and what they wrote in the margins.",
};

export default async function MarginaliaPage({ searchParams }: PageProps<"/marginalia">) {
  const sp = await searchParams;
  const [store, viewer] = await Promise.all([getStore(), getViewer()]);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  const tabs = (viewer ? ["following", "popular", "recent", "saved"] : ["popular", "recent"]) as MarginaliaQuery["tab"][];
  const tab = tabs.find((t) => t === sp.tab) ?? (viewer ? "following" : "popular");
  const genre = (GENRES as readonly string[]).includes(str(sp.genre) ?? "") ? str(sp.genre) : null;
  const tag = str(sp.tag)?.toLowerCase().replace(/^#/, "").slice(0, 32) ?? null;
  const book = str(sp.book) ? await store.getBookBySlug(str(sp.book)!.toLowerCase()) : null;

  const query: MarginaliaQuery = { tab, genre, tag, bookId: book?.id ?? null };
  const saved = tab === "saved";
  // Saved: the annotations you bookmarked (from any reader), newest first; the filters don't apply.
  const [first, tags] = await Promise.all([saved ? store.listBookmarks(null, 18, "quote") : store.listMarginalia(query, null), store.marginaliaTags(16)]);

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { tab, genre, tag, book: book?.slug ?? null, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return s ? `/marginalia?${s}` : "/marginalia";
  };
  const filtered = Boolean(genre || tag || book);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl leading-none sm:text-6xl">Marginalia<span className="text-burgundy">.</span></h1>
          <p className="hand mt-1 text-2xl text-ink-soft">the pages other readers folded down, and what they scribbled beside them</p>
        </div>
        {viewer && <ButtonLink href="/quotes/new">Add a highlight</ButtonLink>}
      </header>

      <nav aria-label="Marginalia" className="mb-5 flex gap-6 border-b border-line">
        {tabs.map((t) => (
          <Link
            key={t}
            href={href({ tab: t })}
            aria-current={tab === t ? "page" : undefined}
            className={cn("relative py-3 font-serif text-xl capitalize transition-colors", tab === t ? "text-ink" : "text-ink-faint hover:text-ink")}
          >
            {t}
            {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-burgundy" />}
          </Link>
        ))}
      </nav>

      {/* filters */}
      <div className={cn("mb-8 space-y-3", saved && "hidden")}>
        <div className="flex flex-wrap items-center gap-2">
          {book ? (
            <Link href={href({ book: null })} className={chipClass("ink", true, "shrink-0")} aria-label={`Remove book filter: ${book.title}`}>
              {book.title} <X className="size-3.5" />
            </Link>
          ) : (
            <BookFilter hrefFor={href({ book: "__BOOK__" })} />
          )}
          {filtered && (
            <Link href={href({ genre: null, tag: null, book: null })} className="ml-1 text-sm text-burgundy hover:underline">Clear filters</Link>
          )}
        </div>
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <span className="meta shrink-0 self-center pr-1">genre</span>
          {GENRES.map((g) => (
            <Link key={g} href={href({ genre: genre === g ? null : g })} aria-current={genre === g ? "true" : undefined} className={chipClass("sage", genre === g, "shrink-0")}>
              {g}
            </Link>
          ))}
        </div>
        {(tags.length > 0 || tag) && (
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            <span className="meta shrink-0 self-center pr-1">tags</span>
            {tag && !tags.some((t) => t.tag === tag) && (
              <Link href={href({ tag: null })} aria-current="true" className={chipClass("rose", true, "shrink-0")}>#{tag}</Link>
            )}
            {tags.map((t) => (
              <Link key={t.tag} href={href({ tag: tag === t.tag ? null : t.tag })} aria-current={tag === t.tag ? "true" : undefined} className={chipClass("rose", tag === t.tag, "shrink-0")}>
                #{t.tag}
              </Link>
            ))}
          </div>
        )}
      </div>

      {first.items.length === 0 ? (
        <EmptyState
          title={saved ? "Nothing saved yet" : filtered ? "Nothing marked here yet" : tab === "following" ? "Your circle hasn't marked anything yet" : "No marginalia yet"}
          body={
            saved
              ? "Tap the bookmark on any annotation to keep it here."
              : filtered
              ? "No one has annotated this yet. Try another filter, or be the first."
              : tab === "following"
                ? "When readers you follow save a passage, it lands here. Popular and Recent show everyone's."
                : "Save a passage from a book you love and it'll show up here."
          }
          note="every margin starts blank"
          action={
            <>
              {viewer && <ButtonLink href={book ? `/quotes/new?book=${encodeURIComponent(book.slug)}` : "/quotes/new"}>Add a highlight</ButtonLink>}
              {tab === "following" && <ButtonLink href={href({ tab: "popular" })} variant="paper">See popular</ButtonLink>}
            </>
          }
        />
      ) : (
        <MarginaliaFeed key={JSON.stringify(query)} initial={first} query={query} showBook={saved || !book} />
      )}
    </div>
  );
}
