"use client";

import { BookCheck, BookMarked, BookOpen, CalendarPlus, Check, Heart, Library, MessageSquareQuote, PenLine, RotateCcw, Send, Tag, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { addSessionAction, ensureBookAction, setCustomShelvesAction, setFavouriteAction, setProgressAction, setRatingAction, setShelfStatusAction, undoShelfMoveAction } from "@/app/actions/books";
import { addToListAction, myListsAction } from "@/app/actions/content";
import { searchReadersAction, sendRecommendationAction } from "@/app/actions/social";
import { Avatar } from "@/components/profile/avatar";
import { Button, buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { StarInput } from "@/components/ui/stars";
import { useToast } from "@/components/ui/toast";
import { bookRef } from "@/lib/book-ref";
import type { Book, Profile, ReadingList, ShelfStatus, UserBook } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUSES: { value: ShelfStatus; label: string; icon: typeof BookOpen; done: string }[] = [
  { value: "want_to_read", label: "Want to read", icon: BookMarked, done: "Added to Want to Read" },
  { value: "reading", label: "Reading", icon: BookOpen, done: "Happy reading ✦" },
  { value: "read", label: "Read", icon: BookCheck, done: "Marked as read" },
  { value: "dnf", label: "Abandon", icon: X, done: "Moved to Did Not Finish — no shame" },
];

export function ShelfActions({ book, userBook, signedIn, following }: { book: Book; userBook: UserBook | null; signedIn: boolean; following: Profile[] }) {
  const [ub, setUb] = useState(userBook);
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<null | "list" | "pass" | "log" | "shelves">(null);
  const [progress, setProgress] = useState(userBook?.progressPages ? String(userBook.progressPages) : "");
  const toast = useToast();
  const router = useRouter();
  const ref = bookRef(book);
  const savedId = ub?.bookId ?? book.id;

  if (!signedIn) {
    return (
      <div className="paper p-5 text-center">
        <p className="font-serif text-xl">Keep track of this one</p>
        <p className="mt-1 text-sm text-ink-soft">Shelve it, rate it, write in the margins.</p>
        <Link href={`/login?next=${encodeURIComponent(`/book/${book.slug ?? book.olWorkId}`)}`} className={buttonClass("burgundy", "md", "mt-4 w-full")}>Sign in to shelve</Link>
      </div>
    );
  }

  const run = (
    fn: () => Promise<{ ok: true; data: { userBook: UserBook | null; undo?: Record<string, unknown> | null } } | { ok: false; error: string }>,
    msg?: string,
  ) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast(res.error, "error");
      setUb(res.data.userBook);
      const record = res.data.undo;
      if (msg) toast(msg, "default", record ? { label: "Undo", onClick: () => run(() => undoShelfMoveAction(record), "Put back") } : undefined);
      router.refresh();
    });

  const setStatus = (s: ShelfStatus) => {
    const next = ub?.status === s ? null : s;
    run(() => setShelfStatusAction(ref, next), next ? STATUSES.find((x) => x.value === next)!.done : "Removed from your shelves");
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Shelf">
        {STATUSES.map(({ value, label, icon: Icon }) => {
          const on = ub?.status === value;
          return (
            <button
              key={value}
              type="button"
              disabled={pending}
              aria-pressed={on}
              onClick={() => setStatus(value)}
              className={cn(
                "flex items-center justify-center gap-2 border px-3 py-2.5 text-sm transition-all",
                on ? "border-ink bg-ink text-paper shadow-[2px_2px_0_var(--color-burgundy)]" : "border-line-strong bg-card hover:border-ink",
              )}
            >
              {on ? <Check className="size-4" /> : <Icon className="size-4" strokeWidth={1.6} />}
              {label}
            </button>
          );
        })}
      </div>

      {ub?.status === "read" && (
        <Button variant="paper" className="w-full" disabled={pending} onClick={() => run(() => setShelfStatusAction(ref, "reading", { reread: true }), "Re-reading — welcome back")}>
          <RotateCcw className="size-4" /> Re-read
        </Button>
      )}

      {ub?.status === "reading" && (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = progress ? Number(progress) : null;
            if (n != null && book.pageCount && n > book.pageCount) return toast(`This edition has ${book.pageCount} pages.`, "error");
            if (!savedId) return;
            start(async () => {
              const res = await setProgressAction(savedId, n);
              if (!res.ok) return toast(res.error, "error");
              setUb(res.data);
              toast("Progress saved");
              router.refresh();
            });
          }}
        >
          <label className="flex-1">
            <span className="meta mb-1 block">I&rsquo;m on page</span>
            <input className="field" inputMode="numeric" value={progress} onChange={(e) => setProgress(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder={book.pageCount ? `of ${book.pageCount}` : ""} />
          </label>
          <Button type="submit" variant="paper" disabled={pending}>Save</Button>
        </form>
      )}

      <div className="flex items-center justify-between gap-3 border-y border-line py-3">
        <StarInput value={ub?.rating ?? null} disabled={pending} onChange={(v) => run(() => setRatingAction(ref, v), v ? `Rated ${v} ★` : "Rating cleared")} />
        <button
          type="button"
          aria-pressed={Boolean(ub?.isFavourite)}
          aria-label={ub?.isFavourite ? "Remove from favourites" : "Add to favourites"}
          disabled={pending}
          onClick={() => run(() => setFavouriteAction(ref, !ub?.isFavourite), ub?.isFavourite ? "Removed from favourites" : "A new favourite ♥")}
          className={cn("rounded-full p-2 transition-colors", ub?.isFavourite ? "text-burgundy" : "text-ink-faint hover:text-burgundy")}
        >
          <Heart className={cn("size-6", ub?.isFavourite && "fill-burgundy")} strokeWidth={1.6} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Link href={`/review/new?book=${encodeURIComponent(book.slug ?? book.olWorkId ?? "")}`} className={buttonClass("ink", "md")}><PenLine className="size-4" /> Review</Link>
        <Link href={`/quotes/new?book=${encodeURIComponent(book.slug ?? book.olWorkId ?? "")}`} className={buttonClass("paper", "md")}><MessageSquareQuote className="size-4" /> Quote</Link>
        <Button variant="paper" onClick={() => setDialog("list")}><Library className="size-4" /> Add to list</Button>
        <Button variant="paper" onClick={() => setDialog("pass")}><Send className="size-4" /> Pass it on</Button>
        <Button variant="ghost" onClick={() => setDialog("log")}><CalendarPlus className="size-4" /> Log dates</Button>
        <Button variant="ghost" onClick={() => setDialog("shelves")}><Tag className="size-4" /> Shelves</Button>
      </div>
      {ub && ub.shelves.length > 0 && (
        <p className="meta flex flex-wrap gap-1.5">{ub.shelves.map((s) => <span key={s} className="rounded-full bg-butter/60 px-2 py-0.5 normal-case tracking-normal">{s}</span>)}</p>
      )}

      <AddToListDialog open={dialog === "list"} onClose={() => setDialog(null)} book={book} />
      <PassDialog open={dialog === "pass"} onClose={() => setDialog(null)} book={book} following={following} />
      <LogDialog open={dialog === "log"} onClose={() => setDialog(null)} book={book} onDone={() => router.refresh()} />
      <ShelvesDialog key={(ub?.shelves ?? []).join("|")} open={dialog === "shelves"} onClose={() => setDialog(null)} book={book} current={ub?.shelves ?? []} onSaved={(u) => setUb(u)} />
    </div>
  );
}

