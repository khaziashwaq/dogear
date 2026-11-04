import Link from "next/link";
import { cn } from "@/lib/utils";

/** The dogear. wordmark: serif lowercase with a burgundy full stop and a folded corner. */
export function Logo({ className, href = "/", size = "md" }: { className?: string; href?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const text = { sm: "text-xl", md: "text-2xl", lg: "text-4xl", xl: "text-6xl sm:text-7xl" }[size];
  return (
    <Link href={href} className={cn("group inline-flex items-baseline font-serif leading-none tracking-tight text-ink", text, className)} aria-label="dogear. home">
      <span className="relative">
        dogear
        <span
          aria-hidden
          className="absolute -right-1.5 -top-1 size-2.5 origin-bottom-left bg-rose transition-transform duration-300 group-hover:-rotate-12"
          style={{ clipPath: "polygon(0 0, 100% 100%, 0 100%)" }}
        />
      </span>
      <span className="text-burgundy">.</span>
    </Link>
  );
}
