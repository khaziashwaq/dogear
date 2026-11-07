"use client";

import { useEffect, useRef, useState } from "react";
import { JACKET_PALETTES, jacketColours } from "@/lib/jacket";
import { authorLine, cn, hash } from "@/lib/utils";

const PALETTES = JACKET_PALETTES;

/** The typeset-jacket colours for a book — shared with the shelf spine so a coverless book matches front and side. */
export const jacketPalette = jacketColours;

type Size = "xs" | "sm" | "md" | "lg" | "xl" | "fill";
const widths: Record<Size, string> = {
  xs: "w-10",
  sm: "w-14",
  md: "w-24",
  lg: "w-36",
  xl: "w-48 sm:w-60",
  fill: "w-full",
};

function sized(url: string, size: Size) {
  return size === "xs" || size === "sm" ? url.replace(/-L\.jpg/, "-M.jpg") : url;
}

/**
 * A book jacket. Uses the real cover when one loads; otherwise typesets a
 * jacket from the title so missing covers still look intentional.
 */
export function BookCover({
  title,
  authors,
  coverUrl,
  size = "md",
  className,
  priority,
  tilt = 0,
  bare = false,
}: {
  title: string;
  authors: string[];
  coverUrl: string | null;
  size?: Size;
  className?: string;
  priority?: boolean;
  tilt?: number;
  /** Fill the parent exactly (no aspect ratio, width or shadow) — for PhysicalBook, which sizes and lights the book itself. */
  bare?: boolean;
}) {
  const [failed, setFailed] = useState(!coverUrl);
  const img = useRef<HTMLImageElement>(null);
  // An SSR'd <img> can fail before hydration attaches onError — check on mount.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth < 20) setFailed(true);
  }, []);
  const h = hash(title + authors.join());
  const p = PALETTES[h % PALETTES.length];
  const pattern = h % 4;
  const small = size === "xs" || size === "sm";

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-[1px]",
        bare ? "size-full" : ["aspect-[2/3] shadow-[var(--shadow-book)]", widths[size]],
        className,
      )}
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
    >
      {!failed && coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={img}
          src={sized(coverUrl, size)}
          alt={`Cover of ${title}`}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailed(true)}
          onLoad={(e) => {
            if ((e.currentTarget as HTMLImageElement).naturalWidth < 20) setFailed(true);
          }}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col" style={{ background: p.bg, color: p.fg }} role="img" aria-label={`${title} by ${authorLine(authors)}`}>
          {pattern === 0 && <div className="absolute inset-x-0 top-[14%] h-px opacity-60" style={{ background: p.fg }} />}
          {pattern === 0 && <div className="absolute inset-x-0 top-[16%] h-px opacity-60" style={{ background: p.fg }} />}
          {pattern === 1 && <div className="absolute -bottom-[20%] -right-[25%] aspect-square w-[85%] rounded-full opacity-30" style={{ background: p.accent }} />}
          {pattern === 2 && (
            <div className="absolute inset-[7%] border opacity-50" style={{ borderColor: p.fg }} />
          )}
          {pattern === 3 && (
            <div className="absolute inset-x-0 bottom-0 h-[38%] opacity-25" style={{ background: `repeating-linear-gradient(135deg, ${p.accent} 0 2px, transparent 2px 9px)` }} />
          )}
          <div className={cn("relative flex flex-1 flex-col justify-between", small ? "p-1.5" : "p-[12%]")}>
            <p className={cn("font-serif leading-[1.05]", small ? "line-clamp-4 text-[0.5rem]" : size === "md" ? "line-clamp-5 text-sm" : "line-clamp-5 text-xl")}>
              {title}
            </p>
            {!small && (
              <p className="font-mono text-[0.55rem] uppercase tracking-[0.14em] opacity-80" style={{ fontSize: size === "md" ? "0.5rem" : undefined }}>
                {authorLine(authors)}
              </p>
            )}
          </div>
        </div>
      )}
      {/* spine shading */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[7%] bg-gradient-to-r from-black/25 via-white/10 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/10" />
    </div>
  );
}
