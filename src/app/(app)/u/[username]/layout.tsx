import { Globe, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/profile/avatar";
import { FollowButton } from "@/components/profile/follow-button";
import { ReaderMenu } from "@/components/profile/reader-menu";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { ButtonLink } from "@/components/ui/button";
import { Sparkle } from "@/components/ui/doodles";
import { getStore, getViewer } from "@/lib/auth";
import { lookupProfile } from "@/lib/profile-lookup";
import type { Accent, ProfileMotif } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCENT: Record<Accent, { band: string; text: string; ink: string }> = {
  burgundy: { band: "bg-burgundy", text: "text-burgundy", ink: "text-paper" },
  sage: { band: "bg-sage", text: "text-sage-deep", ink: "text-ink" },
  rose: { band: "bg-rose", text: "text-rose-deep", ink: "text-ink" },
  butter: { band: "bg-butter", text: "text-burgundy", ink: "text-ink" },
  ink: { band: "bg-ink", text: "text-ink", ink: "text-paper" },
};

function Motif({ motif }: { motif: ProfileMotif }) {
  if (motif === "none") return null;
  const style: Record<Exclude<ProfileMotif, "none">, React.CSSProperties> = {
    dogear: { backgroundImage: "linear-gradient(225deg, rgb(245 240 231 / .55) 0 18px, transparent 18px)", backgroundSize: "64px 64px" },
    stars: { backgroundImage: "radial-gradient(circle, rgb(245 240 231 / .55) 1.2px, transparent 1.6px)", backgroundSize: "22px 22px" },
    botanical: { backgroundImage: "radial-gradient(ellipse 6px 14px at 50% 50%, rgb(245 240 231 / .35) 98%, transparent 100%)", backgroundSize: "36px 36px" },
    stripes: { backgroundImage: "repeating-linear-gradient(90deg, rgb(245 240 231 / .25) 0 10px, transparent 10px 26px)" },
  };
  return <div aria-hidden className="absolute inset-0" style={style[motif]} />;
}

export async function generateMetadata({ params }: LayoutProps<"/u/[username]">) {
  const p = await lookupProfile((await params).username);
  return p ? { title: `${p.displayName} (@${p.username})`, description: p.bio } : { title: "Reader not found" };
}

export default async function ProfileLayout({ params, children }: LayoutProps<"/u/[username]">) {
  const profile = await lookupProfile((await params).username);
  if (!profile || !profile.username) notFound();
  const [store, viewer] = await Promise.all([getStore(), getViewer()]);
  const own = viewer?.id === profile.id;
  const [compat, summary, rel] = await Promise.all([
    viewer && !own ? store.compatibility(profile.id) : null,
    store.getShelfSummary(profile.id),
    viewer && !own ? store.relationship(profile.id) : null,
  ]);
  const a = ACCENT[profile.accent];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="relative">
        <div className={cn("relative h-36 overflow-hidden sm:h-48", a.band)}>
          {profile.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.coverUrl} alt="" className="size-full object-cover" />
          ) : (
            <Motif motif={profile.motif} />
          )}
          <p className={cn("hand absolute bottom-3 right-4 hidden max-w-xs rotate-[-3deg] text-right text-2xl sm:block", a.ink)}>
            {profile.favouriteGenres.slice(0, 3).join(" · ")}
          </p>
        </div>
        <div className="relative px-1 sm:px-6">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-4 sm:-mt-16">
            <Avatar profile={profile} size="xl" className="ring-4 ring-paper" />
            <div className="flex items-center gap-2 pb-1">
              {own ? (
                <ButtonLink href="/settings" variant="paper" size="sm">Edit profile</ButtonLink>
              ) : (
                <>
                  {!rel?.blocked && <FollowButton userId={profile.id} name={profile.displayName} size="md" />}
                  {rel && <ReaderMenu userId={profile.id} name={profile.displayName} initial={rel} />}
                </>
              )}
            </div>
          </div>
          <div className="mt-3 grid gap-6 sm:grid-cols-[1fr_auto]">
            <div>
              <h1 className="text-4xl leading-none sm:text-5xl">{profile.displayName}</h1>
              <p className="meta mt-1 normal-case tracking-normal">@{profile.username}{profile.pronouns ? ` · ${profile.pronouns}` : ""}</p>
              {profile.bio && <p className="mt-3 max-w-xl text-[1.02rem] leading-relaxed">{profile.bio}</p>}
              <div className="meta mt-3 flex flex-wrap gap-x-4 gap-y-1 normal-case tracking-normal">
                {profile.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{profile.location}</span>}
                {profile.website && <a href={profile.website} target="_blank" rel="noreferrer nofollow" className="inline-flex items-center gap-1 hover:text-ink"><Globe className="size-3" />{profile.website.replace(/^https?:\/\//, "")}</a>}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <span><strong className="font-serif text-xl font-normal">{summary.counts.read}</strong> <span className="text-ink-soft">read</span></span>
                <Link href={`/u/${profile.username}/followers`} className="hover:text-burgundy"><strong className="font-serif text-xl font-normal">{profile.followersCount}</strong> <span className="text-ink-soft">followers</span></Link>
                <Link href={`/u/${profile.username}/following`} className="hover:text-burgundy"><strong className="font-serif text-xl font-normal">{profile.followingCount}</strong> <span className="text-ink-soft">following</span></Link>
              </div>
            </div>
            {compat && (
              <div className="relative w-full self-start border border-line-strong bg-card p-4 sm:w-56 sm:rotate-1" aria-label={`Reading compatibility ${compat.score} percent`}>
                <Sparkle className={cn("absolute -right-2 -top-2", a.text)} />
                <p className="meta">reading compatibility</p>
                <p className={cn("font-serif text-5xl leading-none", a.text)}>{compat.score}<span className="text-2xl">%</span></p>
                <div className="mt-2 h-1.5 rounded-full bg-paper-shade"><div className="h-full rounded-full bg-burgundy" style={{ width: `${compat.score}%` }} /></div>
                <p className="mt-2 text-xs text-ink-soft">
                  {compat.sharedBooks ? `${compat.sharedBooks} books in common` : "No books in common yet"}
                  {compat.sharedGenres.length ? ` · both love ${compat.sharedGenres.slice(0, 2).join(" & ")}` : ""}
                </p>
              </div>
            )}
          </div>
        </div>
      </header>
      {rel?.blocked && (
        <p role="status" className="mt-6 border border-line-strong bg-paper-deep px-4 py-3 text-sm text-ink-soft">
          You&rsquo;ve blocked {profile.displayName}. You won&rsquo;t see their posts, reviews or shelves, and they can&rsquo;t reach you.
        </p>
      )}
      <div className="mt-8"><ProfileTabs username={profile.username} /></div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