function AddToListDialog({ open, onClose, book }: { open: boolean; onClose: () => void; book: Book }) {
  const [lists, setLists] = useState<ReadingList[] | null>(null);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  useEffect(() => {
    if (open && !lists) myListsAction().then((r) => setLists(r.ok ? r.data : []));
  }, [open, lists]);
  return (
    <Dialog open={open} onClose={onClose} title="Add to a list" description={book.title}>
      <label className="block">
        <span className="meta mb-1.5 block">A note for this pick (optional)</span>
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="why it belongs here…" />
      </label>
      <ul className="mt-4 max-h-72 divide-y divide-line overflow-y-auto border-y border-line">
        {lists === null && <li className="py-4 text-sm text-ink-soft">Loading your lists…</li>}
        {lists?.length === 0 && <li className="py-4 text-sm text-ink-soft">You haven&rsquo;t made any lists yet.</li>}
        {lists?.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              disabled={pending}
              className="flex w-full items-center justify-between gap-3 px-1 py-3 text-left hover:bg-paper-deep"
              onClick={() =>
                start(async () => {
                  const res = await addToListAction(l.id, bookRef(book), note || null);
                  if (!res.ok) return toast(res.error, "error");
                  toast(`Added to “${l.title}”`);
                  onClose();
                })
              }
            >
              <span>
                <span className="block font-serif text-lg leading-tight">{l.title}</span>
                <span className="meta">{l.bookCount} books · {l.visibility}</span>
              </span>
              <span className="meta text-burgundy">add +</span>
            </button>
          </li>
        ))}
      </ul>
      <Link href={`/lists/new?book=${encodeURIComponent(book.slug ?? book.olWorkId ?? "")}`} className={buttonClass("paper", "md", "mt-4 w-full")}>Start a new list with this book</Link>
    </Dialog>
  );
}

