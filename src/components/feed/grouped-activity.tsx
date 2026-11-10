"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BookshelfRow } from "@/components/book/bookshelf";
import { Avatar } from "@/components/profile/avatar";
import type { Post } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import { PostCard } from "./post-card";

const VERB = { started: "started", finished: "finished" } as const;

/**
 * Feed items that are just "X started / finished Y", several in a row by one reader, shown as
 * one card: "Margo finished 3 books", their spines on a ledge, expandable to the individual posts.
 */
export function GroupedActivity({ posts }: { posts: Post[] }) {
  const [open, setOpen] = useState(false);
  const first = posts[0];
  const who = first.author.displayName || first.author.username;
  const verb = VERB[first.kind as keyof typeof VERB];
  const books = posts.map((p) => p.book).filter((b): b is NonNullable<Post["book"]> => Boolean(b));
  const id = `group-${first.id}`;
  return (
    <article className="paper animate-rise p-5 sm:p-6" aria-label={`${who} ${verb} ${posts.length} books`}>
      <header className="flex items-start gap-3">
        <Link href={`/u/${first.author.username}`} className="shrink-0"><Avatar profile={first.author} size="sm" /></Link>
        <div className="min-w-0 flex-1 text-sm leading-snug">
          <p>
            <Link href={`/u/${first.author.username}`} className="font-medium hover:text-burgundy">{who}</Link>{" "}
            <span className="text-ink-soft">{verb} {posts.length} books</span>
          </p>
          <p className="meta mt-0.5 normal-case tracking-normal">{timeAgo(posts.at(-1)!.createdAt)} – {timeAgo(first.createdAt)}</p>
        </div>
      </header>
      <div className="mt-4">
        <BookshelfRow label={`Books ${who} ${verb}`} layout="ledge" size="sm" items={books.map((b, i) => ({ key: `${b.id}-${i}`, book: b }))} />
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="meta mt-3 inline-flex items-center gap-1 hover:text-ink"
      >
        {open ? "Hide the posts" : "Show each post"} <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div id={id} className="mt-4 space-y-4 border-l-2 border-line pl-4">
          {posts.map((p) => <PostCard key={p.id} post={p} nested />)}
        </div>
      )}
    </article>
  );
}
