"use client";

import { BookHeart, BookPlus, Highlighter, Library, PenLine } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { setShelfStatusAction } from "@/app/actions/books";
import { BookPicker } from "@/components/book/book-picker";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { bookRef } from "@/lib/book-ref";
import type { Book } from "@/lib/types";

const OPTIONS = [
  { href: "/review/new", label: "Review", body: "Stars, thoughts, maybe spoilers.", icon: BookHeart, tone: "bg-rose/50" },
  { href: "/lists/new", label: "List", body: "Curate a little collection.", icon: Library, tone: "bg-paper-shade" },
  { href: "/quotes/new", label: "Highlight", body: "A passage, and what it made you think.", icon: Highlighter, tone: "bg-sage/50" },
  { href: "/activity?compose=1", label: "Reading update", body: "Where you are, how it's going.", icon: PenLine, tone: "bg-butter/60" },
];

export function CreateMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [picking, setPicking] = useState(false);
  const [, start] = useTransition();
  const toast = useToast();

  const add = (book: Book) => {
    setPicking(false);
    // Say so straight away: a book new to dogear is fetched from Open Library first, which takes a moment.
    toast(`Adding ${book.title} to Want to read…`);
    start(async () => {
      const res = await setShelfStatusAction(bookRef(book), "want_to_read");
      if (!res.ok) return toast(res.error, "error");
      toast(`${res.data.book.title} is on your Want to read shelf`);
      // The action revalidates the layout, so the page re-renders with the new shelf; no extra refresh needed.
    });
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} title="Leave a little piece of yourself" description="What are you making today?">
        <button
          type="button"
          onClick={() => {
            onClose();
            setPicking(true);
          }}
          className="group mb-3 flex w-full items-center gap-4 border border-ink bg-ink p-4 text-left text-paper transition-transform hover:-translate-y-0.5"
        >
          <BookPlus className="size-6 shrink-0 text-butter transition-transform group-hover:-rotate-6" strokeWidth={1.6} />
          <span>
            <span className="block font-serif text-xl leading-none">Add a book</span>
            <span className="mt-1 block text-xs text-paper/75">Find it and put it on your Want to read shelf.</span>
          </span>
        </button>
        <div className="grid grid-cols-2 gap-3">
          {OPTIONS.map(({ href, label, body, icon: Icon, tone }, i) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`group border border-line-strong p-4 transition-transform hover:-translate-y-0.5 hover:border-ink ${tone}`}
              style={{ rotate: `${[-0.6, 0.5, 0.4, -0.5][i]}deg` }}
            >
              <Icon className="size-5 text-burgundy transition-transform group-hover:-rotate-6" strokeWidth={1.6} />
              <p className="mt-3 font-serif text-xl leading-none">{label}</p>
              <p className="mt-1 text-xs text-ink-soft">{body}</p>
            </Link>
          ))}
        </div>
      </Dialog>
      <BookPicker open={picking} onClose={() => setPicking(false)} onPick={add} title="Add a book to Want to read" />
    </>
  );
}
