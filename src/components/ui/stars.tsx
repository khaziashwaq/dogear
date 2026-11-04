"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

function StarShape({ fill, className }: { fill: 0 | 0.5 | 1; className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id={id}>
          <stop offset={fill === 1 ? "100%" : fill === 0.5 ? "50%" : "0%"} stopColor="currentColor" />
          <stop offset={fill === 1 ? "100%" : fill === 0.5 ? "50%" : "0%"} stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.8l2.7 5.9 6.4.7-4.8 4.3 1.4 6.3L12 16.8 6.3 20l1.4-6.3L2.9 9.4l6.4-.7z"
        fill={`url(#${id})`}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Read-only rating, 0.5 – 5. */
export function Stars({ value, size = "sm", className }: { value: number | null; size?: "xs" | "sm" | "md"; className?: string }) {
  if (value == null) return null;
  const px = size === "xs" ? "size-3" : size === "sm" ? "size-3.5" : "size-5";
  return (
    <span className={cn("inline-flex items-center text-burgundy", className)} role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarShape key={i} className={px} fill={value >= i ? 1 : value >= i - 0.5 ? 0.5 : 0} />
      ))}
    </span>
  );
}

/**
 * Half-star rating input. Mouse: click left/right half of a star.
 * Keyboard: it's a slider — arrows change by 0.5, Home/End, Delete clears.
 */
export function StarInput({
  value,
  onChange,
  size = "md",
  label = "Your rating",
  disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  size?: "md" | "lg";
  label?: string;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  const px = size === "lg" ? "size-8" : "size-6";
  const set = (v: number | null) => !disabled && onChange(v === value ? null : v);

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={value ?? 0}
      aria-valuetext={value ? `${value} stars` : "Not rated"}
      aria-disabled={disabled}
      className={cn("inline-flex items-center rounded-sm text-burgundy outline-offset-4", disabled && "opacity-50")}
      onMouseLeave={() => setHover(null)}
      onKeyDown={(e) => {
        if (disabled) return;
        const cur = value ?? 0;
        if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(5, cur + 0.5)); }
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onChange(cur - 0.5 <= 0 ? null : cur - 0.5); }
        if (e.key === "Home") { e.preventDefault(); onChange(0.5); }
        if (e.key === "End") { e.preventDefault(); onChange(5); }
        if (e.key === "Delete" || e.key === "Backspace" || e.key === "0") { e.preventDefault(); onChange(null); }
      }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="relative inline-block">
          <StarShape className={cn(px, "transition-transform", hover != null && hover >= i - 0.5 && "scale-110")} fill={shown >= i ? 1 : shown >= i - 0.5 ? 0.5 : 0} />
          <button type="button" tabIndex={-1} aria-hidden className="absolute inset-y-0 left-0 w-1/2" onMouseEnter={() => setHover(i - 0.5)} onClick={() => set(i - 0.5)} />
          <button type="button" tabIndex={-1} aria-hidden className="absolute inset-y-0 right-0 w-1/2" onMouseEnter={() => setHover(i)} onClick={() => set(i)} />
        </span>
      ))}
      <span className="meta ml-2 w-8 tabular-nums">{value ? value.toFixed(1) : "—"}</span>
    </div>
  );
}
