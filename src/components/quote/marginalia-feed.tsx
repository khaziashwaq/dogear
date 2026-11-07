"use client";

import { useState, useTransition } from "react";
import { loadMarginaliaAction } from "@/app/actions/content";
import { PostActions } from "@/components/feed/post-actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { MarginaliaQuery, Page, Post } from "@/lib/types";
import { hash } from "@/lib/utils";
import { AnnotationCard } from "./quote-card";

/** A masonry of annotations, each with its like / comment / bookmark / share actions, paged by "Load more". */
export function MarginaliaFeed({ initial, query, showBook = true }: { initial: Page<Post>; query: MarginaliaQuery; showBook?: boolean }) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [pending, start] = useTransition();
  const toast = useToast();

  const more = () =>
    start(async () => {
      const res = await loadMarginaliaAction(query, cursor);
      if (!res.ok) return toast(res.error, "error");
      setItems((xs) => [...xs, ...res.data.items.filter((p) => !xs.some((x) => x.id === p.id))]);
      setCursor(res.data.nextCursor);
    });

  return (
    <>
      <div className="masonry columns-1 sm:columns-2 xl:columns-3">
        {items.map((p) =>
          p.quote ? (
            <article key={p.id} aria-label={`Annotation from ${p.quote.book.title} by ${p.author.displayName}`} style={{ rotate: `${((hash(p.id) % 5) - 2) * 0.2}deg` }}>
              <AnnotationCard quote={p.quote} showAuthor linkBook={showBook} href={`/quotes/${p.quote.id}`} className="pb-3" />
              <div className="-mt-px border border-t-0 border-line bg-card px-3 sm:px-4">
                <PostActions post={p} />
              </div>
            </article>
          ) : null,
        )}
      </div>
      {cursor && (
        <div className="mt-8 flex justify-center">
          <Button variant="paper" onClick={more} disabled={pending}>
            {pending ? "Turning pages…" : "Load more"}
          </Button>
        </div>
      )}
    </>
  );
}
