"use client";

import { BookPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPostAction } from "@/app/actions/social";
import { BookCover } from "@/components/book/book-cover";
import { BookPicker } from "@/components/book/book-picker";
import { Avatar } from "@/components/profile/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { VisibilitySelect } from "@/components/ui/visibility-select";
import { bookRef } from "@/lib/book-ref";
import type { Book, Profile, Visibility } from "@/lib/types";
import { authorLine, cn } from "@/lib/utils";

export function Composer({ viewer, suggestions, autoFocus }: { viewer: Profile; suggestions: Book[]; autoFocus?: boolean }) {
  const [body, setBody] = useState("");
  const [book, setBook] = useState<Book | null>(null);
  const [kind, setKind] = useState<"update" | "recommendation">("update");
  const [page, setPage] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [picking, setPicking] = useState(false);
  const [focused, setFocused] = useState(Boolean(autoFocus));
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const pageNum = page ? Number(page) : null;
  const pageInvalid = pageNum != null && (!Number.isInteger(pageNum) || pageNum < 0 || (book?.pageCount != null && pageNum > book.pageCount));

  const submit = () => {
    if (!body.trim() || pageInvalid) return;
    start(async () => {
      const res = await createPostAction({
        kind,
        body,
        book: book ? bookRef(book) : null,
        progressPages: kind === "update" ? pageNum : null,
        progressPercent: kind === "update" && pageNum != null && book?.pageCount ? Math.min(100, Math.round((pageNum / book.pageCount) * 100)) : null,
        visibility,
      });
      if (!res.ok) return toast(res.error, "error");
      setBody("");
      setBook(null);
      setPage("");
      setFocused(false);
      toast(kind === "recommendation" ? "Recommendation posted" : "Update posted");
      router.refresh();
    });
  };

  return (
    <section aria-label="Post an update" className="paper relative p-4 sm:p-5">
      <div className="tape -top-3 right-10 rotate-3" aria-hidden />
      <div className="flex gap-3">
        <Avatar profile={viewer} size="md" className="hidden sm:inline-flex" />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex gap-1" role="tablist" aria-label="Post type">
            {(["update", "recommendation"] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={cn("meta border-b-2 px-1 pb-0.5", kind === k ? "border-burgundy text-ink" : "border-transparent hover:text-ink")}>
                {k === "update" ? "reading update" : "recommend"}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="composer">{kind === "update" ? "What are you reading?" : "What should everyone read?"}</label>
          <textarea
            id="composer"
            value={body}
            autoFocus={autoFocus}
            onFocus={() => setFocused(true)}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && submit()}
            rows={focused ? 3 : 1}
            maxLength={5000}
            placeholder={kind === "update" ? "Page 112 and I've already underlined half of it…" : "If you liked ___, you need to read…"}
            className={cn("w-full resize-none bg-transparent text-[1.05rem] leading-relaxed placeholder:text-ink-faint focus:outline-none", kind === "recommendation" && "hand text-2xl")}
          />

          {book && (
            <div className="mt-2 flex items-center gap-3 border border-line bg-paper/60 p-2">
              <BookCover title={book.title} authors={book.authors} coverUrl={book.coverUrl} size="xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-base leading-tight">{book.title}</p>
                <p className="meta truncate normal-case tracking-normal">{authorLine(book.authors)}</p>
              </div>
              {kind === "update" && (
                <label className="flex items-center gap-1.5 text-sm">
                  <span className="meta">page</span>
                  <input inputMode="numeric" value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))} className={cn("field w-20 py-1 text-sm", pageInvalid && "border-burgundy")} aria-invalid={pageInvalid} placeholder={book.pageCount ? `/${book.pageCount}` : ""} />
                </label>
              )}
              <button type="button" onClick={() => setBook(null)} aria-label="Remove book" className="rounded-full p-1 text-ink-faint hover:text-ink"><X className="size-4" /></button>
            </div>
          )}

          {(focused || body) && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPicking(true)}>
                  <BookPlus className="size-4" /> {book ? "Change book" : "Add a book"}
                </Button>
                <VisibilitySelect value={visibility} onChange={setVisibility} compact />
              </div>
              <Button onClick={submit} disabled={pending || !body.trim() || pageInvalid} size="sm">
                {pending ? "Posting…" : "Post"}
              </Button>
            </div>
          )}
        </div>
      </div>
      <BookPicker open={picking} onClose={() => setPicking(false)} onPick={setBook} suggestions={suggestions} title="Which book?" />
    </section>
  );
}
