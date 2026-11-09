"use client";

import { Eye, Lock, MoreHorizontal, Repeat2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePostAction, setMutedAction } from "@/app/actions/social";
import { ReportDialog } from "@/components/safety/report-dialog";
import { BookCover } from "@/components/book/book-cover";
import { ListCover } from "@/components/list/list-cover";
import { Avatar } from "@/components/profile/avatar";
import { FollowButton } from "@/components/profile/follow-button";
import { useViewer } from "@/components/providers/viewer";
import { QuoteCard } from "@/components/quote/quote-card";
import { Stars } from "@/components/ui/stars";
import { useToast } from "@/components/ui/toast";
import { bookHref } from "@/lib/book-ref";
import type { Post, Review, SavedBook } from "@/lib/types";
import { authorLine, cn, excerpt, plural, timeAgo, tilt } from "@/lib/utils";
import { PostActions } from "./post-actions";

const VERB: Record<Post["kind"], string> = {
  review: "reviewed",
  update: "posted an update",
  started: "started reading",
  finished: "finished",
  quote: "saved a passage",
  list: "made a list",
  recommendation: "recommends",
  repost: "reposted",
};

function VisibilityBadge({ v }: { v: Post["visibility"] }) {
  if (v === "public") return null;
  const Icon = v === "private" ? Lock : Users;
  return (
    <span className="meta inline-flex items-center gap-1" title={v === "private" ? "Only you" : "Followers only"}>
      <Icon className="size-3" /> {v === "private" ? "only you" : "followers"}
    </span>
  );
}

