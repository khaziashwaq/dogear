"use client";

import { Check, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { ShelfStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const MOVES: { key: ShelfStatus; label: string }[] = [
  { key: "read", label: "Read" },
  { key: "reading", label: "Reading" },
  { key: "want_to_read", label: "Want to read" },
  { key: "dnf", label: "Did not finish" },
];

/**
 * The no-drag way to move a book: a small menu under each book on the home
 * shelves. Rendered in a portal so a scrolling shelf can't clip it.
 */
export function ShelfMenu({ title, current, bookHref, onMove }: { title: string; current: ShelfStatus | null; bookHref: string; onMove: (to: ShelfStatus | null) => void }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const open = rect != null;

  const close = (refocus = true) => {
    setRect(null);
    if (refocus) button.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const away = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setRect(null);
    };
    const shut = () => setRect(null);
    document.addEventListener("pointerdown", away);
    window.addEventListener("scroll", shut, true);
    window.addEventListener("resize", shut);
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("scroll", shut, true);
      window.removeEventListener("resize", shut);
    };
  }, [open]);

  const keys = (e: KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  const width = 208;
  const left = rect ? Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8) : 0;
  const below = rect ? rect.bottom + 6 + 260 < window.innerHeight : true;

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`Move ${title}`}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={() => (open ? close() : setRect(button.current!.getBoundingClientRect()))}
        className="-mr-0.5 -mt-0.5 shrink-0 rounded-full p-1 text-ink-soft transition-colors hover:bg-paper-shade hover:text-ink aria-expanded:bg-ink aria-expanded:text-paper"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="menu"
            aria-label={`Move ${title}`}
            onKeyDown={keys}
            className="fixed z-[60] border border-line-strong bg-card py-1.5 shadow-[var(--shadow-lift)]"
            style={{ width, left, ...(below ? { top: rect!.bottom + 6 } : { bottom: window.innerHeight - rect!.top + 6 }) }}
          >
            <p className="truncate px-3 pb-1 pt-0.5 font-serif text-base italic text-ink-soft">{title}</p>
            {MOVES.map((m) => (
              <button
                key={m.key}
                type="button"
                role="menuitem"
                disabled={current === m.key}
                onClick={() => {
                  close();
                  onMove(m.key);
                }}
                className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-paper-deep focus-visible:bg-paper-deep focus-visible:outline-none disabled:cursor-default disabled:text-ink-faint disabled:hover:bg-transparent"
              >
                {current === m.key ? `On ${m.label}` : `Move to ${m.label}`}
                {current === m.key && <Check className="size-3.5" />}
              </button>
            ))}
            <div className="my-1 border-t border-line" />
            <Link role="menuitem" href={bookHref} className="block px-3 py-1.5 text-sm hover:bg-paper-deep focus-visible:bg-paper-deep focus-visible:outline-none">
              Open the book
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                onMove(null);
              }}
              className={cn("block w-full px-3 py-1.5 text-left text-sm text-burgundy hover:bg-paper-deep focus-visible:bg-paper-deep focus-visible:outline-none")}
            >
              Take off my shelves
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
