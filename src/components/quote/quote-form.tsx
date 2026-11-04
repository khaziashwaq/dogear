"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createQuoteAction, deleteQuoteAction, updateQuoteAction } from "@/app/actions/content";
import { BookCover } from "@/components/book/book-cover";
import { BookPicker } from "@/components/book/book-picker";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { VisibilitySelect } from "@/components/ui/visibility-select";
import { bookHref, bookRef } from "@/lib/book-ref";
import type { Book, Quote, Visibility } from "@/lib/types";
import { authorLine } from "@/lib/utils";
import { QuoteCard } from "./quote-card";

export function QuoteForm({ initialBook, existing, suggestions }: { initialBook: Book | null; existing?: Quote; suggestions: Book[] }) {
  const [book, setBook] = useState<Book | null>(existing?.book ?? initialBook);
  const [body, setBody] = useState(existing?.body ?? "");
  const [page, setPage] = useState(existing?.page ?? "");
  const [commentary, setCommentary] = useState(existing?.commentary ?? "");
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? "public");
  const [picking, setPicking] = useState(!existing && !initialBook);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const preview: Quote | null = book && body.trim()
    ? { id: existing?.id ?? "preview", userId: "", bookId: book.id ?? "", body, page: page || null, commentary: commentary || null, visibility, createdAt: "", postId: null, author: existing?.author as Quote["author"], book: { ...book, id: book.id ?? "", slug: book.slug ?? "" } }
    : null;

  return (
    <form
      className="grid gap-8 lg:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!book || !body.trim()) return;
        const input = { body, page: page || null, commentary: commentary || null, visibility };
        start(async () => {
          const res = existing ? await updateQuoteAction(existing.id, input) : await createQuoteAction(bookRef(book), input);
          if (!res.ok) return toast(res.error, "error");
          toast(existing ? "Quote updated" : "Passage saved ✦");
          router.push(`/quotes/${res.data.id}`);
        });
      }}
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          {book ? (
            <>
              <BookCover title={book.title} authors={book.authors} coverUrl={book.coverUrl} size="sm" />
              <div>
                <p className="font-serif text-xl leading-tight">{book.title}</p>
                <p className="meta normal-case tracking-normal">{authorLine(book.authors)}</p>
                {!existing && <button type="button" className="meta text-burgundy hover:text-ink" onClick={() => setPicking(true)}>change book</button>}
              </div>
            </>
          ) : (
            <Button variant="paper" onClick={() => setPicking(true)}>Choose the book</Button>
          )}
        </div>
        <label className="block">
          <span className="meta mb-1.5 block">The passage</span>
          <textarea className="field min-h-40 resize-y font-serif text-xl italic leading-snug" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} required placeholder="Type it out exactly as it's printed…" />
        </label>
        <label className="block w-32">
          <span className="meta mb-1.5 block">Page</span>
          <input className="field" value={page} onChange={(e) => setPage(e.target.value)} maxLength={20} placeholder="e.g. 112" />
        </label>
        <label className="block">
          <span className="meta mb-1.5 block">Your note in the margin <span className="normal-case tracking-normal text-ink-faint">(optional)</span></span>
          <input className="field hand text-2xl" value={commentary} onChange={(e) => setCommentary(e.target.value)} maxLength={1000} placeholder="I gasped on the tube" />
        </label>
        <VisibilitySelect value={visibility} onChange={setVisibility} />
        <div className="flex flex-wrap justify-between gap-3 border-t border-line pt-5">
          {existing ? (
            <Button variant="ghost" className="text-burgundy" disabled={pending} onClick={() => {
              if (!confirm("Delete this quote?")) return;
              start(async () => {
                const res = await deleteQuoteAction(existing.id);
                if (!res.ok) return toast(res.error, "error");
                toast("Quote deleted");
                router.push(bookHref(existing.book));
              });
            }}>Delete</Button>
          ) : <span />}
          <Button type="submit" size="lg" variant="burgundy" disabled={pending || !book || !body.trim()}>{pending ? "Saving…" : existing ? "Save changes" : "Save passage"}</Button>
        </div>
      </div>
      <div aria-live="polite">
        <p className="meta mb-3">Preview</p>
        {preview ? <QuoteCard quote={preview} linkBook={false} size={body.length < 120 ? "lg" : "md"} /> : <div className="flex h-56 items-center justify-center border border-dashed border-line-strong"><p className="hand text-2xl text-ink-faint">your card will appear here</p></div>}
      </div>
      <BookPicker open={picking} onClose={() => setPicking(false)} onPick={setBook} suggestions={suggestions} title="Which book is it from?" />
    </form>
  );
}
