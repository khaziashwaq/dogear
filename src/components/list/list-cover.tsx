import { BookshelfRow } from "@/components/book/bookshelf";
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

/** Books on a little wall shelf against a coloured board — each list's visual identity. */
export function ListCover({ style, books, imageUrl, className, size = "md" }: { style: ListCoverStyle; books: SavedBook[]; imageUrl?: string | null; className?: string; size?: "sm" | "md" | "lg" }) {
  const shown = books.slice(0, size === "sm" ? 3 : 5);
  return (
    <div className={cn("relative flex items-end justify-center overflow-hidden", BG[style], size === "lg" ? "h-80 sm:h-[26rem]" : size === "md" ? "h-60" : "h-36", className)}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover opacity-90" loading="lazy" />
      ) : null}
      {style === "collage" && !imageUrl && (
        <div aria-hidden className="absolute inset-0 opacity-40" style={{ background: "repeating-linear-gradient(90deg, transparent 0 22px, rgb(116 63 72 / .18) 22px 23px)" }} />
      )}
      {shown.length === 0 ? (
        <p className={cn("hand relative mb-[12%] text-2xl", style === "ink" || style === "burgundy" ? "text-paper/80" : "text-ink-soft")}>an empty shelf, for now</p>
      ) : (
        // A little wall shelf on the board. Decorative: the card around it is the link.
        <BookshelfRow
          decorative
          layout="fit"
          align="center"
          size={size === "lg" ? "lg" : size === "md" ? "sm" : "xs"}
          className="relative"
          items={shown.map((b) => ({ key: b.id, book: b }))}
          fitCount={size === "sm" ? 3 : size === "md" ? 4 : 5}
        />
      )}
    </div>
  );
}
