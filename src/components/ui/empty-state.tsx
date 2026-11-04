import { cn } from "@/lib/utils";
import { Sparkle, Squiggle } from "./doodles";

/** A warm, hand-made empty state. Always offer a next step via `action`. */
export function EmptyState({
  title,
  body,
  action,
  className,
  note,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
  note?: string;
}) {
  return (
    <div className={cn("paper dogear relative mx-auto flex max-w-md flex-col items-center px-8 py-12 text-center", className)}>
      <div className="tape -top-3 left-1/2 -translate-x-1/2 -rotate-2" />
      <svg viewBox="0 0 120 80" className="mb-5 h-20 w-28 text-ink-soft" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 18c16-6 34-6 50 4v50c-16-10-34-10-50-4z" fill="var(--color-butter)" fillOpacity=".5" />
        <path d="M110 18c-16-6-34-6-50 4v50c16-10 34-10 50-4z" fill="var(--color-rose)" fillOpacity=".35" />
        <path d="M18 30c10-3 22-2 32 3M18 40c10-3 22-2 32 3M70 33c10-5 22-6 32-3M70 43c10-5 22-6 32-3" />
        <path d="M96 18v-10l6 5 6-5v10" stroke="var(--color-burgundy)" />
      </svg>
      <Sparkle className="absolute right-8 top-8 text-burgundy/60" />
      <h3 className="text-2xl">{title}</h3>
      {body && <p className="mt-2 text-sm text-ink-soft">{body}</p>}
      {note && <p className="hand mt-3 text-xl text-burgundy">{note}</p>}
      <Squiggle className="mt-4 text-sage-deep" />
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
