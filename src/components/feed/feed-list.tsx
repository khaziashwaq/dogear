"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FeedSkeleton } from "@/components/ui/skeleton";
import type { Result } from "@/lib/action-result";
import type { Page, Post } from "@/lib/types";
import { PostCard } from "./post-card";

/**
 * Infinite-scrolling list of posts. The first page is server-rendered; further
 * pages load through a server action when the sentinel scrolls into view (with
 * a button fallback for keyboard users and when observers aren't available).
 */
export function FeedList({
  initial,
  load,
  empty,
}: {
  initial: Page<Post>;
  load: (cursor: string) => Promise<Result<Page<Post>>>;
  empty?: React.ReactNode;
}) {
  const [posts, setPosts] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const sentinel = useRef<HTMLDivElement>(null);

  // Reset when the server sends a fresh first page (e.g. after router.refresh()).
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setPosts(initial.items);
    setCursor(initial.nextCursor);
  }

  const more = () => {
    if (!cursor || pending) return;
    start(async () => {
      const res = await load(cursor);
      if (!res.ok) return setError(res.error);
      setError(null);
      setPosts((p) => {
        const ids = new Set(p.map((x) => x.id));
        return [...p, ...res.data.items.filter((x) => !ids.has(x.id))];
      });
      setCursor(res.data.nextCursor);
    });
  };

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && more(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  });

  if (posts.length === 0) return <>{empty}</>;

  return (
    <div>
      <div className="space-y-6">
        {posts.map((p) => <PostCard key={p.id} post={p} />)}
      </div>
      <div ref={sentinel} className="mt-6">
        {pending && <FeedSkeleton count={2} />}
        {error && <p className="text-center text-sm text-burgundy" role="alert">{error}</p>}
        {cursor && !pending && (
          <div className="flex justify-center">
            <Button variant="paper" onClick={more}>Load more</Button>
          </div>
        )}
        {!cursor && posts.length > 4 && <p className="hand py-6 text-center text-2xl text-ink-faint">you&rsquo;ve reached the last page ✦</p>}
      </div>
    </div>
  );
}
