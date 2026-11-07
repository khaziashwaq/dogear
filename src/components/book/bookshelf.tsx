"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { bookHref } from "@/lib/book-ref";
import type { Book } from "@/lib/types";
import { authorLine, cn, hash } from "@/lib/utils";
import { BookCover, jacketPalette } from "./book-cover";
import { useSpineColour } from "./spine-colour";

/* ──────────────────────────────────────────────────────────────────────────
   The physical bookshelf — one visual language for every collection of books
   in dogear. Books stand spine-out on an oak plank, each its own height and
   thickness. Reach for one (hover, focus, or a first tap) and it slides forward
   and swings round on its spine to show you the cover, while its neighbours
   make a little room and a shelf label appears underneath.
   ────────────────────────────────────────────────────────────────────────── */

export type ShelfBook = Pick<Book, "id" | "slug" | "olWorkId" | "title" | "authors" | "coverUrl"> & { pageCount?: number | null };

export interface ShelfItem {
  key: string;
  book: ShelfBook;
  /** A little sticker on the spine: a rank, a favourite heart, reading progress. */
  mark?: ReactNode;
  /** Extra lines for the shelf label shown while the book is out (stars, progress…). */
  details?: ReactNode;
  /** Pinned to the cover: tape on a showcase book, for instance. */
  badge?: ReactNode;
  /** Defaults to the book page. */
  href?: string;
}

export type ShelfSize = "xs" | "sm" | "md" | "lg" | "xl";
/**
 * wrap   — as many rows of shelf as it takes (shelves, search, genre pages)
 * scroll — one long shelf that scrolls sideways (trending)
 * fit    — one shelf whose books shrink to fit its width (list boards, favourites)
 * ledge  — a short plank with room for one book to turn (a book inside a card)
 */
export type ShelfLayout = "wrap" | "scroll" | "fit" | "ledge";

// --book-max: tallest book · --plank: front-face thickness · --band: room under the plank for the shelf label
const SIZE: Record<ShelfSize, string> = {
  xs: "[--book-max:96px] [--plank:10px] [--band:2.75rem]",
  sm: "[--book-max:140px] [--plank:12px] [--band:3.5rem] sm:[--book-max:164px] sm:[--plank:14px]",
  md: "[--book-max:184px] [--plank:14px] [--band:3.75rem] sm:[--book-max:236px] sm:[--plank:18px]",
  lg: "[--book-max:216px] [--plank:16px] [--band:4rem] sm:[--book-max:280px] sm:[--plank:20px]",
  xl: "[--book-max:300px] [--plank:16px] [--band:1rem] sm:[--book-max:380px] sm:[--plank:20px]",
};
const COVER: Record<ShelfSize, "xs" | "sm" | "md" | "lg"> = { xs: "sm", sm: "md", md: "md", lg: "lg", xl: "lg" };
// How far the nearest and next-nearest neighbours move aside for a book that's out.
const SPREAD: Record<ShelfSize, [number, number]> = { xs: [3, 1], sm: [5, 2], md: [7, 3], lg: [9, 3], xl: [0, 0] };

const turn = { stiffness: 210, damping: 24, mass: 1 };
const lift = { stiffness: 320, damping: 26, mass: 0.9 };
const settle = { type: "spring", stiffness: 260, damping: 26 } as const;
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

type Anchor = "start" | "center" | "end";

/** Deterministic, natural variation per book — the same on server and client. */
function variation(key: string, pages?: number | null, thickness = 1) {
  const h = hash(key);
  const thick = thickness * (pages ? 0.11 + (Math.min(Math.max(pages, 80), 1100) / 1100) * 0.15 : 0.13 + ((h >>> 3) % 10) / 100);
  return {
    height: 0.84 + (h % 17) / 100, // 84–100% of the shelf's tallest book
    ratio: 0.64 + ((h >>> 7) % 7) / 100, // cover width : height
    thick, // spine width : height, from the page count where we know it
    gap: 1 + ((h >>> 11) % 4), // px between spines — snug, not regimented
    lean: (h >>> 15) % 9 === 0 ? ((h >>> 19) % 2 ? 0.8 : -0.8) : 0, // the odd book not quite straight
  };
}

