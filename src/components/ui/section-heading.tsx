import Link from "next/link";
import { cn } from "@/lib/utils";

export function SectionHeading({ kicker, title, href, action, className }: { kicker?: string; title: string; href?: string; action?: string; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4 border-b border-line pb-2", className)}>
      <div>
        {kicker && <p className="meta text-burgundy">{kicker}</p>}
        <h2 className="text-2xl leading-tight sm:text-3xl">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="meta shrink-0 text-ink hover:text-burgundy">{action ?? "See all"} →</Link>
      )}
    </div>
  );
}
