"use client";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { motion, useReducedMotion } from "framer-motion";
import { MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState, useTransition, type ReactNode, type RefObject } from "react";
import { setShelfStatusAction, undoShelfMoveAction } from "@/app/actions/books";
import { BookCover } from "@/components/book/book-cover";
import { BookPicker } from "@/components/book/book-picker";
import { BookshelfRow, SpineMark } from "@/components/book/bookshelf";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { bookHref, bookRef } from "@/lib/book-ref";
import type { Book, ShelfMoveOptions, ShelfStatus, ShelfUndo, UserBook } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ShelfMenu } from "./shelf-menu";

/* ──────────────────────────────────────────────────────────────────────────
   The home bookcase: three shelves — Read, Reading, Want to read — in one oak
   case. Books move between them by drag and drop (press and hold on touch), or
   from the ⋯ menu under each book. Moves are optimistic and roll back if the
   server says no; the status lives on the reader's existing user_books row.
   ────────────────────────────────────────────────────────────────────────── */

export type HomeShelfKey = "read" | "reading" | "want_to_read";
type Shelves = Record<HomeShelfKey, UserBook[]>;

const SHELVES: { key: HomeShelfKey; label: string; tint: string }[] = [
  { key: "read", label: "Read", tint: "bg-rose/25" },
  { key: "reading", label: "Reading", tint: "bg-butter/45" },
  { key: "want_to_read", label: "Want to read", tint: "bg-sage/30" },
];
const LABEL: Record<ShelfStatus, string> = { read: "Read", reading: "Reading", want_to_read: "Want to read", dnf: "Did not finish" };

function isHome(s: ShelfStatus | null): s is HomeShelfKey {
  return s === "read" || s === "reading" || s === "want_to_read";
}