export function PassDialog({ open, onClose, book, following, parentId = null }: { open: boolean; onClose: () => void; book: Book; following: Profile[]; parentId?: string | null }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [to, setTo] = useState<Profile | null>(null);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(async () => {
      const r = await searchReadersAction(q);
      if (r.ok) setResults(r.data);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const people = q.trim().length >= 2 ? results : following;
  return (
    <Dialog open={open} onClose={onClose} title="Pass the book" description={`Recommend ${book.title} to a friend, with a note in the margin.`}>
      {!to ? (
        <>
          <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search readers…" aria-label="Search readers" />
          {q.trim().length < 2 && following.length > 0 && <p className="meta mt-3">People you follow</p>}
          <ul className="mt-2 max-h-72 overflow-y-auto">
            {people.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setTo(p)} className="flex w-full items-center gap-3 px-1 py-2 text-left hover:bg-paper-deep">
                  <Avatar profile={p} size="sm" />
                  <span><span className="block text-sm font-medium">{p.displayName}</span><span className="meta normal-case tracking-normal">@{p.username}</span></span>
                </button>
              </li>
            ))}
            {people.length === 0 && <li className="py-4 text-sm text-ink-soft">{q ? "No readers match." : "Follow some readers to pass books to them."}</li>}
          </ul>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await sendRecommendationAction({ recipientId: to.id, book: bookRef(book), message, parentId });
              if (!res.ok) return toast(res.error, "error");
              toast(`Passed to ${to.displayName} ✉`);
              setTo(null);
              setMessage("");
              onClose();
            });
          }}
        >
          <div className="flex items-center gap-3 bg-butter/50 p-3">
            <Avatar profile={to} size="sm" />
            <p className="flex-1 text-sm">To <strong className="font-medium">{to.displayName}</strong></p>
            <button type="button" onClick={() => setTo(null)} className="meta hover:text-ink">change</button>
          </div>
          <label className="mt-4 block">
            <span className="meta mb-1.5 block">Your note</span>
            <textarea className="field hand resize-none text-2xl leading-tight" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} placeholder="You'll love the bit where…" />
          </label>
          <Button type="submit" variant="burgundy" size="lg" className="mt-4 w-full" disabled={pending}>{pending ? "Sending…" : "Pass it on"}</Button>
        </form>
      )}
    </Dialog>
  );
}

