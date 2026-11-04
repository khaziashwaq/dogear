import { BookCover } from "@/components/book/book-cover";
import type { ListCoverStyle, SavedBook } from "@/lib/types";
import { cn } from "@/lib/utils";

const BG: Record<ListCoverStyle, string> = {
  rose: "bg-rose/60",
  sage: "bg-sage/60",
  butter: "bg-butter",
  burgundy: "bg-burgundy",
  ink: "bg-ink",
  collage: "bg-paper-shade",
};

/** A fanned stack of covers on a coloured board — each list's visual identity. */
export function ListCover({ style, books, imageUrl, className, size = "md" }: { style: ListCoverStyle; books: SavedBook[]; imageUrl?: string | null; className?: string; size?: "sm" | "md" | "lg" }) {
  const shown = books.slice(0, size === "sm" ? 3 : 5);
  const coverSize = size === "lg" ? "lg" : size === "md" ? "md" : "sm";
  return (
    <div className={cn("relative flex items-end justify-center overflow-hidden", BG[style], size === "lg" ? "h-64 sm:h-80" : size === "md" ? "h-44" : "h-28", className)}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover opacity-90" loading="lazy" />
      ) : null}
      {style === "collage" && !imageUrl && (
        <div aria-hidden className="absolute inset-0 opacity-40" style={{ background: "repeating-linear-gradient(90deg, transparent 0 22px, rgb(116 63 72 / .18) 22px 23px)" }} />
      )}
      <div className="relative flex translate-y-[18%] items-end">
        {shown.length === 0 ? (
          <p className={cn("hand mb-[22%] text-2xl", style === "ink" || style === "burgundy" ? "text-paper/80" : "text-ink-soft")}>an empty shelf, for now</p>
        ) : (
          shown.map((b, i) => {
            const mid = (shown.length - 1) / 2;
            return (
              <div key={b.id} className="-mx-3 first:ml-0 last:mr-0" style={{ transform: `rotate(${(i - mid) * 6}deg) translateY(${Math.abs(i - mid) * 8}px)`, zIndex: 10 - Math.abs(Math.round(i - mid)) }}>
                <BookCover title={b.title} authors={b.authors} coverUrl={b.coverUrl} size={coverSize} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