export function HomeShelves({ initial, allShelvesHref }: { initial: Shelves; allShelvesHref: string }) {
  const [shelves, setShelves] = useState<Shelves>(initial);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<UserBook | null>(null);
  const [over, setOver] = useState<HomeShelfKey | null>(null);
  const [arrived, setArrived] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [picking, setPicking] = useState(false);
  // Read → Reading could be a re-read or a slip of the hand; ask which before writing the diary.
  const [askReread, setAskReread] = useState<UserBook | null>(null);
  const [, start] = useTransition();
  const toast = useToast();
  const reduce = useReducedMotion();
  const justDropped = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Press and hold, so a quick swipe still scrolls the shelf or the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  const locate = useCallback(
    (bookId: string): [HomeShelfKey, UserBook] | null => {
      for (const { key } of SHELVES) {
        const ub = shelves[key].find((b) => b.bookId === bookId);
        if (ub) return [key, ub];
      }
      return null;
    },
    [shelves],
  );

  /** Move a book to a shelf (or off the home shelves). Optimistic, rolled back on failure. */
  const undo = useCallback(
    (record: ShelfUndo, title: string) =>
      start(async () => {
        const res = await undoShelfMoveAction(record);
        if (!res.ok) return toast(res.error, "error");
        setAnnouncement(`${title} put back`);
        toast(`${title} put back`);
      }),
    [toast],
  );

  const move = useCallback(
    (bookId: string, to: ShelfStatus | null, opts?: ShelfMoveOptions) => {
      const found = locate(bookId);
      if (!found || pending.has(bookId)) return;
      const [from, ub] = found;
      if (from === to) return;
      if (from === "read" && to === "reading" && !opts) {
        setAskReread(ub);
        return;
      }

      setShelves((s) => {
        const next = { ...s, [from]: s[from].filter((b) => b.bookId !== bookId) };
        // Never two copies of a book on the shelves.
        if (isHome(to)) next[to] = [{ ...ub, status: to }, ...s[to].filter((b) => b.bookId !== bookId)];
        return next;
      });
      setArrived(isHome(to) ? bookId : null);
      setPending((p) => new Set(p).add(bookId));
      const said = to ? `${ub.book.title} moved to ${LABEL[to]}` : `${ub.book.title} taken off your shelves`;
      setAnnouncement(said);

      start(async () => {
        const res = await setShelfStatusAction(bookRef(ub.book), to, opts);
        setPending((p) => {
          const n = new Set(p);
          n.delete(bookId);
          return n;
        });
        if (!res.ok) {
          // Put it back exactly where it was.
          setShelves((s) => {
            const next = { ...s };
            if (isHome(to)) next[to] = s[to].filter((b) => b.bookId !== bookId);
            const index = initialIndex(s[from], ub);
            const back = [...next[from].filter((b) => b.bookId !== bookId)];
            back.splice(index, 0, ub);
            next[from] = back;
            return next;
          });
          setAnnouncement(`Couldn't move ${ub.book.title}`);
          toast(res.error, "error");
          return;
        }
        // Keep the server's copy (dates started/finished are set there).
        const saved = res.data.userBook;
        if (saved && isHome(saved.status)) {
          setShelves((s) => ({ ...s, [saved.status as HomeShelfKey]: s[saved.status as HomeShelfKey].map((b) => (b.bookId === bookId ? { ...b, ...saved, book: b.book } : b)) }));
        }
        const record = res.data.undo;
        toast(
          to === "dnf" ? `${ub.book.title}: did not finish` : to ? `On your ${LABEL[to]} shelf` : "Taken off your shelves",
          "default",
          record ? { label: "Undo", onClick: () => undo(record, ub.book.title) } : undefined,
        );
      });
    },
    [locate, pending, toast, undo],
  );

  const onDragStart = (e: DragStartEvent) => {
    const found = locate(String(e.active.id));
    setDragging(found ? found[1] : null);
  };
  const onDragOver = (e: DragOverEvent) => setOver((e.over?.id as HomeShelfKey | undefined) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    justDropped.current = id;
    window.setTimeout(() => (justDropped.current = null), 60);
    setDragging(null);
    setOver(null);
    if (e.over) move(id, e.over.id as HomeShelfKey);
  };

  const add = (book: Book) => {
    setPicking(false);
    start(async () => {
      const res = await setShelfStatusAction(bookRef(book), "want_to_read");
      if (!res.ok) return toast(res.error, "error");
      const { userBook, book: saved } = res.data;
      if (!userBook) return;
      setShelves((s) => {
        const next: Shelves = { read: [], reading: [], want_to_read: [] };
        for (const { key } of SHELVES) next[key] = s[key].filter((b) => b.bookId !== saved.id);
        next.want_to_read = [{ ...userBook, book: saved }, ...next.want_to_read];
        return next;
      });
      setArrived(saved.id);
      const record = res.data.undo;
      toast(`${saved.title} is on your Want to read shelf`, "default", record ? { label: "Undo", onClick: () => undo(record, saved.title) } : undefined);
    });
  };

  const total = shelves.read.length + shelves.reading.length + shelves.want_to_read.length;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => (setDragging(null), setOver(null))}>
      <p aria-live="polite" className="sr-only">{announcement}</p>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-xs text-ink-soft sm:text-sm">
          <span className="hidden sm:inline">Drag a book to another shelf to move it,</span>
          <span className="sm:hidden">Press and hold a book to move it,</span> or use <MoreHorizontal className="inline size-4 align-[-3px]" aria-label="the more menu" /> under it.
        </p>
        <div className="flex items-baseline gap-4 text-sm">
          <Link href={allShelvesHref} className="link-underline hidden text-ink-soft hover:text-ink sm:inline">All shelves</Link>
          <button type="button" onClick={() => setPicking(true)} className="inline-flex items-center gap-1.5 text-burgundy hover:underline">
            <Plus className="size-4" /> Add a book
          </button>
        </div>
      </div>

      {/* the bookcase */}
      <div className="relative -mx-4 sm:mx-0">
        <div aria-hidden className="bookcase-cornice relative z-10 h-3 rounded-t-[3px] sm:-mx-3 sm:h-4" />
        <div className="relative flex">
          <div aria-hidden className="bookcase-wood w-2 shrink-0 sm:w-4" />
          <div className="min-w-0 flex-1 bg-paper-deep">
            {SHELVES.map((s) => (
              <ShelfCompartment
                key={s.key}
                shelf={s}
                books={shelves[s.key]}
                over={over === s.key && dragging?.status !== s.key}
                dragging={dragging}
                arrived={arrived}
                pending={pending}
                reduce={Boolean(reduce)}
                justDropped={justDropped}
                onMove={move}
                onAdd={() => setPicking(true)}
              />
            ))}
          </div>
          <div aria-hidden className="bookcase-wood w-2 shrink-0 sm:w-4" />
        </div>
        <div aria-hidden className="bookcase-cornice h-2.5 rounded-b-[3px] sm:-mx-3" />
      </div>

      {total === 0 && <p className="hand mt-4 text-center text-2xl text-ink-soft">an empty bookcase is a very hopeful thing</p>}

      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <div className="w-28 rotate-[-4deg] shadow-[12px_22px_30px_-12px_rgb(41_28_16/0.6)] sm:w-32">
            <BookCover title={dragging.book.title} authors={dragging.book.authors} coverUrl={dragging.book.coverUrl} size="md" />
          </div>
        ) : null}
      </DragOverlay>

      <BookPicker open={picking} onClose={() => setPicking(false)} onPick={add} title="Add a book to Want to read" />
      <Dialog
        open={askReread !== null}
        onClose={() => setAskReread(null)}
        title={askReread ? `Picking up ${askReread.book.title} again?` : "Picking it up again?"}
        description="It's on your Read shelf. Tell us which it is so your diary stays right."
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="flex-1"
            onClick={() => {
              const ub = askReread;
              setAskReread(null);
              if (ub) move(ub.bookId, "reading", { reread: true });
            }}
          >
            Yes, a re-read
          </Button>
          <Button
            variant="paper"
            className="flex-1"
            onClick={() => {
              const ub = askReread;
              setAskReread(null);
              if (ub) move(ub.bookId, "reading", { reread: false });
            }}
          >
            I hadn&rsquo;t finished it
          </Button>
        </div>
      </Dialog>
    </DndContext>
  );
}

