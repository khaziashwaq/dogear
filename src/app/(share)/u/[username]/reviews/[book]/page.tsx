import { Heart, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookshelfRow } from "@/components/book/bookshelf";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/profile/avatar";
import { ReviewShare } from "@/components/review/review-share";
import { ButtonLink } from "@/components/ui/button";
import { Stars } from "@/components/ui/stars";
import { getViewer } from "@/lib/auth";
import { bookHref, reviewHref } from "@/lib/book-ref";
import { lookupReview } from "@/lib/review-lookup";
import { authorLine, excerpt, formatDate } from "@/lib/utils";

type Props = PageProps<"/u/[username]/reviews/[book]">;

async function load({ params, searchParams }: Props) {
  const [{ username, book }, sp] = await Promise.all([params, searchParams]);
  const pinned = typeof sp.r === "string" ? sp.r : null;
  return { found: await lookupReview(username, book, pinned), pinned };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { found, pinned } = await load(props);
  if (!found) return { title: "Review not found" };
  const { review } = found;
  const who = review.author.displayName || `@${review.author.username}`;
  const title = `${who} on ${review.book.title}`;
  const description = review.containsSpoilers
    ? `${review.rating ? `${review.rating}★ · ` : ""}A review of ${review.book.title} by ${authorLine(review.book.authors)}. Contains spoilers.`
    : `${review.rating ? `${review.rating}★ · ` : ""}${excerpt(review.title ? `${review.title}. ${review.body}` : review.body, 180)}`;
  const card = `${reviewHref(review)}/card?format=og${pinned ? `&r=${review.id}` : ""}`;
  return {
    title,
    description,
    alternates: { canonical: reviewHref(review, Boolean(pinned)) },
    // Followers-only and private reviews stay out of search engines.
    robots: review.visibility === "public" ? undefined : { index: false },
    openGraph:
      review.visibility === "public"
        ? { type: "article", title, description, siteName: "dogear.", publishedTime: review.createdAt, images: [{ url: card, width: 1200, height: 630, alt: `${title} — share card` }] }
        : undefined,
    twitter: review.visibility === "public" ? { card: "summary_large_image", title, description, images: [card] } : undefined,
  };
}

