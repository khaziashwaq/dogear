"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createReviewAction, deleteReviewAction, updateReviewAction } from "@/app/actions/content";
import { BookCover } from "@/components/book/book-cover";
import { BookPicker } from "@/components/book/book-picker";
import { Button } from "@/components/ui/button";
import { StarInput } from "@/components/ui/stars";
import { useToast } from "@/components/ui/toast";
import { VisibilitySelect } from "@/components/ui/visibility-select";
import { bookHref, bookRef } from "@/lib/book-ref";
import type { Book, Review, Visibility } from "@/lib/types";
import { authorLine } from "@/lib/utils";

export function ReviewForm({ initialBook, existing, suggestions, initialRating }: { initialBook: Book | null; existing?: Review; suggestions: Book[]; initialRating?: number | null }) {
  const [book, setBook] = useState<Book | null>(existing?.book ?? initialBook);
  const [rating, setRating] = useState<number | null>(existing?.rating ?? initialRating ?? null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [spoilers, setSpoilers] = useState(existing?.containsSpoilers ?? false);
  const [reread, setReread] = useState(existing?.isReread ?? false);
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? "public");
  const [picking, setPicking] = useState(!existing && !initialBook);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!book || !body.trim()) return;
    const input = { rating, title: title || null, body, containsSpoilers: spoilers, isReread: reread, visibility };
    start(async () => {
      const res = existing ? await updateReviewAction(existing.id, input) : await createReviewAction(bookRef(book), input);
      if (!res.ok) return toast(res.error, "error");
      toast(existing ? "Review updated" : "Review published ✦");
      router.push(res.data.postId ? `/post/${res.data.postId}` : bookHref(res.data.book));
    });
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex items-center gap-4">
        {book ? (
          <>
            <BookCover title={book.title} authors={book.authors} coverUrl={book.coverUrl} size="md" />
            <div className="min-w-0">
              <p className="meta">reviewing</p>
              <p className="font-serif text-3xl leading-tight">{book.title}</p>
              <p className="meta normal-case tracking-normal">{authorLine(book.authors)}</p>
              {!existing && <button type="button" onClick={() => setPicking(true)} className="meta mt-2 text-burgundy hover:text-ink">change book</button>}
            </div>
          </>
        ) : (
          <Button variant="paper" size="lg" onClick={() => setPicking(true)}>Choose a book to review</Button>
        )}
      </div>

      <div>
        <p className="meta mb-2">Your rating</p>
        <StarInput value={rating} onChange={setRating} size="lg" />
      </div>

      <label className="block">
        <span className="meta mb-1.5 block">Headline <span className="normal-case tracking-normal text-ink-faint">(optional)</span></span>
        <input className="field font-serif text-2xl italic" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="a love letter to bad decisions in good coats" />
      </label>

      <label className="block">
        <span className="meta mb-1.5 flex justify-between"><span>Your review</span><span className="normal-case tracking-normal">{words} words</span></span>
        <textarea
          className="field ruled min-h-72 resize-y bg-card text-[1.02rem] leading-[1.85rem]"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={20000}
          required
          placeholder="One line or a whole essay — both welcome."
        />
      </label>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-burgundy" checked={spoilers} onChange={(e) => setSpoilers(e.target.checked)} /> Contains spoilers</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-burgundy" checked={reread} onChange={(e) => setReread(e.target.checked)} /> This is a re-read</label>
        <VisibilitySelect value={visibility} onChange={setVisibility} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        {existing ? (
          <Button
            variant="ghost"
            className="text-burgundy"
            disabled={pending}
            onClick={() => {
              if (!confirm("Delete this review? Its likes and comments go with it.")) return;
              start(async () => {
                const res = await deleteReviewAction(existing.id);
                if (!res.ok) return toast(res.error, "error");
                toast("Review deleted");
                router.push(bookHref(existing.book));
              });
            }}
          >
            Delete review
          </Button>
        ) : <span />}
        <Button type="submit" size="lg" variant="burgundy" disabled={pending || !book || !body.trim()}>{pending ? "Saving…" : existing ? "Save changes" : "Publish review"}</Button>
      </div>
      <BookPicker open={picking} onClose={() => setPicking(false)} onPick={setBook} suggestions={suggestions} title="Which book are you reviewing?" />
    </form>
  );
}
