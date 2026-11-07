"use client";

import { Bell, Bookmark, BookOpen, Highlighter, NotebookPen, PanelLeftClose, PanelLeftOpen, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/profile/avatar";
import { buttonClass } from "@/components/ui/button";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CreateMenu } from "./create-menu";
import { NAV_COOKIE } from "./nav-cookie";
import { BottomNav, SidebarNav } from "./nav-links";

export function ShellClient({ viewer, unread, navCollapsed = false, children }: { viewer: Profile | null; unread: number; navCollapsed?: boolean; children: React.ReactNode }) {
  const [creating, setCreating] = useState(false);
  const [collapsed, setCollapsed] = useState(navCollapsed);
  const toggle = () =>
    setCollapsed((c) => {
      document.cookie = `${NAV_COOKIE}=${c ? "open" : "collapsed"}; path=/; max-age=31536000; samesite=lax`;
      return !c;
    });
  // ⌘\ / Ctrl+\ toggles the sidebar, like a reading-app drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const router = useRouter();
  const username = viewer?.username ?? null;

  return (
    <div className="flex w-full">
      {/* Desktop sidebar — collapses to an icon rail */}
      <aside
        id="sidebar"
        data-collapsed={collapsed || undefined}
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line py-7 transition-[width,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:flex",
          collapsed ? "w-[4.25rem] px-2.5" : "w-60 px-5 lg:w-64",
        )}
      >
        <div className={cn("flex", collapsed ? "flex-col items-center gap-3" : "items-start justify-between gap-2")}>
          {collapsed ? (
            <Link href={viewer ? "/home" : "/"} aria-label="dogear. home" className="font-serif text-2xl leading-none">
              d<span className="text-burgundy">.</span>
            </Link>
          ) : (
            <div className="min-w-0">
              <Logo href={viewer ? "/home" : "/"} />
              <p className="hand mt-1 whitespace-nowrap text-lg text-burgundy">for people who annotate</p>
            </div>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-controls="sidebar"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={`${collapsed ? "Expand" : "Collapse"} sidebar (⌘\\)`}
            className={cn("shrink-0 rounded-sm p-1.5 text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink", !collapsed && "mt-1")}
          >
            {collapsed ? <PanelLeftOpen className="size-[18px]" strokeWidth={1.6} /> : <PanelLeftClose className="size-[18px]" strokeWidth={1.6} />}
          </button>
        </div>
        <div className={cn("flex-1 overflow-y-auto overflow-x-hidden", collapsed ? "mt-6" : "mt-8")}>
          <SidebarNav username={username} unread={unread} collapsed={collapsed} />
        </div>
        {viewer ? (
          <div className={cn("space-y-4", collapsed && "flex flex-col items-center")}>
            <button
              type="button"
              onClick={() => setCreating(true)}
              aria-label={collapsed ? "Create" : undefined}
              title={collapsed ? "Create" : undefined}
              className={buttonClass("burgundy", "md", collapsed ? "size-11 !p-0" : "w-full")}
            >
              {collapsed ? <Plus className="size-5" /> : "+ New"}
            </button>
            <Link
              href={`/u/${username}`}
              title={collapsed ? `${viewer.displayName || username}` : undefined}
              className={cn("flex items-center gap-3 rounded-sm p-1 hover:bg-paper-deep", collapsed && "justify-center")}
            >
              <Avatar profile={viewer} size="sm" />
              {!collapsed && (
                <span className="min-w-0">
                  <span className="block truncate text-sm">{viewer.displayName || username}</span>
                  <span className="meta block truncate normal-case tracking-normal">@{username}</span>
                </span>
              )}
            </Link>
          </div>
        ) : collapsed ? (
          <Link href="/login" title="Sign in" className={buttonClass("paper", "sm", "w-full !px-0")}>In</Link>
        ) : (
          <div className="space-y-2">
            <Link href="/login" className={buttonClass("burgundy", "md", "w-full")}>Join dogear.</Link>
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
            <Link href="/marginalia" aria-label="Marginalia" className="rounded-full p-2 text-ink-soft hover:text-ink"><Highlighter className="size-5" strokeWidth={1.6} /></Link>
            {viewer && (
              <>
                <Link href={`/u/${username}/shelves`} aria-label="All shelves" className="rounded-full p-2 text-ink-soft hover:text-ink"><BookOpen className="size-5" strokeWidth={1.6} /></Link>
                <Link href="/diary" aria-label="Diary" className="rounded-full p-2 text-ink-soft hover:text-ink"><NotebookPen className="size-5" strokeWidth={1.6} /></Link>
                <Link href="/bookmarks" aria-label="Bookmarks" className="rounded-full p-2 text-ink-soft hover:text-ink"><Bookmark className="size-5" strokeWidth={1.6} /></Link>
              </>
            )}
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
        <main id="main" className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-16 md:pt-8 lg:px-8">{children}</main>
      </div>

      <BottomNav username={username} onCreate={() => (viewer ? setCreating(true) : router.push("/login"))} />
      <CreateMenu open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
