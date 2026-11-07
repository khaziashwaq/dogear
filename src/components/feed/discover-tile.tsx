import Link from "next/link";
import { BookshelfRow } from "@/components/book/bookshelf";
import { ListCard } from "@/components/list/list-card";
import { Avatar } from "@/components/profile/avatar";
import { QuoteCard } from "@/components/quote/quote-card";
import { Stars } from "@/components/ui/stars";
import type { Post } from "@/lib/types";
import { excerpt, hash } from "@/lib/utils";

/** Compact, visual tiles for the Pinterest-style masonry on Discover. */
export function DiscoverTile({ post }: { post: Post }) {
  const p = post.kind === "repost" && post.repostOf ? post.repostOf : post;
  if (p.kind === "quote" && p.quote) {
    return (
      <Link href={`/post/${p.id}`} className="block transition-transform hover:-translate-y-1" style={{ rotate: `${(hash(p.id) % 3) - 1}deg` }}>
        <QuoteCard quote={p.quote} linkBook={false} />
      </Link>
    );
  }
  if (p.kind === "list" && p.list) return <ListCard list={p.list} />;
  if (p.kind === "review" && p.review) {
    const r = p.review;
    const tall = hash(p.id) % 2 === 0;
    return (
      <Link href={`/post/${p.id}`} className="paper dogear group block overflow-hidden transition-transform hover:-translate-y-1">
        {tall && (
          <div className="flex justify-center bg-paper-deep pt-2">
            <BookshelfRow decorative hoverParent layout="ledge" size="md" items={[{ key: r.book.id, book: r.book }]} />
          </div>
        )}
        <div className="p-4">
          {!tall && <p className="font-serif text-lg leading-tight">{r.book.title}</p>}
          <Stars value={r.rating} className="mt-1" />
          {r.title && <p className="mt-2 font-serif text-xl italic leading-tight group-hover:text-burgundy">{r.title}</p>}
          <p className={r.containsSpoilers ? "mt-2 text-sm italic text-ink-faint" : "mt-2 text-sm text-ink-soft"}>
            {r.containsSpoilers ? "Contains spoilers — tap to read." : excerpt(r.body, tall ? 120 : 200)}
          </p>
          <p className="mt-3 flex items-center gap-2 text-xs"><Avatar profile={r.author} size="xs" />{r.author.displayName}</p>
        </div>
      </Link>
    );
  }
  if ((p.kind === "finished" || p.kind === "started" || p.kind === "recommendation") && p.book) {
    return (
      <Link href={`/post/${p.id}`} className="block border border-line bg-sage/25 p-4 transition-transform hover:-translate-y-1">
        <div className="flex items-center gap-3">
          <BookshelfRow decorative hoverParent layout="ledge" size="sm" className="shrink-0" items={[{ key: p.book.id ?? p.book.title, book: p.book }]} />
          <div className="min-w-0">
            <p className="hand text-xl leading-none text-burgundy">{p.kind === "finished" ? "just finished" : p.kind === "started" ? "just started" : "recommends"}</p>
            <p className="mt-1 font-serif text-lg leading-tight">{p.book.title}</p>
            <p className="meta normal-case tracking-normal">@{p.author.username}</p>
          </div>
        </div>
        {p.body && <p className="hand mt-3 text-xl leading-tight">{excerpt(p.body, 140)}</p>}
      </Link>
    );
  }
  return null;
}