function surname(authors: string[]) {
  const first = authors[0]?.trim();
  if (!first) return "";
  return first.split(/\s+/).pop() ?? first;
}

/**
 * Spine lettering as large as the spine allows: no wider than ~60% of its thickness, and small
 * enough that the whole title fits down the spine (about 55% of its height is left for it once the
 * bands and the author's name are in). Short titles get big; long ones shrink, then ellipsize at 10px.
 */
function titleSize(title: string) {
  const fit = Math.min(0.12, 1 / Math.max(title.length, 1));
  return `clamp(10px, min(calc(var(--T) * 0.6), calc(var(--H) * ${fit.toFixed(4)})), 19px)`;
}

/* ── Spine ───────────────────────────────────────────────────────────────── */

function Spine({ book, mark }: { book: ShelfBook; mark?: ReactNode }) {
  const sampled = useSpineColour(book.coverUrl);
  const fallback = jacketPalette(book.title, book.authors);
  const bg = sampled?.bg ?? fallback.bg;
  const fg = sampled?.fg ?? fallback.fg;
  return (
    <div
      aria-hidden
      className="absolute top-0 h-full overflow-hidden [backface-visibility:hidden]"
      style={{
        width: "var(--T)",
        left: "calc(var(--T) / -2)",
        transform: "rotateY(-90deg)",
        background: bg,
        color: fg,
        transition: `background-color 600ms ${ease}, color 600ms ${ease}`,
      }}
    >
      <div className="book-spine-shade absolute inset-0" />
      <div className="absolute inset-x-0 top-[5%] h-[4px] border-y border-current opacity-45" />
      <div className="absolute inset-x-0 bottom-[4.5%] h-px bg-current opacity-45" />
      <div className="relative flex h-full flex-col items-center gap-[5%] pb-[12%] pt-[13%]">
        <p
          className="min-h-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-serif leading-none [writing-mode:vertical-rl]"
          style={{ fontSize: titleSize(book.title) }}
        >
          {book.title}
        </p>
        {/* Long titles need the whole spine; the author is in the shelf label on hover. */}
        {book.title.length <= 18 && (
          <p className="shrink-0 whitespace-nowrap font-sans leading-none tracking-[0.04em] opacity-80 [writing-mode:vertical-rl]" style={{ fontSize: "clamp(8px, min(calc(var(--T) * 0.38), calc(var(--H) * 0.058)), 12px)" }}>
            {surname(book.authors)}
          </p>
        )}
        {mark && <div className="shrink-0">{mark}</div>}
      </div>
    </div>
  );
}

/** A small paper sticker for the spine — rank numbers, hearts, progress. */
export function SpineMark({ children, tone = "paper" }: { children: ReactNode; tone?: "paper" | "burgundy" }) {
  return (
    <span
      className={cn(
        "grid aspect-square place-items-center rounded-full font-serif leading-none shadow-[0_1px_1px_rgb(0_0_0/0.25)]",
        tone === "paper" ? "bg-card text-ink" : "bg-burgundy text-paper",
      )}
      style={{ width: "min(calc(var(--T) * 0.78), 1.6rem)", fontSize: "min(calc(var(--T) * 0.42), 0.85rem)" }}
    >
      {children}
    </span>
  );
}

/* ── PhysicalBook ────────────────────────────────────────────────────────── */

