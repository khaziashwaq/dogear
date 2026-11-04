"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateProfileAction } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { chipClass } from "@/components/ui/chip";
import { ImageUpload } from "@/components/ui/image-upload";
import { useToast } from "@/components/ui/toast";
import type { Accent, Profile, ProfileMotif } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCENTS: { key: Accent; cls: string }[] = [
  { key: "burgundy", cls: "bg-burgundy" }, { key: "sage", cls: "bg-sage" }, { key: "rose", cls: "bg-rose" }, { key: "butter", cls: "bg-butter" }, { key: "ink", cls: "bg-ink" },
];
const MOTIFS: ProfileMotif[] = ["dogear", "stars", "botanical", "stripes", "none"];

export function SettingsForm({ profile, genres }: { profile: Profile; genres: string[] }) {
  const [f, setF] = useState({
    username: profile.username ?? "", displayName: profile.displayName, bio: profile.bio, pronouns: profile.pronouns ?? "", location: profile.location ?? "",
    website: profile.website ?? "", accent: profile.accent, motif: profile.motif, favouriteGenres: profile.favouriteGenres, favouriteAuthors: profile.favouriteAuthors,
    readingGoal: profile.readingGoal ? String(profile.readingGoal) : "", avatarUrl: profile.avatarUrl, coverUrl: profile.coverUrl,
  });
  const [authors, setAuthors] = useState(profile.favouriteAuthors.join(", "));
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <form
      className="space-y-10"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateProfileAction({
            ...f,
            favouriteAuthors: authors.split(",").map((a) => a.trim()).filter(Boolean).slice(0, 12),
            readingGoal: f.readingGoal ? Number(f.readingGoal) : null,
          });
          if (!res.ok) return toast(res.error, "error");
          toast("Profile saved");
          router.push(`/u/${res.data.username}`);
        });
      }}
    >
      <fieldset className="space-y-4">
        <legend className="mb-2 font-serif text-2xl">About you</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className="meta mb-1.5 block">Name</span><input className="field" value={f.displayName} onChange={(e) => set("displayName", e.target.value)} maxLength={60} required /></label>
          <label><span className="meta mb-1.5 block">Username</span><input className="field" value={f.username} onChange={(e) => set("username", e.target.value.toLowerCase())} maxLength={24} required pattern="[a-z0-9_.]{3,24}" /></label>
          <label><span className="meta mb-1.5 block">Pronouns</span><input className="field" value={f.pronouns} onChange={(e) => set("pronouns", e.target.value)} maxLength={30} /></label>
          <label><span className="meta mb-1.5 block">Location</span><input className="field" value={f.location} onChange={(e) => set("location", e.target.value)} maxLength={60} /></label>
        </div>
        <label className="block"><span className="meta mb-1.5 block">Bio</span><textarea className="field resize-none" rows={3} value={f.bio} onChange={(e) => set("bio", e.target.value)} maxLength={280} /><span className="meta mt-1 block text-right">{f.bio.length}/280</span></label>
        <label className="block"><span className="meta mb-1.5 block">Website</span><input className="field" type="url" value={f.website} onChange={(e) => set("website", e.target.value)} maxLength={200} placeholder="https://" /></label>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-serif text-2xl">Your corner</legend>
        <p className="text-sm text-ink-soft">Personalise your profile — always within the dogear. palette.</p>
        <div><p className="meta mb-2">Profile picture</p><ImageUpload kind="avatar" value={f.avatarUrl} onChange={(v) => set("avatarUrl", v)} label="Upload a photo" /></div>
        <div><p className="meta mb-2">Cover image</p><ImageUpload kind="cover" value={f.coverUrl} onChange={(v) => set("coverUrl", v)} label="Upload a cover" /></div>
        <div>
          <p className="meta mb-2">Accent colour</p>
          <div className="flex gap-2" role="radiogroup" aria-label="Accent colour">
            {ACCENTS.map((a) => (
              <button key={a.key} type="button" role="radio" aria-checked={f.accent === a.key} aria-label={a.key} onClick={() => set("accent", a.key)} className={cn("flex size-10 items-center justify-center rounded-full border-2", a.cls, f.accent === a.key ? "border-ink" : "border-transparent")}>
                {f.accent === a.key && <Check className={cn("size-4", a.key === "burgundy" || a.key === "ink" ? "text-paper" : "text-ink")} />}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="meta mb-2">Banner motif</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Banner motif">
            {MOTIFS.map((m) => <button key={m} type="button" role="radio" aria-checked={f.motif === m} onClick={() => set("motif", m)} className={chipClass("paper", f.motif === m)}>{m}</button>)}
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-serif text-2xl">Your taste</legend>
        <div className="flex flex-wrap gap-2">
          {genres.map((g) => {
            const on = f.favouriteGenres.includes(g);
            return <button key={g} type="button" aria-pressed={on} onClick={() => set("favouriteGenres", on ? f.favouriteGenres.filter((x) => x !== g) : [...f.favouriteGenres, g])} className={chipClass("sage", on)}>{g}</button>;
          })}
        </div>
        <label className="block"><span className="meta mb-1.5 block">Favourite authors (comma separated)</span><input className="field" value={authors} onChange={(e) => setAuthors(e.target.value)} /></label>
        <label className="flex items-center gap-3"><span className="meta">Yearly reading goal</span><input className="field w-24" inputMode="numeric" value={f.readingGoal} onChange={(e) => set("readingGoal", e.target.value.replace(/\D/g, "").slice(0, 4))} /></label>
      </fieldset>

      <div className="flex justify-end border-t border-line pt-5"><Button type="submit" size="lg" variant="burgundy" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button></div>
    </form>
  );
}
