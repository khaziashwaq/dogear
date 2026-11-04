"use client";

import { Bell, Bookmark, BookOpen, Compass, Home, NotebookPen, Search, Settings, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SidebarNav({ username, unread }: { username: string | null; unread: number }) {
  const path = usePathname();
  const items = [
    { href: "/home", label: "Home", icon: Home },
    { href: "/discover", label: "Discover", icon: Compass },
    { href: "/search", label: "Search", icon: Search },
    ...(username
      ? [
          { href: `/u/${username}/shelves`, label: "Shelves", icon: BookOpen },
          { href: "/diary", label: "Diary", icon: NotebookPen },
          { href: "/notifications", label: "Notifications", icon: Bell, badge: unread },
          { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
          { href: `/u/${username}`, label: "Profile", icon: User, exact: true },
          { href: "/settings", label: "Settings", icon: Settings },
        ]
      : []),
  ];
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {items.map(({ href, label, icon: Icon, badge, exact }) => {
        const active = exact ? path === href : path === href || path.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 px-3 py-2 text-[0.95rem] transition-colors",
              active ? "text-ink" : "text-ink-soft hover:text-ink",
            )}
          >
            {active && <span aria-hidden className="absolute inset-y-1 left-0 w-1 bg-burgundy" />}
            <Icon className={cn("size-[18px] transition-transform group-hover:-rotate-6", active && "text-burgundy")} strokeWidth={1.6} />
            <span className={cn(active && "font-serif text-lg leading-none")}>{label}</span>
            {badge ? (
              <span className="ml-auto min-w-5 rounded-full bg-burgundy px-1.5 text-center font-mono text-[0.65rem] leading-5 text-paper">{badge > 99 ? "99+" : badge}</span>
            ) : null}
          </Link>
        );
      })}
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
        {tab("/home", "Home", Home)}
        {tab("/discover", "Discover", Compass)}
        <div className="flex flex-1 items-center justify-center">
          <button type="button" onClick={onCreate} aria-label="Create" className="-mt-5 flex size-12 items-center justify-center rounded-full bg-burgundy text-2xl leading-none text-paper shadow-[2px_2px_0_var(--color-ink)] active:translate-y-px">
            +
          </button>
        </div>
        {username ? tab(`/u/${username}/shelves`, "Shelves", BookOpen) : tab("/search", "Search", Search)}
        {username ? tab(`/u/${username}`, "Me", User, true) : tab("/login", "Sign in", User)}
      </div>
    </nav>
  );
}