export function PhysicalBook({
  item,
  size,
  face,
  ledge,
  active,
  anchor,
  labelAnchor,
  offset,
  priority,
  decorative,
  label,
  thickness = 1,
  onActivate,
  onDeactivate,
}: {
  item: ShelfItem;
  /** Scale spine thickness (wider spines carry bigger, more legible lettering). */
  thickness?: number;
  size: ShelfSize;
  /** Which side faces out at rest. */
  face: "spine" | "cover";
  /** Reserve room in the slot for the turned cover. */
  ledge: boolean;
  active: boolean;
  /** Where the turned cover lines up with the slot, so it never leaves the shelf. */
  anchor: Anchor;
  labelAnchor: Anchor;
  /** px nudge when a neighbour is out. */
  offset: number;
  priority?: boolean;
  /** Purely visual (inside another link): no link of its own, hidden from assistive tech. */
  decorative?: boolean;
  /** Shelf label shown under the plank while the book is out. */
  label: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const { book } = item;
  const v = variation(item.key, book.pageCount, thickness);
  const reduce = useReducedMotion() ?? false;
  const spineOut = face === "spine";

  // ── motion ──
  const rest = spineOut ? 90 : 0;
  const angle = useSpring(rest, turn);
  const raised = useSpring(0, lift);
  const tx = useMotionValue(0);
  const ty = useMotionValue(0);
  const tiltX = useSpring(tx, { stiffness: 180, damping: 20 });
  const tiltY = useSpring(ty, { stiffness: 180, damping: 20 });

  useEffect(() => {
    const target = active ? (spineOut ? 14 : 0) : rest;
    if (reduce) {
      angle.jump(target);
      raised.jump(active ? 1 : 0);
    } else {
      angle.set(target);
      raised.set(active ? 1 : 0);
    }
    if (!active) {
      tx.set(0);
      ty.set(0);
    }
  }, [active, reduce, rest, spineOut, angle, raised, tx, ty]);

  const m = reduce ? 0 : 1;
  const rotateY = useTransform([angle, tiltX], ([a, t]: number[]) => a + t * 10 * m);
  const rotateX = useTransform(tiltY, (t) => -t * 5 * m);
  const y = useTransform(raised, (r) => `${-r * 6 * m}%`);
  const z = useTransform(raised, (r) => r * 26 * m);
  const scale = useTransform(raised, (r) => 1 + r * 0.03 * m);
  const glare = useTransform(tiltX, [-1, 1], ["10%", "90%"]);
  const castOpacity = useTransform(raised, [0, 1], [0.22, 0.5]);
  const castY = useTransform(raised, (r) => 2 + r * 12 * m);
  const contactOpacity = useTransform(raised, [0, 1], [0.6, 0.3]);

  const boxEl = useRef<HTMLDivElement>(null);
  const track = (e: ReactPointerEvent) => {
    if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    const r = boxEl.current?.getBoundingClientRect();
    if (!r) return;
    tx.set(Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1)));
    ty.set(Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1)));
  };

  // A short hover intent, so sweeping the pointer along a shelf doesn't spin every book.
  const intent = useRef<number | undefined>(undefined);
  const pointer = useRef<string>("mouse");
  useEffect(() => () => window.clearTimeout(intent.current), []);
  const handlers = {
    onPointerEnter: (e: ReactPointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      window.clearTimeout(intent.current);
      intent.current = window.setTimeout(onActivate, 70);
    },
    onPointerMove: track,
    onPointerLeave: (e: ReactPointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      window.clearTimeout(intent.current);
      onDeactivate();
    },
    onPointerDown: (e: ReactPointerEvent) => {
      pointer.current = e.pointerType;
    },
    // Touch has no hover: the first tap takes the book out to look at, a second tap opens it.
    onClick: (e: ReactMouseEvent) => {
      if (pointer.current === "touch" && !active) {
        e.preventDefault();
        onActivate();
      }
    },
    onFocus: (e: FocusEvent<HTMLElement>) => {
      if (e.currentTarget.matches(":focus-visible")) onActivate();
    },
    onBlur: () => onDeactivate(),
  };

  // ── geometry (CSS, so it follows the shelf's responsive and fitted sizes) ──
  const roomy = ledge || !spineOut;
  const vars = {
    "--H": `calc(var(--book-h) * ${v.height})`,
    "--W": `calc(var(--H) * ${v.ratio})`,
    "--T": `calc(var(--H) * ${v.thick})`,
    "--g": `${!spineOut ? 7 : roomy ? 10 : v.gap}px`,
    "--S": roomy ? "calc(var(--W) + var(--g) * 2)" : "calc(var(--T) + var(--g))",
    // the spine's hinge (the box's left edge) within the slot
    "--L": !spineOut ? "var(--g)" : ledge ? "calc(var(--S) / 2)" : "calc(var(--g) + var(--T) / 2)",
    width: "var(--S)",
    height: "var(--shelf-row)",
  } as CSSProperties;

  const shift =
    !spineOut || !active
      ? "0px"
      : // At either end of a shelf the cover lines up with the end — inset a little, because a book
        // pulled forward (more so a thick one, whose cover sits further out) renders slightly larger
        // than its box, and the shelf clips anything past its edge.
        anchor === "start"
        ? "calc(var(--W) * 0.06 + var(--T) * 0.12 + 4px - var(--L))"
        : anchor === "end"
          ? "calc(var(--S) - var(--L) - var(--W) * 1.06 - var(--T) * 0.12 - 4px)"
          : "calc(var(--S) / 2 - var(--L) - var(--W) / 2)";
  // Footprint on the plank: the spine at rest, the whole cover once turned.
  const turned = active || !spineOut;
  const foot = turned ? { left: "var(--L)", width: "var(--W)" } : { left: "calc(var(--L) - var(--T) / 2)", width: "var(--T)" };
  const boxTop = "calc(var(--shelf-base) - var(--plank) * 0.3 - var(--H))";
  const palette = jacketPalette(book.title, book.authors);
  const footTransition = `left 520ms ${ease}, width 520ms ${ease}`;

  // What the pointer can touch. The 3D box and its wrappers are cover-wide even when only the spine
  // shows, so they ignore the pointer; this flat, untransformed zone matches the spine at rest and grows
  // to the turned cover's resting place while the book is out (so a book mid-turn never "loses" the pointer).
  // The spine's own zone always stays live: a book at a shelf end slides its cover inward, and if the
  // pointer sat on the part of the spine the cover no longer covers, losing it would put the book back,
  // re-reveal the spine under the pointer, and flicker in a loop.
  const spineHit = { left: "calc(var(--L) - var(--T) / 2)", width: "var(--T)", top: boxTop, height: "var(--H)" };
  const coverHit = turned && spineOut
    ? { left: `calc(var(--L) + ${shift})`, width: "var(--W)", top: `calc(${boxTop} - var(--H) * 0.06)`, height: "calc(var(--H) * 1.06)" }
    : null;
  const hit = turned && !spineOut
    ? { left: "var(--L)", width: "var(--W)", top: `calc(${boxTop} - var(--H) * 0.06)`, height: "calc(var(--H) * 1.06)" }
    : spineHit;

  const body = (
    <>
      <span aria-hidden data-book-hit className="pointer-events-auto absolute z-[1] cursor-pointer" style={hit} />
      {coverHit && <span aria-hidden data-book-hit className="pointer-events-auto absolute z-[1] cursor-pointer" style={coverHit} />}
      <motion.div className="absolute inset-0 [transform-style:preserve-3d]" animate={{ x: reduce ? 0 : offset }} transition={settle}>
        <div className="absolute inset-0 [transform-style:preserve-3d]" style={{ translate: `${shift} 0`, transition: `translate 520ms ${ease}` }}>
          {/* contact shadow on the plank, and the softer one cast on the wall */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute h-[7px] rounded-[50%] bg-[radial-gradient(closest-side,rgb(40_22_10/0.8),transparent)]"
            style={{ ...foot, top: "calc(var(--shelf-base) - var(--plank) * 0.3 - 4px)", opacity: contactOpacity, transition: footTransition }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute bg-[rgb(46_28_16)] blur-[8px]"
            style={{ ...foot, top: boxTop, height: "var(--H)", opacity: castOpacity, y: castY, x: 4, transition: footTransition }}
          />
          <motion.div
            className="absolute origin-bottom [transform-style:preserve-3d]"
            style={{ left: "var(--L)", top: boxTop, width: "var(--W)", height: "var(--H)", y, z, scale, rotate: v.lean }}
          >
            <motion.div ref={boxEl} data-book-box className="relative size-full [transform-style:preserve-3d]" style={{ rotateY, rotateX, originX: 0, originY: 1 }}>
              {/* back board */}
              <div
                aria-hidden
                className="absolute inset-0 rounded-[2px] [backface-visibility:hidden]"
                style={{ transform: "rotateY(180deg) translateZ(calc(var(--T) / 2))", background: palette.bg, filter: "brightness(0.7)" }}
              />
              {/* pages on the fore-edge */}
              <div
                aria-hidden
                className="book-fore-edge absolute bottom-[1%] top-[1.5%] [backface-visibility:hidden]"
                style={{ width: "var(--T)", left: "calc(var(--W) - var(--T) / 2)", transform: "rotateY(90deg)" }}
              />
              <Spine book={book} mark={item.mark} />
              {/* cover */}
              <div className="absolute inset-0 [backface-visibility:hidden]" style={{ transform: "translateZ(calc(var(--T) / 2))" }}>
                <BookCover title={book.title} authors={book.authors} coverUrl={book.coverUrl} size={COVER[size]} priority={priority} bare className="rounded-[1px_2px_2px_1px]" />
                <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[6%] w-px bg-black/25 shadow-[1px_0_0_rgb(255_255_255/0.2)]" />
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_35%,rgb(255_255_255/0.18)_50%,transparent_65%)] bg-[length:250%_100%] mix-blend-soft-light"
                  style={{ backgroundPositionX: glare, opacity: raised }}
                />
                {item.badge}
              </div>
              {!decorative && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-[3px] rounded-[3px] opacity-0 ring-2 ring-burgundy group-focus-visible/book:opacity-100"
                  style={{ transform: "translateZ(calc(var(--T) / 2 + 1px))" }}
                />
              )}
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {label && active && (
        <motion.div
          aria-hidden
          initial={reduce ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: reduce ? 0 : 0.08 }}
          className={cn(
            "pointer-events-none absolute z-10 w-max min-w-36 max-w-60 border border-line bg-card px-3 py-2 shadow-[var(--shadow-paper)]",
            labelAnchor === "start" && "left-0",
            labelAnchor === "end" && "right-0",
            labelAnchor === "center" && "left-1/2 -translate-x-1/2",
          )}
          style={{ top: "calc(var(--shelf-base) + var(--plank) + 0.55rem)" }}
        >
          <p className="line-clamp-2 font-serif text-base leading-tight">{book.title}</p>
          <p className="meta mt-0.5 truncate normal-case tracking-normal">{authorLine(book.authors)}</p>
          {item.details && <div className="mt-1">{item.details}</div>}
        </motion.div>
      )}
    </>
  );

  const slotClass =
    "group/book pointer-events-none relative block shrink-0 outline-none [-webkit-tap-highlight-color:transparent] [perspective-origin:50%_35%] [perspective:1100px] [transform-style:preserve-3d]";
  if (decorative) {
    return (
      <div className={slotClass} style={vars} {...handlers}>
        {body}
      </div>
    );
  }
  return (
    <Link href={item.href ?? bookHref(book)} className={slotClass} style={vars} aria-label={`${book.title} by ${authorLine(book.authors)}`} draggable={false} {...handlers}>
      {body}
    </Link>
  );
}

