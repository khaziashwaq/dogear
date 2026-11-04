import { Lock, Users } from "lucide-react";
import Link from "next/link";
import type { ReadingList } from "@/lib/types";
import { cn, plural, tilt } from "@/lib/utils";
import { ListCover } from "./list-cover";

export function ListCard({ list, className, showOwner = true }: { list: ReadingList; className?: string; showOwner?: boolean }) {
  return (
    <Link href={`/lists/${list.id}`} className={cn("group paper block overflow-hidden transition-transform hover:-translate-y-1", className)} style={{ rotate: `${tilt(list.id, 0.8)}deg` }}>
      <ListCover style={list.coverStyle} books={list.preview} imageUrl={list.coverImageUrl} />
      <div className="relative border-t border-line bg-card p-4">
        <h3 className="text-xl leading-tight group-hover:text-burgundy">{list.title}</h3>
        <div className="meta mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{plural(list.bookCount, "book")}</span>
          {list.followersCount > 0 && <span className="inline-flex items-center gap-1"><Users className="size-3" />{list.followersCount}</span>}
          {list.visibility !== "public" && <span className="inline-flex items-center gap-1"><Lock className="size-3" />{list.visibility}</span>}
          {showOwner && <span className="normal-case tracking-normal">by @{list.owner.username}</span>}
        </div>
      </div>
    </Link>
  );
}
