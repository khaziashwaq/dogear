"use client";

import { BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ensureBookAction } from "@/app/actions/books";
import { BookPicker } from "@/components/book/book-picker";
import { chipClass } from "@/components/ui/chip";
import { useToast } from "@/components/ui/toast";
import { bookRef } from "@/lib/book-ref";
import type { Book } from "@/lib/types";

/** "Filter by book" for the Marginalia page: pick any book, then show only its annotations. */
export function BookFilter({ hrefFor }: { hrefFor: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const pick = (b: Book) => {
    setOpen(false);
    start(async () => {
      // Open Library results need a catalogue record (and slug) to filter by.
      const slug = b.slug ?? (await ensureBookAction(bookRef(b)).then((r) => (r.ok ? r.data.slug : null)));
      if (!slug) return toast("Couldn't find that book.", "error");
      router.push(hrefFor.replace("__BOOK__", encodeURIComponent(slug)));
    });
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={pending} className={chipClass("paper", false, "shrink-0")}>
        <BookOpen className="size-3.5" /> {pending ? "Finding…" : "Filter by book"}
      </button>
      <BookPicker open={open} onClose={() => setOpen(false)} onPick={pick} title="Marginalia from which book?" />
    </>
  );
}