/* ── BookshelfRow ────────────────────────────────────────────────────────── */

export function BookshelfRow({
  items,
  size = "md",
  layout = "wrap",
  face = "spine",
  decorative = false,
  labels = !decorative,
  align = "start",
  priorityCount = 0,
  fitCount,
  hoverParent = false,
  reserveBand = false,
  wrapItem,
  className,
  trackClassName,
  bookMax,
  band,
  thickness,
  label,
}: {
  items: ShelfItem[];
  size?: ShelfSize;
  layout?: ShelfLayout;
  face?: "spine" | "cover";
  decorative?: boolean;
  /** Show a shelf label under the plank for the book that's out. */
  labels?: boolean;
  align?: "start" | "center";
  /** Eager-load the first n covers. */
  priorityCount?: number;
  /** `fit` only: size books as if there were at least this many. */
  fitCount?: number;
  /** Take the book out when the surrounding card is hovered or focused (single-book shelves in cards). */
  hoverParent?: boolean;
  /** Keep the band under the plank even without hover labels (for a caller's own captions). */
  reserveBand?: boolean;
  /** Wrap each book — drag handles, captions, menus. The wrapper fills the book's slot. */
  wrapItem?: (item: ShelfItem, index: number, book: ReactNode) => ReactNode;
  className?: string;
  /** Classes for the shelf itself — e.g. inner padding the planks should run under. */
  trackClassName?: string;
  /** Override the tallest book (any CSS length, e.g. a viewport-based clamp()). */
  bookMax?: string;
  /** Override the room under the plank (labels, menus). */
  band?: string;
  /** Scale every spine's thickness, e.g. 1.4 where books are small and titles must stay legible. */
  thickness?: number;
  /** Accessible name for the shelf. */
  label?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [place, setPlace] = useState<{ row: Set<number>; anchor: Anchor; labelAnchor: Anchor }>({ row: new Set(), anchor: "center", labelAnchor: "center" });
  const trackEl = useRef<HTMLDivElement>(null);
  const slots = useRef<(HTMLElement | null)[]>([]);

  const activate = useCallback((i: number) => {
    const el = slots.current[i];
    const trackW = trackEl.current?.scrollWidth ?? 0;
    if (el) {
      // Only books on the same plank make room — and a book near either end turns inward so it stays on the shelf.
      const row = new Set(slots.current.flatMap((s, j) => (s && s.offsetTop === el.offsetTop ? [j] : [])));
      const centre = el.offsetLeft + el.offsetWidth / 2;
      const coverW = (el.querySelector("[data-book-box]") as HTMLElement | null)?.offsetWidth ?? 0;
      const pick = (half: number): Anchor => (centre - half < 0 ? "start" : centre + half > trackW ? "end" : "center");
      setPlace({ row, anchor: pick(coverW * 0.56 + 8), labelAnchor: pick(124) });
    }
    setActive(i);
  }, []);
  const deactivate = useCallback((i: number) => setActive((a) => (a === i ? null : a)), []);

  // Touch: tapping anywhere off the shelf puts the book back.
  useEffect(() => {
    if (active == null) return;
    const away = (e: PointerEvent) => {
      if (!trackEl.current?.contains(e.target as Node)) setActive(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [active]);

  // Single-book shelves inside a card turn with the card.
  useEffect(() => {
    if (!hoverParent) return;
    const host = trackEl.current?.closest("a");
    if (!host) return;
    const on = () => activate(0);
    const off = () => deactivate(0);
    host.addEventListener("pointerenter", on);
    host.addEventListener("pointerleave", off);
    host.addEventListener("focus", on);
    host.addEventListener("blur", off);
    return () => {
      host.removeEventListener("pointerenter", on);
      host.removeEventListener("pointerleave", off);
      host.removeEventListener("focus", on);
      host.removeEventListener("blur", off);
    };
  }, [hoverParent, activate, deactivate]);

  const [near, far] = SPREAD[size];
  const offsetFor = (i: number) => {
    if (active == null || i === active || !place.row.has(i)) return 0;
    const d = i - active;
    return Math.sign(d) * (Math.abs(d) === 1 ? near : Math.abs(d) === 2 ? far : 0);
  };

  const n = Math.max(items.length, fitCount ?? 1, 1);
  const fitted = face === "spine" ? "calc((100cqi - var(--n) * 6px) / (var(--n) * 0.27))" : "calc((100cqi - var(--n) * 20px) / (var(--n) * 0.71))";
  const trackStyle = {
    ...(bookMax ? { "--book-max": bookMax } : {}),
    ...(band ? { "--band": band } : {}),
    "--n": n,
    "--book-h": layout === "fit" ? `min(var(--book-max), ${fitted})` : "var(--book-max)",
    // the plank's front face starts here; each row is this tall
    "--shelf-base": "calc(var(--book-h) * 1.14 + var(--plank) * 0.3)",
    "--shelf-row": `calc(var(--shelf-base) + var(--plank) + ${labels || reserveBand ? "var(--band)" : "1rem"})`,
    // an empty shelf is still a shelf (and still somewhere to drop a book)
    minHeight: "var(--shelf-row)",
  } as CSSProperties;

  const ledge = layout === "ledge";
  const trackNode = (
    <div
      ref={trackEl}
      role={decorative ? undefined : "list"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      style={trackStyle}
      className={cn(
        // The 3D boxes are wider than a spine; clip sideways so they never widen the page (turned covers are anchored inside).
        "relative flex",
        layout !== "scroll" && "[overflow-x:clip]",
        layout === "wrap" && "w-full flex-wrap",
        layout === "scroll" && "w-max min-w-full",
        layout === "fit" && "w-full",
        ledge && "w-max px-[calc(var(--book-h)*0.08)]",
        align === "center" && "justify-center",
        trackClassName,
      )}
    >
      <div aria-hidden className="shelf-planks" />
      {items.map((item, i) => (
        <div
          key={item.key}
          ref={(el) => {
            slots.current[i] = el;
          }}
          role={decorative ? undefined : "listitem"}
          className={cn("relative", active === i ? "z-20" : "z-[1]")}
        >
          {(() => {
            const node = (
              <PhysicalBook
                item={item}
                size={size}
                face={face}
                ledge={ledge}
                active={active === i}
                // A lone book on a ledge or a centred shelf turns about its own middle; anywhere else it
                // follows the shelf's ends like any other book (a single book at the start of a long shelf).
                anchor={items.length === 1 && (ledge || align === "center") ? "center" : place.anchor}
                labelAnchor={place.labelAnchor}
                offset={offsetFor(i)}
                priority={i < priorityCount}
                decorative={decorative}
                label={labels}
                thickness={thickness}
                onActivate={() => activate(i)}
                onDeactivate={() => deactivate(i)}
              />
            );
            return wrapItem ? wrapItem(item, i, node) : node;
          })()}
        </div>
      ))}
    </div>
  );

  return (
    <div className={cn(SIZE[size], layout === "fit" && "@container w-full", ledge && "w-max max-w-full", layout !== "scroll" && className)}>
      {layout === "scroll" ? <div className={cn("scrollbar-none overflow-x-auto overscroll-x-contain", className)}>{trackNode}</div> : trackNode}
    </div>
  );
}

/* ── BookshelfSection ────────────────────────────────────────────────────── */

export function BookshelfSection({
  title,
  count,
  action,
  id,
  className,
  headingHidden,
  ...row
}: ComponentProps<typeof BookshelfRow> & { title: ReactNode; count?: number; action?: ReactNode; id?: string; headingHidden?: boolean }) {
  return (
    <section aria-labelledby={id} className={className}>
      <div className={cn("mb-1 flex items-baseline justify-between gap-3", headingHidden && "sr-only")}>
        <h3 id={id} className="font-serif text-2xl leading-tight">
          {title}
          {count != null && <span className="ml-2 font-sans text-sm text-ink-faint">{count}</span>}
        </h3>
        {action}
      </div>
      <BookshelfRow {...row} />
    </section>
  );
}
