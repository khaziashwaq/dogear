"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** A tiny open book turning its pages. Decorative: pair it with text for screen readers. */
export function PageFlip({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  return (
    <span aria-hidden className={cn("page-flip", size === "sm" && "page-flip-sm", className)}>
      <span />
      <span />
      <span />
    </span>
  );
}

// Open Library often takes several seconds; say so as the wait grows instead of spinning silently.
const STAGES: [after: number, text: string][] = [
  [0, "Searching the library"],
  [2500, "Checking Open Library's shelves"],
  [6000, "Open Library is slow today. Still looking"],
];

function useStage(active: boolean) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timers = STAGES.slice(1).map(([after], i) => setTimeout(() => setStage(i + 1), after));
    return () => {
      timers.forEach(clearTimeout);
      setStage(0);
    };
  }, [active]);
  return STAGES[stage][1];
}

/**
 * The waiting state of a book search, as list items: a status line with the page-flip and, optionally,
 * cover-shaped placeholder rows so the list doesn't jump when results land.
 */
export function SearchingRows({ active, placeholders = false, className }: { active: boolean; placeholders?: boolean; className?: string }) {
  const text = useStage(active);
  if (!active) return null;
  return (
    <>
      <li className={cn("flex items-center justify-center gap-3 py-3 text-sm text-ink-soft", className)} role="status" aria-live="polite">
        <PageFlip />
        <span className="animate-[fade-in_0.3s_ease]" key={text}>{text}…</span>
      </li>
      {placeholders &&
        [0.92, 0.7, 0.82].map((w, i) => (
          <li key={i} aria-hidden className="flex items-center gap-3 px-1 py-2.5" style={{ opacity: 1 - i * 0.25 }}>
            <span className="skeleton h-12 w-8 shrink-0" />
            <span className="flex-1 space-y-2">
              <span className="skeleton block h-4" style={{ width: `${w * 70}%` }} />
              <span className="skeleton block h-3" style={{ width: `${w * 40}%` }} />
            </span>
          </li>
        ))}
    </>
  );
}
