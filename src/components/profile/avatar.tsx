import { cn, hash, initials } from "@/lib/utils";
import type { Profile } from "@/lib/types";

const BG = ["bg-rose", "bg-sage", "bg-butter", "bg-burgundy text-paper", "bg-paper-shade"];
const sizes = { xs: "size-6 text-[0.6rem]", sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-16 text-xl", xl: "size-28 text-4xl sm:size-32" };

export function Avatar({ profile, size = "md", className }: { profile: Pick<Profile, "displayName" | "username" | "avatarUrl">; size?: keyof typeof sizes; className?: string }) {
  const name = profile.displayName || profile.username || "?";
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-serif ring-1 ring-ink/15", sizes[size], !profile.avatarUrl && BG[hash(name) % BG.length], className)}>
      {profile.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatarUrl} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </span>
  );
}
