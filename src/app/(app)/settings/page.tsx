import type { Metadata } from "next";
import Link from "next/link";
import { resetDemoAction, signOutAction } from "@/app/actions/auth";
import { DeleteAccount, SafetyList } from "@/components/profile/account-controls";
import { InviteManager } from "@/components/profile/invite-manager";
import { env } from "@/lib/env";
import { SettingsForm } from "@/components/profile/settings-form";
import { Button, buttonClass } from "@/components/ui/button";
import { getStore, requireViewer } from "@/lib/auth";
import { GENRES } from "@/lib/data/seed/books";
import { isDemoMode } from "@/lib/env";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requireViewer("/settings");
  const store = await getStore();
  const [blocked, muted, invites] = await Promise.all([store.listBlocked(), store.listMuted(), store.listInvites()]);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-5xl leading-none">Settings<span className="text-burgundy">.</span></h1>
      <div className="paper mt-8 p-5 sm:p-8"><SettingsForm profile={viewer} genres={[...GENRES]} /></div>
      <section className="mt-10 flex flex-wrap items-center justify-between gap-4 border border-line-strong p-5">
        <div>
          <h2 className="text-xl">Account</h2>
          <p className="text-sm text-ink-soft">{!isDemoMode ? "Signed in with Supabase Auth." : "Demo mode: data lives on this server only."}</p>
        </div>
        <div className="flex gap-2">
          {isDemoMode && (
            <form action={resetDemoAction}><Button type="submit" variant="ghost">Reset demo data</Button></form>
          )}
          <form action={signOutAction}><Button type="submit" variant="outline">Sign out</Button></form>
        </div>
      </section>

      <section className="mt-6 border border-line-strong p-5" aria-labelledby="invite-h">
        <h2 id="invite-h" className="text-xl">Invite friends</h2>
        <p className="mb-4 text-sm text-ink-soft">Anyone who joins with your link starts out following you. You&rsquo;ll see how many joined, not who.</p>
        <InviteManager initial={invites} origin={env.siteUrl} />
      </section>

      <section className="mt-6 flex flex-wrap items-center justify-between gap-4 border border-line-strong p-5" aria-labelledby="import-h">
        <div className="max-w-md">
          <h2 id="import-h" className="text-xl">Bring your Goodreads shelves</h2>
          <p className="text-sm text-ink-soft">Import your Goodreads export: shelves, ratings and dates read. You&rsquo;ll see everything before it&rsquo;s saved.</p>
        </div>
        <Link href="/import" className={buttonClass("paper", "md")}>Import from Goodreads</Link>
      </section>

      <section className="mt-6 border border-line-strong p-5" aria-labelledby="safety-h">
        <h2 id="safety-h" className="text-xl">Blocked and muted</h2>
        <p className="text-sm text-ink-soft">Muted readers disappear from your feeds. Blocked readers can&rsquo;t see or reach you, and you won&rsquo;t see them.</p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="meta mb-1">blocked</h3>
            <SafetyList people={blocked} kind="blocked" />
          </div>
          <div>
            <h3 className="meta mb-1">muted</h3>
            <SafetyList people={muted} kind="muted" />
          </div>
        </div>
      </section>

      <section className="mt-6 flex flex-wrap items-center justify-between gap-4 border border-line-strong p-5" aria-labelledby="data-h">
        <div className="max-w-md">
          <h2 id="data-h" className="text-xl">Your data</h2>
          <p className="text-sm text-ink-soft">Download everything you&rsquo;ve made here as a JSON file, or delete your account and all of it for good.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* A file download, not a page: a plain link, so the browser saves it. */}
          <a href="/api/export" download className={buttonClass("paper", "md")}>Download my data</a>
          {viewer.username && <DeleteAccount username={viewer.username} />}
        </div>
      </section>
    </div>
  );
}
