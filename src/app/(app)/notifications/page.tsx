import { AtSign, Heart, Library, MessageCircle, Repeat2, Send, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BookCover } from "@/components/book/book-cover";
import { MarkRead } from "@/components/feed/mark-read";
import { PassOnButton } from "@/components/feed/pass-on-button";
import { Avatar } from "@/components/profile/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { getStore, requireViewer } from "@/lib/auth";
import { bookHref } from "@/lib/book-ref";
import type { Notification } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

const ICON = { follow: UserPlus, like: Heart, comment: MessageCircle, reply: AtSign, repost: Repeat2, recommendation: Send, list_follow: Library };

function describe(n: Notification) {
  switch (n.kind) {
    case "follow": return "started following you";
    case "like": return <>liked {n.postExcerpt}</>;
    case "comment": return <>commented on {n.postExcerpt}</>;
    case "reply": return "replied to your comment";
    case "repost": return <>reposted {n.postExcerpt}</>;
    case "list_follow": return <>followed your list “{n.listTitle}”</>;
    case "recommendation": return <>passed you <em className="font-serif not-italic">{n.recommendation?.book.title}</em></>;
  }
}
function href(n: Notification) {
  if (n.kind === "follow") return `/u/${n.actor.username}`;
  if (n.kind === "list_follow" && n.listId) return `/lists/${n.listId}`;
  if (n.kind === "recommendation" && n.recommendation) return bookHref(n.recommendation.book);
  if (n.postId) return `/post/${n.postId}${n.kind === "comment" || n.kind === "reply" ? "#comments" : ""}`;
  return "#";
}

export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const viewer = await requireViewer("/notifications");
  const sp = await searchParams;
  const tab = sp.tab === "passes" ? "passes" : "all";
  const store = await getStore();
  const [notifications, passes, following] = await Promise.all([store.listNotifications(60), store.listRecommendationsReceived(), store.listFollowing(viewer.id)]);
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-2xl">
      <MarkRead unread={unread} />
      <h1 className="text-5xl leading-none">Notifications<span className="text-burgundy">.</span></h1>
      <nav className="mt-6 flex gap-6 border-b border-line" aria-label="Notification type">
        {[{ k: "all", l: "Everything", h: "/notifications" }, { k: "passes", l: `Passed to you (${passes.length})`, h: "/notifications?tab=passes" }].map((t) => (
          <Link key={t.k} href={t.h} aria-current={tab === t.k ? "page" : undefined} className={cn("relative py-3 font-serif text-xl", tab === t.k ? "text-ink" : "text-ink-faint hover:text-ink")}>
            {t.l}{tab === t.k && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-burgundy" />}
          </Link>
        ))}
      </nav>

      {tab === "all" ? (
        notifications.length === 0 ? (
          <EmptyState className="mt-10" title="All quiet" body="Likes, comments, follows and books passed to you will show up here." />
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {notifications.map((n) => {
              const Icon = ICON[n.kind];
              return (
                <li key={n.id}>
                  <Link href={href(n)} className={cn("flex items-start gap-3 px-2 py-4 hover:bg-card", !n.readAt && "bg-rose/15")}>
                    <span className="relative">
                      <Avatar profile={n.actor} size="md" />
                      <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-ink text-paper"><Icon className="size-3" /></span>
                    </span>
                    <span className="min-w-0 flex-1 text-sm leading-snug">
                      <span className="font-medium">{n.actor.displayName}</span> <span className="text-ink-soft">{describe(n)}</span>
                      {n.commentBody && <span className="mt-1 block truncate italic text-ink-soft">“{n.commentBody}”</span>}
                      <span className="meta mt-1 block normal-case tracking-normal">{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.readAt && <span className="mt-2 size-2 shrink-0 rounded-full bg-burgundy" aria-label="unread" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      ) : passes.length === 0 ? (
        <EmptyState className="mt-10" title="No books passed to you yet" body="When a friend recommends a book with a note, it lands here." />
      ) : (
        <ul className="mt-8 space-y-8">
          {passes.map((r, i) => (
            <li key={r.id} className="relative border border-butter-deep/50 bg-butter/45 p-5 shadow-[var(--shadow-paper)]" style={{ rotate: `${i % 2 ? 0.6 : -0.6}deg` }}>
              <div className="tape tape-rose -top-3 left-8 -rotate-3" aria-hidden />
              <div className="flex gap-4">
                <Link href={bookHref(r.book)} className="shrink-0"><BookCover title={r.book.title} authors={r.book.authors} coverUrl={r.book.coverUrl} size="md" /></Link>
                <div className="min-w-0 flex-1">
                  <p className="text-sm"><Link href={`/u/${r.sender.username}`} className="font-medium hover:text-burgundy">{r.sender.displayName}</Link> <span className="text-ink-soft">passed you</span></p>
                  <Link href={bookHref(r.book)} className="font-serif text-2xl leading-tight hover:text-burgundy">{r.book.title}</Link>
                  {r.message && <p className="hand mt-2 text-2xl leading-tight">“{r.message}”</p>}
                  <p className="meta mt-2 normal-case tracking-normal">{timeAgo(r.createdAt)}{r.parentId ? " · part of a book trail" : ""}</p>
                  <div className="mt-3"><PassOnButton book={r.book} following={following} parentId={r.id} /></div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
