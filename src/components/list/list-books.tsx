"use client";

import { Reorder } from "framer-motion";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addToListAction, removeFromListAction, reorderListAction, toggleListFollowAction, updateListBookAction } from "@/app/actions/content";
import { BookCover } from "@/components/book/book-cover";
import { BookPicker } from "@/components/book/book-picker";
import { useViewer } from "@/components/providers/viewer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { bookHref, bookRef } from "@/lib/book-ref";
import type { ListBook } from "@/lib/types";
import { authorLine, cn, tilt } from "@/lib/utils";

export function FollowListButton({ listId, initial, count }: { listId: string; initial: boolean; count: number }) {
  const { viewer } = useViewer();
  const [on, setOn] = useState(initial);
  const [n, setN] = useState(count);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Button
      variant={on ? "paper" : "ink"}
      disabled={pending}
      aria-pressed={on}
      onClick={() => {
        if (!viewer) return router.push("/login");
        setOn(!on);
        setN((x) => x + (on ? -1 : 1));
        start(async () => {
          const res = await toggleListFollowAction(listId, !on);
          if (!res.ok) {
            setOn(on);
            setN((x) => x + (on ? 1 : -1));
            toast(res.error, "error");
          } else toast(on ? "Unfollowed list" : "Following this list");
        });
      }}
    >
      {on ? "Following list" : "Follow list"} <span className="opacity-70">{n}</span>
    </Button>
  );
}

export function ListBooks({ listId, initial, ranked, editable }: { listId: string; initial: ListBook[]; ranked: boolean; editable: boolean }) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [picking, setPicking] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const persistOrder = (next: ListBook[]) => {
    start(async () => {
      const res = await reorderListAction(listId, next.map((i) => i.bookId));
      if (!res.ok) toast(res.error, "error");
    });
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
    persistOrder(next);
  };

  if (items.length === 0 && !editable) return <p className="hand text-2xl text-ink-faint">an empty list, for now</p>;

  const row = (lb: ListBook, i: number) => (
    <div className={cn("group flex gap-4 border-b border-line py-5", editable && "bg-paper")}>
      {editable && <GripVertical className="mt-8 hidden size-5 shrink-0 cursor-grab text-ink-faint sm:block" aria-hidden />}
      {ranked && <span className="w-10 shrink-0 text-right font-serif text-4xl italic leading-none text-burgundy">{i + 1}</span>}
      <Link href={bookHref(lb.book)} className="shrink-0" draggable={false}>
        <BookCover title={lb.book.title} authors={lb.book.authors} coverUrl={lb.book.coverUrl} size="md" tilt={tilt(lb.bookId, 1.5)} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={bookHref(lb.book)} className="font-serif text-2xl leading-tight hover:text-burgundy" draggable={false}>{lb.book.title}</Link>
        <p className="meta normal-case tracking-normal">{authorLine(lb.book.authors)}{lb.book.publishedYear ? ` · ${lb.book.publishedYear}` : ""}</p>
        {editing === lb.bookId ? (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await updateListBookAction(listId, lb.bookId, note || null, lb.imageUrl);
                if (!res.ok) return toast(res.error, "error");
                setItems((list) => list.map((x) => (x.bookId === lb.bookId ? { ...x, note: note || null } : x)));
                setEditing(null);
              });
            }}
          >
            <input className="field hand text-xl" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} autoFocus aria-label="Note" placeholder="why it belongs here" />
            <Button type="submit" size="sm" disabled={pending}>Save</Button>
          </form>
        ) : (
          lb.note && <p className="hand mt-2 text-2xl leading-tight text-burgundy">{lb.note}</p>
        )}
        {editable && editing !== lb.bookId && (
          <div className="mt-3 flex flex-wrap gap-1">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${lb.book.title} up`} className="rounded p-1.5 text-ink-soft hover:bg-paper-deep hover:text-ink disabled:opacity-30"><ArrowUp className="size-4" /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move ${lb.book.title} down`} className="rounded p-1.5 text-ink-soft hover:bg-paper-deep hover:text-ink disabled:opacity-30"><ArrowDown className="size-4" /></button>
            <button type="button" onClick={() => { setEditing(lb.bookId); setNote(lb.note ?? ""); }} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-ink-soft hover:bg-paper-deep hover:text-ink"><Pencil className="size-3.5" /> note</button>
            <button
              type="button"
              onClick={() => start(async () => {
                const res = await removeFromListAction(listId, lb.bookId);
                if (!res.ok) return toast(res.error, "error");
                setItems((list) => list.filter((x) => x.bookId !== lb.bookId));
                router.refresh();
              })}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-ink-soft hover:bg-paper-deep hover:text-burgundy"
            >
              <Trash2 className="size-3.5" /> remove
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {editable ? (
        <Reorder.Group axis="y" values={items} onReorder={setItems} className="border-t border-line">
          {items.map((lb, i) => (
            <Reorder.Item key={lb.bookId} value={lb} onDragEnd={() => persistOrder(items)} className="list-none">
              {row(lb, i)}
            </Reorder.Item>
          ))}
        </Reorder.Group>
      ) : (
        <ol className="border-t border-line">{items.map((lb, i) => <li key={lb.bookId}>{row(lb, i)}</li>)}</ol>
      )}
      {editable && (
        <>
          <Button variant="paper" className="mt-5" onClick={() => setPicking(true)}>+ Add a book</Button>
          <BookPicker
            open={picking}
            onClose={() => setPicking(false)}
            title="Add to this list"
            onPick={(b) =>
              start(async () => {
                const res = await addToListAction(listId, bookRef(b), null);
                if (!res.ok) return toast(res.error, "error");
                const saved = res.data;
                setItems((list) => (list.some((x) => x.bookId === saved.id) ? list : [...list, { bookId: saved.id, position: list.length, note: null, imageUrl: null, book: saved }]));
                toast(`Added ${saved.title}`);
              })
            }
          />
        </>
      )}
    </div>
  );
}
