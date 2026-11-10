"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProfileTabs({ username }: { username: string }) {
  const path = usePathname();
  const base = `/u/${username}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/shelves`, label: "Shelves" },
    { href: `${base}/reviews`, label: "Reviews" },
    { href: `${base}/lists`, label: "Lists" },
    { href: `${base}/quotes`, label: "Marginalia" },
    { href: `${base}/recap`, label: "Yearbook" },
    { href: `${base}/stats`, label: "Stats" },
  ];
  return (
    <nav aria-label="Profile sections" className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {tabs.map((t) => {
        const active = t.href === base ? path === base : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cn("relative shrink-0 px-3 py-3 text-sm transition-colors", active ? "text-ink" : "text-ink-soft hover:text-ink")}>
            <span className={cn(active && "font-serif text-lg leading-none")}>{t.label}</span>
            {active && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-burgundy" />}
          </Link>
        );
      })}
    </nav>
  );
}
