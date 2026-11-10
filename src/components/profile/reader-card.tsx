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

export function ReaderCard({ profile, className, why, match }: { profile: Profile; className?: string; why?: string[]; match?: number }) {
  return (
    <div className={cn("paper flex flex-col overflow-hidden", className)}>
      <div className={cn("h-14", ACCENT_BG[profile.accent])} aria-hidden />
      <div className="-mt-8 flex flex-1 flex-col items-center px-4 pb-4 text-center">
        <Link href={`/u/${profile.username}`}><Avatar profile={profile} size="lg" className="ring-4 ring-card" /></Link>
        <Link href={`/u/${profile.username}`} className="mt-2 font-serif text-lg leading-tight hover:text-burgundy">{profile.displayName}</Link>
        <p className="meta normal-case tracking-normal">@{profile.username}</p>
        {match != null && (
          <p className="mt-1 font-serif text-2xl leading-none text-burgundy" aria-label={`${match} percent match`}>
            {match}<span className="text-base">%</span>
          </p>
        )}
        {why?.length ? (
          // Why they match, from what you both share publicly.
          <ul className="mt-2 flex-1 space-y-0.5 text-xs text-ink-soft">
            {why.map((w) => <li key={w}>{w}</li>)}
          </ul>
        ) : (
          <p className="mt-2 line-clamp-3 flex-1 text-xs text-ink-soft">{profile.bio}</p>
        )}
        {!why?.length && profile.favouriteGenres.length > 0 && <p className="hand mt-2 text-lg text-burgundy">{profile.favouriteGenres.slice(0, 2).join(" & ")}</p>}
        <FollowButton userId={profile.id} name={profile.displayName} className="mt-3" />
      </div>
    </div>
  );
}
