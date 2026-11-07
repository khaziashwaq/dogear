import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentThread } from "@/components/feed/comment-thread";
import { PostActions } from "@/components/feed/post-actions";
import { Avatar } from "@/components/profile/avatar";
import { AnnotationCard } from "@/components/quote/quote-card";
import { ShareImages } from "@/components/review/review-share";
import { ButtonLink } from "@/components/ui/button";
import { getStore, getViewer } from "@/lib/auth";
import { bookHref } from "@/lib/book-ref";
import { authorLine, excerpt, formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/quotes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const q = await (await getStore()).getQuote(id);
  if (!q) return { title: "Annotation not found" };
  const shareable = !q.isDraft && q.visibility === "public";
  const title = `“${excerpt(q.body, 60)}” — ${q.book.title}`;
  const description = `${q.author.displayName || `@${q.author.username}`} marked this in ${q.book.title} by ${authorLine(q.book.authors)}.${q.commentary ? ` “${excerpt(q.commentary, 120)}”` : ""}`;
  const card = `/quotes/${id}/card?format=og`;
  return {
    title,
    description,
    robots: shareable ? undefined : { index: false },
    openGraph: shareable ? { type: "article", title, description, images: [{ url: card, width: 1200, height: 630 }] } : undefined,
    twitter: shareable ? { card: "summary_large_image", title, description, images: [card] } : undefined,
  };
}

export default async function AnnotationPage({ params }: PageProps<"/quotes/[id]">) {
  const { id } = await params;
  const [store, viewer] = await Promise.all([getStore(), getViewer()]);
  const quote = await store.getQuote(id);
  if (!quote) notFound();
  const own = viewer?.id === quote.userId;
  const [post, comments, more] = await Promise.all([
    quote.postId ? store.getPost(quote.postId) : null,
    quote.postId ? store.listComments(quote.postId) : [],
    store.listMarginalia({ tab: "recent", bookId: quote.bookId }, null, 7),
  ]);
  const others = more.items.filter((p) => p.quote && p.quote.id !== quote.id).slice(0, 6);

  return (
    <div className="mx-auto max-w-3xl">
      {quote.isDraft && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-dashed border-butter-deep bg-butter/40 px-4 py-3">
          <p className="text-sm">
            <span className="font-medium">Draft.</span> Only you can see this until you publish it.
          </p>
          <ButtonLink href={`/quotes/${quote.id}/edit`} size="sm">Finish and publish</ButtonLink>
        </div>
      )}

      <AnnotationCard quote={quote} size="lg" />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <Link href={`/u/${quote.author.username}`} className="flex items-center gap-2 text-sm">
          <Avatar profile={quote.author} size="sm" />
          <span>
            <span className="font-medium">{quote.author.displayName}</span>{" "}
            <span className="meta normal-case tracking-normal">· {formatDate(quote.createdAt)}{quote.updatedAt > quote.createdAt ? " · edited" : ""}</span>
          </span>
        </Link>
        {own && <ButtonLink href={`/quotes/${quote.id}/edit`} variant="paper" size="sm">Edit</ButtonLink>}
      </div>

      {post && (
        <div className="mt-4 border-y border-line py-1">
          <PostActions post={post} />
        </div>
      )}

      {!quote.isDraft &&
        (quote.visibility === "public" ? (
          <div className="mt-6">
            <ShareImages
              pagePath={`/quotes/${quote.id}`}
              cardPath={`/quotes/${quote.id}/card`}
              title={`A passage from ${quote.book.title}`}
              fileStem={`dogear-${quote.book.slug}`}
              formats={["portrait", "story", "og"]}
            />
          </div>
        ) : (
          <p className="mt-6 text-sm text-ink-soft">Image cards and public links are for annotations everyone can see.</p>
        ))}

      {quote.postId && (
        <div className="mt-12">
          <CommentThread postId={quote.postId} postOwnerId={quote.userId} initial={comments} />
        </div>
      )}

      {others.length > 0 && (
        <section className="mt-16">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-2xl">More marginalia from {quote.book.title}</h2>
            <Link href={`${bookHref(quote.book)}#marginalia`} className="link-underline shrink-0 text-sm text-burgundy">All of them</Link>
          </div>
          <div className="masonry columns-1 sm:columns-2">
            {others.map((p) => <AnnotationCard key={p.id} quote={p.quote!} showAuthor linkBook={false} href={`/quotes/${p.quote!.id}`} />)}
          </div>
        </section>
      )}
    </div>
  );
}