function LogDialog({ open, onClose, book, onDone }: { open: boolean; onClose: () => void; book: Book; onDone: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [status, setStatus] = useState<"finished" | "reading" | "abandoned">("finished");
  const [startedOn, setStartedOn] = useState("");
  const [finishedOn, setFinishedOn] = useState(today);
  const [isReread, setReread] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const invalid = Boolean(startedOn && finishedOn && status !== "reading" && finishedOn < startedOn);
  return (
    <Dialog open={open} onClose={onClose} title="Log a reading" description="Record when you read it. Log as many readings as you like.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (invalid) return;
          start(async () => {
            const b = await ensureBookAction(bookRef(book));
            if (!b.ok) return toast(b.error, "error");
            const res = await addSessionAction({
              bookId: b.data.id, status, startedOn: startedOn || null, finishedOn: status === "reading" ? null : finishedOn || null, isReread, notes: notes || null,
            });
            if (!res.ok) return toast(res.error, "error");
            toast("Logged in your diary");
            onClose();
            onDone();
          });
        }}
      >
        <div role="radiogroup" aria-label="How did it go?" className="flex flex-wrap gap-2">
          {(["finished", "reading", "abandoned"] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={status === s} onClick={() => setStatus(s)} className={cn("border px-3 py-1.5 text-sm", status === s ? "border-ink bg-ink text-paper" : "border-line-strong")}>
              {s === "finished" ? "Finished" : s === "reading" ? "Still reading" : "Didn't finish"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="meta mb-1.5 block">Started</span><input type="date" max={today} className="field" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} /></label>
          {status !== "reading" && (
            <label><span className="meta mb-1.5 block">{status === "finished" ? "Finished" : "Stopped"}</span><input type="date" max={today} className="field" value={finishedOn} onChange={(e) => setFinishedOn(e.target.value)} aria-invalid={invalid} /></label>
          )}
        </div>
        {invalid && <p className="text-sm text-burgundy" role="alert">The end date is before the start date.</p>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isReread} onChange={(e) => setReread(e.target.checked)} className="size-4 accent-burgundy" /> This was a re-read</label>
        <label className="block"><span className="meta mb-1.5 block">Diary note (only you)</span><textarea className="field resize-none" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="Read it on the night bus…" /></label>
        <Button type="submit" size="lg" className="w-full" disabled={pending || invalid}>{pending ? "Saving…" : "Log it"}</Button>
      </form>
    </Dialog>
  );
}

function ShelvesDialog({ open, onClose, book, current, onSaved }: { open: boolean; onClose: () => void; book: Book; current: string[]; onSaved: (u: UserBook) => void }) {
  const [shelves, setShelves] = useState(current);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const add = () => {
    const s = draft.trim().toLowerCase();
    if (s && !shelves.includes(s)) setShelves([...shelves, s]);
    setDraft("");
  };
  return (
    <Dialog open={open} onClose={onClose} title="Custom shelves" description="Invent your own: “comfort reads”, “books that made me text my ex”…">
      <div className="flex flex-wrap gap-2">
        {shelves.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded-full bg-butter/70 py-1 pl-3 pr-1 text-sm">
            {s}
            <button type="button" aria-label={`Remove ${s}`} onClick={() => setShelves(shelves.filter((x) => x !== s))} className="rounded-full p-0.5 hover:bg-ink/10"><X className="size-3.5" /></button>
          </span>
        ))}
        {shelves.length === 0 && <p className="text-sm text-ink-soft">No custom shelves yet.</p>}
      </div>
      <div className="mt-4 flex gap-2">
        <input className="field" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} maxLength={40} placeholder="New shelf name" aria-label="New shelf name" />
        <Button variant="paper" onClick={add} disabled={!draft.trim()}>Add</Button>
      </div>
      <Button
        className="mt-5 w-full"
        size="lg"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const b = await ensureBookAction(bookRef(book));
            if (!b.ok) return toast(b.error, "error");
            const res = await setCustomShelvesAction(b.data.id, shelves);
            if (!res.ok) return toast(res.error, "error");
            onSaved(res.data);
            toast("Shelves saved");
            onClose();
            router.refresh();
          })
        }
      >
        Save shelves
      </Button>
    </Dialog>
  );
}
