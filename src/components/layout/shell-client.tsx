"use client";

import { Bell, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/profile/avatar";
import { buttonClass } from "@/components/ui/button";
import type { Profile } from "@/lib/types";
import { CreateMenu } from "./create-menu";
import { BottomNav, SidebarNav } from "./nav-links";

export function ShellClient({ viewer, unread, children }: { viewer: Profile | null; unread: number; children: React.ReactNode }) {
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const username = viewer?.username ?? null;

  return (
    <div className="mx-auto flex w-full max-w-[1320px]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line px-5 py-7 md:flex lg:w-64">
        <Logo href={viewer ? "/home" : "/"} />
        <p className="hand mt-1 text-lg text-burgundy">for people who annotate</p>
        <div className="mt-8 flex-1 overflow-y-auto">
          <SidebarNav username={username} unread={unread} />
        </div>
        {viewer ? (
          <div className="space-y-4">
            <button type="button" onClick={() => setCreating(true)} className={buttonClass("burgundy", "md", "w-full")}>
              + New
            </button>
            <Link href={`/u/${username}`} className="flex items-center gap-3 rounded-sm p-1 hover:bg-paper-deep">
              <Avatar profile={viewer} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm">{viewer.displayName || username}</span>
                <span className="meta block truncate normal-case tracking-normal">@{username}</span>
              </span>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            <Link href="/signup" className={buttonClass("burgundy", "md", "w-full")}>Join dogear.</Link>
            <Link href="/login" className={buttonClass("paper", "md", "w-full")}>Sign in</Link>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/95 px-4 py-3 backdrop-blur md:hidden">
          <Logo href={viewer ? "/home" : "/"} size="sm" />
          <div className="flex items-center gap-1">
            <Link href="/search" aria-label="Search" className="rounded-full p-2 text-ink-soft hover:text-ink"><Search className="size-5" strokeWidth={1.6} /></Link>
            {viewer ? (
              <Link href="/notifications" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`} className="relative rounded-full p-2 text-ink-soft hover:text-ink">
                <Bell className="size-5" strokeWidth={1.6} />
                {unread > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-burgundy" />}
              </Link>
            ) : (
              <Link href="/login" className={buttonClass("ink", "sm")}>Sign in</Link>
            )}
          </div>
        </header>
        <main id="main" className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-16 md:pt-8 lg:px-10">{children}</main>
      </div>

      <BottomNav username={username} onCreate={() => (viewer ? setCreating(true) : router.push("/signup"))} />
      <CreateMenu open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
