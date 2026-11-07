import { Heart, MessageCircle } from "lucide-react";
import Link from "next/link";
import { BookCover } from "@/components/book/book-cover";
import { ReviewBody } from "@/components/feed/post-card";
import { Avatar } from "@/components/profile/avatar";
import { bookHref, reviewHref } from "@/lib/book-ref";
import type { Review } from "@/lib/types";
import { authorLine, cn, formatDate } from "@/lib/utils";

/** Editorial review: byline like a magazine column. `showBook` for profile pages. */
export function ReviewCard({ review, showBook = false, className }: { review: Review; showBook?: boolean; className?: string }) {
  const href = review.postId ? `/post/${review.postId}` : bookHref(review.book);
  return (
    <article className={cn("paper dogear p-5 sm:p-6", className)}>
      <div className="flex gap-4">
        {showBook && (
          <Link href={bookHref(review.book)} className="shrink-0"><BookCover title={review.book.title} authors={review.book.authors} coverUrl={review.book.coverUrl} size="md" /></Link>
        )}
        <div className="min-w-0 flex-1">
          {showBook && (
            <Link href={bookHref(review.book)} className="group">
              <p className="font-serif text-xl leading-tight group-hover:text-burgundy">{review.book.title}</p>
              <p className="meta normal-case tracking-normal">{authorLine(review.book.authors)}</p>
            </Link>
          )}
          {!showBook && (
            <Link href={`/u/${review.author.username}`} className="mb-3 flex items-center gap-2 text-sm">
              <Avatar profile={review.author} size="sm" />
              <span><span className="font-medium hover:text-burgundy">{review.author.displayName}</span> <span className="meta normal-case tracking-normal">· {formatDate(review.createdAt)}</span></span>
            </Link>
          )}
          <div className={cn(showBook && "mt-3")}><ReviewBody review={review} /></div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href={href} className="meta text-burgundy hover:text-ink">
              {review.body.length > 420 ? "Read the full review" : "Open thread"} →
            </Link>
            {(review.likesCount > 0 || review.commentsCount > 0) && (
              <span className="meta inline-flex items-center gap-3 normal-case tracking-normal">
                {review.likesCount > 0 && <span className="inline-flex items-center gap-1"><Heart className="size-3" aria-hidden />{review.likesCount}<span className="sr-only"> likes</span></span>}
                {review.commentsCount > 0 && <span className="inline-flex items-center gap-1"><MessageCircle className="size-3" aria-hidden />{review.commentsCount}<span className="sr-only"> comments</span></span>}
              </span>
            )}
            {review.visibility === "public" && review.author.username && (
              <Link href={reviewHref(review, true)} className="meta hover:text-burgundy">review page</Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
