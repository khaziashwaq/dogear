"use client";

import { Activity, Bell, Bookmark, BookOpen, Compass, Highlighter, Home, Library, NotebookPen, Search, Settings, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SidebarNav({ username, unread, collapsed = false }: { username: string | null; unread: number; collapsed?: boolean }) {
  const path = usePathname();
  type Item = { href: string; label: string; icon: typeof Home; badge?: number; exact?: boolean };
  // The five places a reader lives; everything else is one step quieter below.
  const primary: Item[] = username
    ? [
        { href: "/home", label: "Home", icon: Home },
        { href: "/activity", label: "Activity", icon: Activity },
        { href: "/discover", label: "Discover", icon: Compass },
        { href: "/marginalia", label: "Marginalia", icon: Highlighter },
        { href: "/lists", label: "Lists", icon: Library },
        { href: `/u/${username}`, label: "Profile", icon: User, exact: true },
      ]
    : [
        { href: "/discover", label: "Discover", icon: Compass },
        { href: "/marginalia", label: "Marginalia", icon: Highlighter },
        { href: "/lists", label: "Lists", icon: Library },
        { href: "/search", label: "Search", icon: Search },
      ];
  const secondary: Item[] = username
    ? [
        { href: "/search", label: "Search", icon: Search },
        { href: `/u/${username}/shelves`, label: "All shelves", icon: BookOpen },
        { href: "/diary", label: "Diary", icon: NotebookPen },
        { href: "/notifications", label: "Notifications", icon: Bell, badge: unread },
        { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
        { href: "/settings", label: "Settings", icon: Settings },
      ]
    : [];
  const render = (items: Item[], quiet = false) =>
    items.map(({ href, label, icon: Icon, badge, exact }) => {
        const active = exact ? path === href : path === href || path.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? (badge ? `${label} (${badge} unread)` : label) : undefined}
            title={collapsed ? label : undefined}
            className={cn(
              "group relative flex items-center gap-3 transition-colors",
              collapsed ? "justify-center px-0" : "px-3",
              quiet ? "py-1.5 text-sm" : "py-2 text-[0.95rem]",
              active ? "text-ink" : "text-ink-soft hover:text-ink",
            )}
          >
            {active && <span aria-hidden className="absolute inset-y-1 left-0 w-1 bg-burgundy" />}
            <Icon className={cn("transition-transform group-hover:-rotate-6", quiet ? "size-4" : "size-[18px]", active && "text-burgundy")} strokeWidth={1.6} />
            {!collapsed && <span className={cn("whitespace-nowrap", active && !quiet && "font-serif text-lg leading-none", active && quiet && "font-medium")}>{label}</span>}
            {badge && collapsed ? (
              <span aria-hidden className="absolute right-2.5 top-1.5 size-2 rounded-full bg-burgundy" />
            ) : badge ? (
              <span className="ml-auto min-w-5 rounded-full bg-burgundy px-1.5 text-center font-mono text-[0.65rem] leading-5 text-paper">{badge > 99 ? "99+" : badge}</span>
            ) : null}
          </Link>
        );
      });
  return (
    <nav aria-label="Main" className="flex flex-col">
      <div className="flex flex-col gap-0.5">{render(primary)}</div>
      {secondary.length > 0 && <div className={cn("mt-5 flex flex-col gap-px border-t border-line pt-4", collapsed && "gap-1")}>{render(secondary, true)}</div>}
    </nav>
  );
}

export function BottomNav({ username, onCreate }: { username: string | null; onCreate: () => void }) {
  const path = usePathname();
  const tab = (href: string, label: string, Icon: typeof Home, exact = false) => {
    const active = exact ? path === href : path === href || path.startsWith(href + "/");
    return (
      <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.65rem]", active ? "text-burgundy" : "text-ink-soft")}>
        <Icon className="size-5" strokeWidth={active ? 2 : 1.6} />
        <span className="font-mono uppercase tracking-wider">{label}</span>
      </Link>
    );
  };
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="flex items-stretch">
        {username ? tab("/home", "Home", Home) : tab("/", "Home", Home, true)}
        {username ? tab("/activity", "Activity", Activity) : tab("/discover", "Discover", Compass)}
        <div className="flex flex-1 items-center justify-center">
          <button type="button" onClick={onCreate} aria-label="Create" className="-mt-5 flex size-12 items-center justify-center rounded-full bg-burgundy text-2xl leading-none text-paper shadow-[2px_2px_0_var(--color-ink)] active:translate-y-px">
            +
          </button>
        </div>
        {username ? tab("/discover", "Discover", Compass) : tab("/lists", "Lists", Library)}
        {username ? tab("/lists", "Lists", Library) : tab("/search", "Search", Search)}
        {username ? tab(`/u/${username}`, "Me", User, true) : tab("/login", "Sign in", User)}
      </div>
    </nav>
  );
}