/** ⋯ on a post: edit / delete your own; report or mute the author on anyone else's. */
function PostMenu({ post, own }: { post: Post; own: boolean }) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const editHref = post.review ? `/review/${post.review.id}/edit` : post.quote ? `/quotes/${post.quote.id}/edit` : post.list ? `/lists/${post.list.id}/edit` : null;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label="Post options" className="rounded-full p-1.5 text-ink-faint hover:bg-paper-deep hover:text-ink">
        <MoreHorizontal className="size-4" />
      </button>
      {open && !own && (
        <div role="menu" className="absolute right-0 top-8 z-20 w-48 border border-line-strong bg-card py-1 text-sm shadow-[var(--shadow-lift)]" onMouseLeave={() => setOpen(false)}>
          <button
            role="menuitem"
            type="button"
            disabled={pending}
            className="block w-full px-4 py-2 text-left hover:bg-paper-deep"
            onClick={() =>
              start(async () => {
                const res = await setMutedAction(post.userId, true);
                setOpen(false);
                if (!res.ok) return toast(res.error, "error");
                toast(`Muted ${post.author.displayName.split(" ")[0]}. Their posts won't show in your feeds.`);
                router.refresh();
              })
            }
          >
            Mute {post.author.displayName.split(" ")[0]}
          </button>
          <button role="menuitem" type="button" className="block w-full px-4 py-2 text-left text-burgundy hover:bg-paper-deep" onClick={() => (setOpen(false), setReporting(true))}>
            Report
          </button>
        </div>
      )}
      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        targetType={post.review ? "review" : post.quote ? "quote" : post.list ? "list" : "post"}
        targetId={post.review?.id ?? post.quote?.id ?? post.list?.id ?? post.id}
        what={post.review ? "this review" : post.quote ? "this annotation" : post.list ? "this list" : "this post"}
      />
      {open && own && (
        <div role="menu" className="absolute right-0 top-8 z-20 w-44 border border-line-strong bg-card py-1 text-sm shadow-[var(--shadow-lift)]" onMouseLeave={() => setOpen(false)}>
          {editHref && (
            <Link role="menuitem" href={editHref} className="block px-4 py-2 hover:bg-paper-deep">Edit</Link>
          )}
          <button
            role="menuitem"
            type="button"
            disabled={pending}
            className="block w-full px-4 py-2 text-left text-burgundy hover:bg-paper-deep"
            onClick={() => {
              const what = post.review ? "review" : post.quote ? "quote" : post.list ? "list" : "post";
              if (!confirm(`Delete this ${what}? This can't be undone.`)) return;
              start(async () => {
                const res = await deletePostAction(post.id);
                if (!res.ok) toast(res.error, "error");
                else {
                  toast("Deleted");
                  setOpen(false);
                  router.refresh();
                }
              });
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function BookLine({ book }: { book: SavedBook }) {
  return (
    <Link href={bookHref(book)} className="group/book inline-block">
      <span className="font-serif text-xl leading-tight group-hover/book:text-burgundy">{book.title}</span>
      <span className="meta block normal-case tracking-normal">{authorLine(book.authors)}{book.publishedYear ? ` · ${book.publishedYear}` : ""}</span>
    </Link>
  );
}

export function ReviewBody({ review, full = false }: { review: Review; full?: boolean }) {
  const [revealed, setRevealed] = useState(!review.containsSpoilers);
  const text = full ? review.body : excerpt(review.body, 420);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={review.rating} />
        {review.isReread && <span className="meta rounded-full border border-line-strong px-2 py-0.5">re-read</span>}
        {review.containsSpoilers && <span className="meta rounded-full bg-burgundy px-2 py-0.5 text-paper">spoilers</span>}
      </div>
      {review.title && <h3 className="mt-2 text-2xl italic leading-tight">{review.title}</h3>}
      <div className="relative mt-2">
        <div className={cn("whitespace-pre-line text-[0.95rem] leading-relaxed text-ink/90", full && "drop-cap", !revealed && "select-none blur-[6px]")} aria-hidden={!revealed}>
          {text}
        </div>
        {!revealed && (
          <button type="button" onClick={() => setRevealed(true)} className="absolute inset-0 flex items-center justify-center">
            <span className="flex items-center gap-2 border border-ink bg-card px-3 py-1.5 text-sm shadow-[2px_2px_0_var(--color-burgundy)]">
              <Eye className="size-4" /> Show spoilers
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

export function PostCard({ post, nested = false, full = false }: { post: Post; nested?: boolean; full?: boolean }) {
  const { viewer } = useViewer();
  if (post.kind === "repost" && post.repostOf) {
    return (
      <article className="animate-rise">
        <p className="meta mb-2 flex items-center gap-1.5 pl-1">
          <Repeat2 className="size-3.5 text-sage-deep" />
          <Link href={`/u/${post.author.username}`} className="normal-case tracking-normal text-ink hover:text-burgundy">{post.author.displayName || post.author.username}</Link>
          reposted · {timeAgo(post.createdAt)}
        </p>
        <PostCard post={post.repostOf} nested />
      </article>
    );
  }

  const own = viewer?.id === post.userId;
  const href = `/post/${post.id}`;
  const surface =
    post.kind === "review" ? "paper dogear" :
    post.kind === "update" ? "paper ruled" :
    post.kind === "recommendation" ? "border border-butter-deep/50 bg-butter/45 shadow-[var(--shadow-paper)]" :
    post.kind === "list" ? "paper" :
    post.kind === "quote" ? "" : "paper";

  return (
    <article className={cn("relative", !nested && "animate-rise")} aria-label={`${post.author.displayName} ${VERB[post.kind]}`}>
      <div className={cn(surface, post.kind !== "quote" && "p-5 sm:p-6")}>
        {/* header */}
        <header className={cn("flex items-start gap-3", post.kind === "quote" && "mb-3 px-1")}>
          <Link href={`/u/${post.author.username}`} className="shrink-0"><Avatar profile={post.author} size="sm" /></Link>
          <div className="min-w-0 flex-1 text-sm leading-snug">
            <p>
              <Link href={`/u/${post.author.username}`} className="font-medium hover:text-burgundy">{post.author.displayName || post.author.username}</Link>{" "}
              <span className="text-ink-soft">{VERB[post.kind]}</span>
            </p>
            <p className="meta mt-0.5 flex flex-wrap items-center gap-x-2 normal-case tracking-normal">
              <Link href={href} className="hover:text-ink">{timeAgo(post.createdAt)}</Link>
              <VisibilityBadge v={post.visibility} />
              {!own && <FollowButton userId={post.author.id} name={post.author.displayName} variant="text" className="uppercase tracking-[0.08em]" />}
            </p>
          </div>
          {viewer && <PostMenu post={post} own={own} />}
        </header>

        {/* body */}
        <div className="mt-4">
          {post.kind === "review" && post.review && (
            <div className="flex gap-4 sm:gap-5">
              <Link href={bookHref(post.review.book)} className="shrink-0" aria-label={post.review.book.title}>
                <BookCover title={post.review.book.title} authors={post.review.book.authors} coverUrl={post.review.book.coverUrl} size="md" tilt={tilt(post.id, 1.5)} />
              </Link>
              <div className="min-w-0 flex-1">
                <BookLine book={post.review.book} />
                <div className="mt-3"><ReviewBody review={post.review} full={full} /></div>
                {!full && post.review.body.length > 420 && (
                  <Link href={href} className="meta mt-2 inline-block text-burgundy hover:text-ink">Keep reading →</Link>
                )}
              </div>
            </div>
          )}

          {post.kind === "quote" && post.quote && <QuoteCard quote={post.quote} />}

          {post.kind === "list" && post.list && (
            <Link href={`/lists/${post.list.id}`} className="group -mx-5 -mb-1 block sm:-mx-6">
              <ListCover style={post.list.coverStyle} books={post.list.preview} imageUrl={post.list.coverImageUrl} />
              <div className="px-5 pt-4 sm:px-6">
                <h3 className="text-2xl leading-tight group-hover:text-burgundy">{post.list.title}</h3>
                {post.list.description && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{post.list.description}</p>}
                <p className="meta mt-2">{plural(post.list.bookCount, "book")}{post.list.isRanked ? " · ranked" : ""}</p>
              </div>
            </Link>
          )}

          {(post.kind === "started" || post.kind === "finished") && post.book && (
            <div className="flex items-center gap-5">
              <Link href={bookHref(post.book)} className="relative shrink-0">
                <BookCover title={post.book.title} authors={post.book.authors} coverUrl={post.book.coverUrl} size="md" tilt={tilt(post.id, 3)} />
                {post.kind === "finished" && (
                  <span aria-hidden className="absolute -right-4 -top-3 rotate-12 rounded-full border-2 border-burgundy bg-paper/90 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-widest text-burgundy">
                    read ✓
                  </span>
                )}
              </Link>
              <div>
                <p className="hand text-2xl text-burgundy">{post.kind === "finished" ? "the end." : "chapter one…"}</p>
                <BookLine book={post.book} />
                {post.book.pageCount && <p className="meta mt-2">{post.book.pageCount} pages</p>}
              </div>
            </div>
          )}

          {(post.kind === "update" || post.kind === "recommendation") && (
            <div>
              {post.body && (
                <p className={cn("whitespace-pre-line leading-relaxed", post.kind === "recommendation" ? "hand text-2xl leading-tight text-ink" : "text-[0.95rem]")}>
                  {post.body}
                </p>
              )}
              {post.book && (
                <Link href={bookHref(post.book)} className="mt-4 flex items-center gap-3 border border-line bg-card/80 p-2.5 hover:border-ink">
                  <BookCover title={post.book.title} authors={post.book.authors} coverUrl={post.book.coverUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-lg leading-tight">{post.book.title}</p>
                    <p className="meta truncate normal-case tracking-normal">{authorLine(post.book.authors)}</p>
                    {(post.progressPercent != null || post.progressPages != null) && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-shade">
                          <div className="h-full bg-sage-deep" style={{ width: `${post.progressPercent ?? Math.min(100, Math.round(((post.progressPages ?? 0) / (post.book.pageCount || 1)) * 100))}%` }} />
                        </div>
                        <span className="meta tabular-nums">
                          {post.progressPages != null ? `p. ${post.progressPages}` : `${post.progressPercent}%`}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              )}
            </div>
          )}
        </div>

        <footer className={cn("mt-4 border-t border-line pt-2", post.kind === "quote" && "border-t-0 px-1")}>
          <PostActions post={post} />
        </footer>
      </div>
    </article>
  );
}

