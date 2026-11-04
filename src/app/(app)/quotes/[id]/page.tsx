import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCover } from "@/components/book/book-cover";
import { Avatar } from "@/components/profile/avatar";
import { QuoteCard } from "@/components/quote/quote-card";
import { ShareButton } from "@/components/ui/share-button";
import { buttonClass } from "@/components/ui/button";
import { getStore, getViewer } from "@/lib/auth";
import { bookHref } from "@/lib/book-ref";
import { authorLine, formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/quotes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const q = await (await getStore()).getQuote(id);
  if (!q) return { title: "Quote not found" };
  return {
    title: `“${q.body.slice(0, 50)}…” — ${q.book.title}`,
    openGraph: q.visibility === "public" ? { images: [`/quotes/${id}/card`] } : undefined,
  };
}

export default async function QuotePage({ params }: PageProps<"/quotes/[id]">) {
  const { id } = await params;
  const [store, viewer] = await Promise.all([getStore(), getViewer()]);
  const quote = await store.getQuote(id);
  if (!quote) notFound();
  const own = viewer?.id === quote.userId;
  return (
    <div className="mx-auto max-w-3xl">
      <QuoteCard quote={quote} size="lg" className="sm:-rotate-1" />
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <Link href={`/u/${quote.author.username}`} className="flex items-center gap-2 text-sm">
          <Avatar profile={quote.author} size="sm" /> saved by <span className="font-medium">{quote.author.displayName}</span>
          <span className="meta normal-case tracking-normal">· {formatDate(quote.createdAt)}</span>
        </Link>
        <div className="flex flex-wrap gap-2">
          {quote.visibility === "public" && (
            <a href={`/quotes/${quote.id}/card`} download={`dogear-quote-${quote.id.slice(0, 8)}.png`} className={buttonClass("ink", "md")}><Download className="size-4" /> Download card</a>
          )}
          <ShareButton path={`/quotes/${quote.id}`} title={`A passage from ${quote.book.title}`} />
          {quote.postId && <Link href={`/post/${quote.postId}#comments`} className={buttonClass("paper", "md")}>Comments</Link>}
          {own && <Link href={`/quotes/${quote.id}/edit`} className={buttonClass("ghost", "md")}>Edit</Link>}
        </div>
      </div>
      {quote.visibility !== "public" && <p className="meta mt-3">Shareable image cards are available for public quotes.</p>}
      <Link href={bookHref(quote.book)} className="paper mt-10 flex items-center gap-4 p-4 hover:border-ink">
        <BookCover title={quote.book.title} authors={quote.book.authors} coverUrl={quote.book.coverUrl} size="sm" />
        <div>
          <p className="meta">from</p>
          <p className="font-serif text-2xl leading-tight">{quote.book.title}</p>
          <p className="meta normal-case tracking-normal">{authorLine(quote.book.authors)}</p>
        </div>
      </Link>
    </div>
  );
}
