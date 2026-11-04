"use client";

import { Bookmark, Heart, MessageCircle, Repeat2, Share } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleBookmarkAction, toggleLikeAction, toggleRepostAction } from "@/app/actions/social";
import { useViewer } from "@/components/providers/viewer";
import { useToast } from "@/components/ui/toast";
import type { Post } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PostActions({ post }: { post: Post }) {
  const { viewer } = useViewer();
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  const [liked, setLiked] = useState(post.viewer.liked);
  const [likes, setLikes] = useState(post.likesCount);
  const [marked, setMarked] = useState(post.viewer.bookmarked);
  const [reposted, setReposted] = useState(post.viewer.reposted);
  const [reposts, setReposts] = useState(post.repostsCount);
  const [burst, setBurst] = useState(0);

  const own = viewer?.id === post.userId;
  const canRepost = post.visibility === "public" && !own;

  const guard = () => {
    if (!viewer) {
      router.push("/login");
      return false;
    }
    return true;
  };

  const like = () => {
    if (!guard()) return;
    const on = !liked;
    setLiked(on);
    setLikes((n) => n + (on ? 1 : -1));
    if (on) setBurst((b) => b + 1);
    start(async () => {
      const res = await toggleLikeAction(post.id, on);
      if (!res.ok) {
        setLiked(!on);
        setLikes((n) => n + (on ? -1 : 1));
        toast(res.error, "error");
      }
    });
  };
  const mark = () => {
    if (!guard()) return;
    const on = !marked;
    setMarked(on);
    start(async () => {
      const res = await toggleBookmarkAction(post.id, on);
      if (!res.ok) {
        setMarked(!on);
        toast(res.error, "error");
      } else toast(on ? "Saved to bookmarks" : "Removed from bookmarks");
    });
  };
  const repost = () => {
    if (!guard()) return;
    const on = !reposted;
    setReposted(on);
    setReposts((n) => n + (on ? 1 : -1));
    start(async () => {
      const res = await toggleRepostAction(post.id, on);
      if (!res.ok) {
        setReposted(!on);
        setReposts((n) => n + (on ? -1 : 1));
        toast(res.error, "error");
      } else {
        toast(on ? "Reposted to your followers" : "Repost removed");
        router.refresh();
      }
    });
  };
  const share = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ url, title: "On dogear." });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied");
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  const btn = "group inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-ink-soft transition-colors hover:text-ink";
  return (
    <div className="flex items-center justify-between gap-1 text-sm sm:justify-start sm:gap-4">
      <button type="button" onClick={like} aria-pressed={liked} aria-label={liked ? "Unlike" : "Like"} className={cn(btn, liked && "text-burgundy hover:text-burgundy")}>
        <span className="relative">
          <Heart key={burst} className={cn("size-[18px] transition-transform group-active:scale-90", liked && "animate-[pop_.35s_ease] fill-burgundy")} strokeWidth={1.6} />
        </span>
        <span className="tabular-nums">{likes || ""}</span>
      </button>
      <Link href={`/post/${post.id}#comments`} aria-label={`Comments (${post.commentsCount})`} className={btn}>
        <MessageCircle className="size-[18px]" strokeWidth={1.6} />
        <span className="tabular-nums">{post.commentsCount || ""}</span>
      </Link>
      {canRepost && (
        <button type="button" onClick={repost} aria-pressed={reposted} aria-label={reposted ? "Undo repost" : "Repost"} className={cn(btn, reposted && "text-sage-deep hover:text-sage-deep")}>
          <Repeat2 className="size-[18px]" strokeWidth={1.6} />
          <span className="tabular-nums">{reposts || ""}</span>
        </button>
      )}
      <button type="button" onClick={mark} aria-pressed={marked} aria-label={marked ? "Remove bookmark" : "Bookmark"} className={cn(btn, marked && "text-burgundy hover:text-burgundy")}>
        <Bookmark className={cn("size-[18px]", marked && "fill-burgundy")} strokeWidth={1.6} />
      </button>
      <button type="button" onClick={share} aria-label="Share" className={cn(btn, "sm:ml-auto")}>
        <Share className="size-[17px]" strokeWidth={1.6} />
      </button>
    </div>
  );
}
