import type { Metadata } from "next";
import Link from "next/link";
import { acceptInviteAction } from "@/app/actions/invites";
import { Avatar } from "@/components/profile/avatar";
import { Button, buttonClass } from "@/components/ui/button";
import { getStore } from "@/lib/auth";

export const metadata: Metadata = { title: "You're invited", robots: { index: false } };

export default async function InvitePage({ params }: PageProps<"/invite/[code]">) {
  const { code } = await params;
  const store = await getStore();
  const invite = /^[A-Za-z0-9_-]{12,40}$/.test(code) ? await store.invitePreview(code) : null;

  if (!invite || !invite.valid) {
    return (
      <div className="paper dogear relative w-full max-w-md px-6 py-8 text-center sm:px-9">
        <h1 className="text-3xl">This invite has closed</h1>
        <p className="mt-2 text-sm text-ink-soft">The link has expired or been used up. You can still join on your own.</p>
        <Link href="/login" className={buttonClass("ink", "lg", "mt-6")}>Join dogear.</Link>
      </div>
    );
  }
  const who = invite.inviter.displayName || invite.inviter.username || "A reader";
  return (
    <div className="paper dogear relative w-full max-w-md px-6 py-9 text-center sm:px-10">
      <div className="tape -top-3 left-1/2 -translate-x-1/2 -rotate-2" aria-hidden />
      <Avatar profile={{ displayName: who, username: invite.inviter.username, avatarUrl: invite.inviter.avatarUrl }} size="lg" className="mx-auto" />
      <h1 className="mt-4 text-4xl leading-tight">{who} saved you a seat</h1>
      <p className="hand mt-2 text-2xl text-ink-soft">
        {invite.inviter.favouriteGenres.length ? `they read ${invite.inviter.favouriteGenres.slice(0, 2).join(" & ")}` : "come and fold some pages"}
      </p>
      <p className="mt-4 text-sm text-ink-soft">
        dogear. is a place to keep your reading life: shelves, a diary, reviews and the lines you underline. You&rsquo;ll follow {who.split(" ")[0]} when you join.
      </p>
      <form action={acceptInviteAction} className="mt-7">
        <input type="hidden" name="code" value={code} />
        <Button type="submit" size="lg" className="w-full">Join with Google</Button>
      </form>
    </div>
  );
}
