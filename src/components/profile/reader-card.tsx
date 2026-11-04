import Link from "next/link";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";
import { FollowButton } from "./follow-button";

export function ReaderRow({ profile, note }: { profile: Profile; note?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Link href={`/u/${profile.username}`}><Avatar profile={profile} size="md" /></Link>
      <div className="min-w-0 flex-1">
        <Link href={`/u/${profile.username}`} className="block truncate text-sm font-medium hover:text-burgundy">{profile.displayName || profile.username}</Link>
        <p className="meta truncate normal-case tracking-normal">{note ?? `@${profile.username}`}</p>
      </div>
      <FollowButton userId={profile.id} name={profile.displayName} />
    </div>
  );
}

const ACCENT_BG = { burgundy: "bg-burgundy", sage: "bg-sage", rose: "bg-rose", butter: "bg-butter", ink: "bg-ink" } as const;

export function ReaderCard({ profile, className }: { profile: Profile; className?: string }) {
  return (
    <div className={cn("paper flex flex-col overflow-hidden", className)}>
      <div className={cn("h-14", ACCENT_BG[profile.accent])} aria-hidden />
      <div className="-mt-8 flex flex-1 flex-col items-center px-4 pb-4 text-center">
        <Link href={`/u/${profile.username}`}><Avatar profile={profile} size="lg" className="ring-4 ring-card" /></Link>
        <Link href={`/u/${profile.username}`} className="mt-2 font-serif text-lg leading-tight hover:text-burgundy">{profile.displayName}</Link>
        <p className="meta normal-case tracking-normal">@{profile.username}</p>
        <p className="mt-2 line-clamp-3 flex-1 text-xs text-ink-soft">{profile.bio}</p>
        {profile.favouriteGenres.length > 0 && <p className="hand mt-2 text-lg text-burgundy">{profile.favouriteGenres.slice(0, 2).join(" & ")}</p>}
        <FollowButton userId={profile.id} name={profile.displayName} className="mt-3" />
      </div>
    </div>
  );
}
