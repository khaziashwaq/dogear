import type { Metadata } from "next";
import { resetDemoAction, signOutAction } from "@/app/actions/auth";
import { SettingsForm } from "@/components/profile/settings-form";
import { Button } from "@/components/ui/button";
import { requireViewer } from "@/lib/auth";
import { GENRES } from "@/lib/data/seed/books";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requireViewer("/settings");
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-5xl leading-none">Settings<span className="text-burgundy">.</span></h1>
      <div className="paper mt-8 p-5 sm:p-8"><SettingsForm profile={viewer} genres={[...GENRES]} /></div>
      <section className="mt-10 flex flex-wrap items-center justify-between gap-4 border border-line-strong p-5">
        <div>
          <h2 className="text-xl">Account</h2>
          <p className="text-sm text-ink-soft">{isSupabaseConfigured ? "Signed in with Supabase Auth." : "Demo mode: data lives on this server only."}</p>
        </div>
        <div className="flex gap-2">
          {!isSupabaseConfigured && (
            <form action={resetDemoAction}><Button type="submit" variant="ghost">Reset demo data</Button></form>
          )}
          <form action={signOutAction}><Button type="submit" variant="outline">Sign out</Button></form>
        </div>
      </section>
    </div>
  );
}