function progress(ub: UserBook) {
  return ub.status === "reading" && ub.progressPages && ub.book.pageCount ? Math.min(100, Math.round((ub.progressPages / ub.book.pageCount) * 100)) : null;
}

function initialIndex(list: UserBook[], ub: UserBook) {
  // Roll back to roughly where it was: by when it was last shelved.
  const i = list.findIndex((b) => b.updatedAt < ub.updatedAt);
  return i === -1 ? list.length : i;
}

/* ── One shelf ───────────────────────────────────────────────────────────── */

function ShelfCompartment({
  shelf,
  books,
  over,
  dragging,
  arrived,
  pending,
  reduce,
  justDropped,
  onMove,
  onAdd,
}: {
  shelf: (typeof SHELVES)[number];
  books: UserBook[];
  over: boolean;
  dragging: UserBook | null;
  arrived: string | null;
  pending: Set<string>;
  reduce: boolean;
  justDropped: RefObject<string | null>;
  onMove: (bookId: string, to: ShelfStatus | null) => void;
  onAdd: () => void;
}) {
  const { setNodeRef } = useDroppable({ id: shelf.key });
  const headingId = `home-shelf-${shelf.key}`;
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={cn("bookcase-back relative flex transition-[background-color,box-shadow] duration-300", shelf.tint, over && "bg-butter/80 shadow-[inset_0_0_0_2px_var(--color-burgundy)]")}
    >
      {/* The shelf's label runs up its side, like the label on a spine — on every screen size. */}
      <header className="flex w-8 shrink-0 items-center justify-center border-r border-line md:w-12">
        <h2 id={headingId} className="rotate-180 font-serif text-lg leading-none [writing-mode:vertical-rl] md:text-2xl">
          {shelf.label}
          <span className="ml-1.5 align-middle font-mono text-[0.65rem] text-ink-soft md:text-xs">{books.length}</span>
        </h2>
      </header>

      <div className="relative min-w-0 flex-1">
        <BookshelfRow
          label={`${shelf.label} shelf`}
          layout="scroll"
          size="md"
          // No floating label on hover here: the spine carries the title, the sticker the progress.
          labels={false}
          reserveBand
          // Three shelves on one screen: books are sized from the visible height, less the page chrome
          // around the bookcase (--home-chrome, set by the page) and each shelf's plank and menu row.
          bookMax="clamp(96px, calc((100dvh - var(--home-chrome, 300px)) / 3.42 - 14px), 236px)"
          thickness={1.4}
          band="1.75rem"
          trackClassName="px-2 sm:px-4"
          items={books.map((ub) => {
            const pct = progress(ub);
            return {
              key: ub.bookId,
              book: ub.book,
              mark: pct != null ? <SpineMark>{pct}</SpineMark> : undefined,
            };
          })}
          wrapItem={(item, _i, node) => {
            const ub = books.find((b) => b.bookId === item.key)!;
            return (
              <DraggableBook
                ub={ub}
                from={shelf.key}
                isDragging={dragging?.bookId === ub.bookId}
                isPending={pending.has(ub.bookId)}
                arrived={arrived === ub.bookId}
                reduce={reduce}
                justDropped={justDropped}
                onMove={onMove}
              >
                {node}
              </DraggableBook>
            );
          }}
        />
        {books.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-12 top-0 flex items-center justify-center px-4 text-center">
            <div className="pointer-events-auto">
              <p className="hand text-xl text-ink-soft sm:text-2xl">{shelf.key === "want_to_read" ? "nothing waiting yet" : shelf.key === "reading" ? "nothing on the go" : "your finished books will live here"}</p>
              <p className="mt-1 text-sm text-ink-faint">
                Drag a book here{shelf.key === "want_to_read" ? (
                  <>
                    , or{" "}
                    <button type="button" onClick={onAdd} className="text-burgundy underline-offset-2 hover:underline">add one</button>
                  </>
                ) : null}
                .
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── A book you can pick up ──────────────────────────────────────────────── */

function DraggableBook({
  ub,
  from,
  isDragging,
  isPending,
  arrived,
  reduce,
  justDropped,
  onMove,
  children,
}: {
  ub: UserBook;
  from: HomeShelfKey;
  isDragging: boolean;
  isPending: boolean;
  arrived: boolean;
  reduce: boolean;
  justDropped: RefObject<string | null>;
  onMove: (bookId: string, to: ShelfStatus | null) => void;
  children: ReactNode;
}) {
  const { setNodeRef, listeners } = useDraggable({ id: ub.bookId, disabled: isPending, data: { from } });
  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      layout={!reduce}
      initial={arrived && !reduce ? { y: -36, rotate: -3, opacity: 0 } : false}
      animate={{ y: 0, rotate: 0, opacity: isDragging ? 0.25 : isPending ? 0.75 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      // Only the book itself (its hit zone, inside) and the menu below pick it up — not the empty slot around it.
      className="pointer-events-none relative h-full touch-manipulation select-none [-webkit-touch-callout:none]"
      onClickCapture={(e) => {
        // A drop isn't a click.
        if (justDropped.current === ub.bookId) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {children}
      {/* Behind the book, so a shelf label for the book that's out sits over it. */}
      <div className="pointer-events-auto absolute inset-x-0 -z-10 flex justify-center" style={{ top: "calc(var(--shelf-base) + var(--plank) + 0.3rem)" }}>
        <ShelfMenu title={ub.book.title} current={ub.status} bookHref={bookHref(ub.book)} onMove={(to) => onMove(ub.bookId, to)} />
      </div>
    </motion.div>
  );
}