export default async function PublicReviewPage(props: Props) {
  const [{ found, pinned }, viewer] = await Promise.all([load(props), getViewer()]);
  if (!found) notFound();
  const { review, earlier } = found;
  const { book, author } = review;
  const own = viewer?.id === review.userId;
  const pagePath = reviewHref(review, Boolean(pinned));
  const cardPath = `${reviewHref(review)}/card${pinned ? `?r=${review.id}` : ""}`;
  const paragraphs = review.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const body = (
    <div className="space-y-5 text-[1.12rem] leading-[1.75] text-ink/90">
      {paragraphs.map((p, i) => (
        <p key={i} className={i === 0 ? "drop-cap whitespace-pre-line" : "whitespace-pre-line"}>{p}</p>
      ))}
    </div>
  );

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Logo href={viewer ? "/home" : "/"} />
        {viewer ? (
          <ButtonLink href="/home" variant="paper" size="sm">Your shelves</ButtonLink>
        ) : (
          <div className="flex items-center gap-2">
            <ButtonLink href={`/login?next=${encodeURIComponent(pagePath)}`} variant="paper" size="sm">Sign in</ButtonLink>
            <ButtonLink href="/login" size="sm">Join dogear.</ButtonLink>
          </div>
        )}
      </header>

      <article className="mx-auto grid max-w-6xl gap-10 px-5 pb-20 pt-6 sm:px-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16 md:pt-12">
        {/* the book */}
        <aside className="md:sticky md:top-10 md:self-start">
          <div className="mx-auto w-56 sm:w-64 md:w-full md:max-w-sm">
            <BookshelfRow decorative face="cover" layout="fit" size="xl" align="center" priorityCount={1} items={[{ key: book.id, book }]} />
          </div>
          <div className="mt-6 text-center md:text-left">
            <Link href={bookHref(book)} className="font-serif text-2xl leading-tight hover:text-burgundy">{book.title}</Link>
            <p className="mt-1 font-serif text-lg italic text-ink-soft">{authorLine(book.authors)}{book.publishedYear ? `, ${book.publishedYear}` : ""}</p>
            <Link href={bookHref(book)} className="link-underline mt-3 inline-block text-sm text-burgundy">More about this book on dogear.</Link>
          </div>
        </aside>

        {/* the review */}
        <div className="min-w-0">
          <Link href={`/u/${author.username}`} className="group inline-flex items-center gap-3">
            <Avatar profile={author} size="md" />
            <span>
              <span className="block font-medium group-hover:text-burgundy">{author.displayName}</span>
              <span className="meta block normal-case tracking-normal">@{author.username} · {formatDate(review.createdAt)}{review.isReread ? " · a re-read" : ""}</span>
            </span>
          </Link>

          <h1 className="mt-8 max-w-[18ch] text-5xl leading-[0.98] sm:text-6xl lg:text-7xl">{review.title ?? book.title}</h1>
          {review.title && <p className="mt-3 font-serif text-xl italic text-ink-soft">on {book.title}</p>}
          {review.rating != null && <Stars value={review.rating} size="md" className="mt-5 [&_svg]:size-7" />}

          <div className="mt-8 max-w-[62ch]">
            {review.containsSpoilers ? (
              <details className="group">
                <summary className="cursor-pointer list-none border border-dashed border-burgundy/50 bg-rose/15 px-5 py-4">
                  <span className="font-serif text-xl">This review contains spoilers.</span>{" "}
                  <span className="text-burgundy underline-offset-2 group-hover:underline">Read it anyway</span>
                </summary>
                <div className="mt-6">{body}</div>
              </details>
            ) : (
              body
            )}
          </div>

          <div className="mt-10 flex max-w-[62ch] flex-wrap items-center justify-between gap-4 border-t border-ink pt-5">
            {review.postId ? (
              <Link href={`/post/${review.postId}`} className="inline-flex items-center gap-4 text-sm hover:text-burgundy">
                <span className="inline-flex items-center gap-1.5"><Heart className="size-4" />{review.likesCount}<span className="sr-only"> likes</span></span>
                <span className="inline-flex items-center gap-1.5"><MessageCircle className="size-4" />{review.commentsCount}<span className="sr-only"> comments</span></span>
                <span className="link-underline">{review.commentsCount ? "Join the conversation" : "Start the conversation"}</span>
              </Link>
            ) : (
              <span />
            )}
            {own && <ButtonLink href={`/review/${review.id}/edit`} variant="paper" size="sm">Edit review</ButtonLink>}
          </div>

          {review.visibility === "public" ? (
            <div className="mt-6">
              <ReviewShare pagePath={pagePath} cardPath={cardPath} title={`${author.displayName} on ${book.title}`} fileStem={`dogear-${book.slug}`} />
            </div>
          ) : (
            <p className="mt-6 text-sm text-ink-soft">This review is {review.visibility === "followers" ? "for followers only" : "private"}, so it can&rsquo;t be shared publicly. Change its visibility to public to share it.</p>
          )}

          {earlier.length > 0 && (
            <p className="mt-8 text-sm text-ink-soft">
              {author.displayName.split(" ")[0]} also reviewed this on{" "}
              {earlier.map((r, i) => (
                <span key={r.id}>
                  {i > 0 && ", "}
                  <Link href={reviewHref(r, true)} className="link-underline text-ink">{formatDate(r.createdAt)}</Link>
                </span>
              ))}
              .
            </p>
          )}

          <aside className="paper mt-12 flex max-w-[62ch] items-start gap-4 p-5">
            <Avatar profile={author} size="lg" />
            <div className="min-w-0">
              <p className="font-serif text-xl">{author.displayName}</p>
              {author.bio && <p className="mt-1 text-sm text-ink-soft">{author.bio}</p>}
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <Link href={`/u/${author.username}`} className="link-underline text-burgundy">Their shelves</Link>
                <Link href={`/u/${author.username}/reviews`} className="link-underline text-burgundy">All their reviews</Link>
              </div>
            </div>
          </aside>
        </div>
      </article>

      <footer className="border-t border-line px-5 py-10 text-center">
        <Logo size="sm" />
        <p className="hand mt-1 text-xl text-ink-soft">a social network for people who annotate</p>
        {!viewer && <ButtonLink href="/login" className="mt-4">Start your own shelves</ButtonLink>}
      </footer>
    </div>
  );
}
