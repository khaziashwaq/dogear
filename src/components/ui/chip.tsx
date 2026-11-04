import Link from "next/link";
import { cn } from "@/lib/utils";

const tones = {
  paper: "border-line-strong bg-card text-ink hover:border-ink",
  sage: "border-sage-deep/40 bg-sage/35 text-ink hover:bg-sage/55",
  rose: "border-rose-deep/40 bg-rose/35 text-ink hover:bg-rose/55",
  butter: "border-butter-deep/50 bg-butter/50 text-ink hover:bg-butter/80",
  ink: "border-ink bg-ink text-paper",
};
export type ChipTone = keyof typeof tones;

export function chipClass(tone: ChipTone = "paper", active = false, className?: string) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.8125rem] leading-tight transition-colors",
    active ? tones.ink : tones[tone],
    className,
  );
}

export function Chip({ href, tone = "paper", active, className, children }: { href?: string; tone?: ChipTone; active?: boolean; className?: string; children: React.ReactNode }) {
  if (href) return <Link href={href} className={chipClass(tone, active, className)}>{children}</Link>;
  return <span className={chipClass(tone, active, className)}>{children}</span>;
}

export const GENRE_TONES: ChipTone[] = ["sage", "rose", "butter", "paper"];
