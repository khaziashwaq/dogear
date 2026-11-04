// Small hand-drawn motifs used as scrapbook decoration. Purely decorative.
import { cn } from "@/lib/utils";

type P = { className?: string };

export const Sparkle = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={cn("size-5", className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M12 2.5c.6 4.8 2.7 7 7.5 7.5-4.8.6-6.9 2.7-7.5 7.5-.6-4.8-2.7-6.9-7.5-7.5 4.8-.5 6.9-2.7 7.5-7.5z" />
  </svg>
);

export const Squiggle = ({ className }: P) => (
  <svg viewBox="0 0 120 12" className={cn("h-3 w-28", className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M2 7c8-6 14 4 22-1s14-5 22 0 14 5 22 0 14-5 22 0 14 5 22-1" />
  </svg>
);

export const Arrow = ({ className }: P) => (
  <svg viewBox="0 0 80 40" className={cn("h-8 w-16", className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 30C20 8 44 4 70 14" />
    <path d="M60 6l11 8-12 5" />
  </svg>
);

export const Leaf = ({ className }: P) => (
  <svg viewBox="0 0 40 60" className={cn("h-12 w-8", className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <path d="M20 58V14" />
    <path d="M20 14C8 16 4 28 8 38c8-2 12-12 12-24zM20 22c12 2 16 14 12 24-8-2-12-12-12-24z" />
  </svg>
);

export const Circle = ({ className }: P) => (
  <svg viewBox="0 0 120 60" className={cn("absolute", className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M70 6C34 2 6 14 6 30s26 26 58 24 52-12 50-28C112 12 86 4 52 8" />
  </svg>
);

export const Underline = ({ className }: P) => (
  <svg viewBox="0 0 200 14" preserveAspectRatio="none" className={cn("absolute -bottom-1 left-0 h-3 w-full", className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M3 9c40-6 90-7 194-3" />
  </svg>
);

export const Bookmark = ({ className }: P) => (
  <svg viewBox="0 0 24 40" className={cn("h-10 w-6", className)} aria-hidden>
    <path d="M2 0h20v38l-10-8-10 8z" fill="currentColor" />
  </svg>
);
