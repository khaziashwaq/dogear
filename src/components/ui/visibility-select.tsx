"use client";

import { Globe, Lock, Users } from "lucide-react";
import type { Visibility } from "@/lib/types";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Visibility; label: string; icon: typeof Globe }[] = [
  { value: "public", label: "Everyone", icon: Globe },
  { value: "followers", label: "Followers", icon: Users },
  { value: "private", label: "Only me", icon: Lock },
];

export function VisibilitySelect({ value, onChange, compact }: { value: Visibility; onChange: (v: Visibility) => void; compact?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Who can see this" className="inline-flex border border-line-strong bg-card p-0.5">
      {OPTIONS.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors", value === v ? "bg-ink text-paper" : "text-ink-soft hover:text-ink")}
        >
          <Icon className="size-3.5" />
          <span className={cn(compact && "sr-only sm:not-sr-only")}>{label}</span>
        </button>
      ))}
    </div>
  );
}
