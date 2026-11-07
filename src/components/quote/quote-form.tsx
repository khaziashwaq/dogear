"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { createQuoteAction, deleteQuoteAction, updateQuoteAction } from "@/app/actions/content";
import { BookCover } from "@/components/book/book-cover";
import { BookPicker } from "@/components/book/book-picker";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { VisibilitySelect } from "@/components/ui/visibility-select";
import { bookHref, bookRef } from "@/lib/book-ref";
import type { Book, HighlightColour, Quote, Visibility } from "@/lib/types";
import { authorLine, cn } from "@/lib/utils";

export const HIGHLIGHTS: { key: HighlightColour; label: string }[] = [
  { key: "butter", label: "Butter yellow" },
  { key: "sage", label: "Sage green" },
  { key: "rose", label: "Dusty rose" },
  { key: "lavender", label: "Lavender" },
  { key: "blue", label: "Blue" },
];

const PASSAGE = "font-serif text-[1.35rem] leading-[1.7] sm:text-2xl sm:leading-[1.7]";

function normaliseTag(t: string) {
  return t.trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "").slice(0, 32);
}

/**
 * The annotation composer. It's a page, not a form: you type the passage straight
 * onto it and your highlighter goes down behind the words as you write; your
 * thoughts go in the margin in pencil.
 */
export function QuoteForm({ initialBook, existing, suggestions, tagSuggestions = [] }: { initialBook: Book | null; existing?: Quote; suggestions: Book[]; tagSuggestions?: string[] }) {
  const [book, setBook] = useState<Book | null>(existing?.book ?? initialBook);
  const [body, setBody] = useState(existing?.body ?? "");
  const [page, setPage] = useState(existing?.page ?? "");
  const [commentary, setCommentary] = useState(existing?.commentary ?? "");
  const [highlight, setHighlight] = useState<HighlightColour>(existing?.highlight ?? "butter");
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? "public");
  const [picking, setPicking] = useState(!existing && !initialBook);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const passageRef = useRef<HTMLTextAreaElement>(null);
  const published = Boolean(existing && !existing.isDraft);

  useEffect(() => {
    if (book && !existing) passageRef.current?.focus();
  }, [book, existing]);

  const addTag = (raw: string) => {
    const t = normaliseTag(raw);
    if (t && !tags.includes(t) && tags.length < 8) setTags([...tags, t]);
    setTagDraft("");
  };
  const tagKeys = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === "," || e.key === "Tab") && tagDraft.trim()) {
      e.preventDefault();
      addTag(tagDraft);
    } else if (e.key === "Backspace" && !tagDraft && tags.length) {
      setTags(tags.slice(0, -1));
    }
  };

  const save = (asDraft: boolean) => {
    setError(null);
    if (!book) return setError("Choose the book this passage is from.");
    if (!body.trim()) {
      passageRef.current?.focus();
      return setError("Type or paste the passage first.");
    }
    const allTags = tagDraft.trim() ? [...tags, normaliseTag(tagDraft)].filter(Boolean) : tags;
    const input = { body, page: page || null, commentary: commentary || null, visibility, highlight, tags: allTags, isDraft: asDraft };
    start(async () => {
      const res = existing ? await updateQuoteAction(existing.id, input) : await createQuoteAction(bookRef(book), input);
      if (!res.ok) {
        setError(res.error);
        return toast(res.error, "error");
      }
      toast(asDraft ? "Saved to your drafts" : existing?.isDraft ? "Published" : existing ? "Changes saved" : "Dog-eared and published");
      router.push(`/quotes/${res.data.id}`);
      router.refresh();
    });
  };

  const remove = () => {
    if (!existing || !confirm("Delete this annotation? Its likes and comments go with it.")) return;
    start(async () => {
      const res = await deleteQuoteAction(existing.id);
      if (!res.ok) return toast(res.error, "error");
      toast("Annotation deleted");
      router.push(bookHref(existing.book));
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
      onKeyDown={(e) => {
        // ⌘/Ctrl + Enter publishes (or saves changes).
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          save(false);
        }
      }}
      className="pb-24"
    >
      {/* the book */}
      <div className="flex items-center gap-4">
        {book ? (
          <>
            <BookCover title={book.title} authors={book.authors} coverUrl={book.coverUrl} size="sm" />
            <div className="min-w-0">
              <p className="font-serif text-2xl leading-tight">{book.title}</p>
              <p className="meta normal-case tracking-normal">{authorLine(book.authors)}</p>
              {!existing && (
                <button type="button" className="mt-1 text-sm text-burgundy hover:underline" onClick={() => setPicking(true)}>
                  A different book
                </button>
              )}
            </div>
          </>
        ) : (
          <Button variant="paper" onClick={() => setPicking(true)}>Choose the book</Button>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-10">
        {/* the page */}
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div role="radiogroup" aria-label="Highlight colour" className="flex items-center gap-2">
              {HIGHLIGHTS.map((h) => (
                <button
                  key={h.key}
                  type="button"
                  role="radio"
                  aria-checked={highlight === h.key}
                  aria-label={h.label}
                  title={h.label}
                  onClick={() => setHighlight(h.key)}
                  className={cn(
                    `hl-${h.key}`,
                    "size-7 rounded-full border border-ink/15 bg-[var(--hl-solid)] transition-transform hover:-translate-y-0.5",
                    highlight === h.key && "ring-2 ring-ink ring-offset-2 ring-offset-paper",
                  )}
                />
              ))}
              <span className="ml-1 text-sm text-ink-soft">{HIGHLIGHTS.find((h) => h.key === highlight)?.label}</span>
            </div>
            <label className="flex items-baseline gap-1 font-mono text-sm text-ink-soft">
              p.
              <input
                value={page}
                onChange={(e) => setPage(e.target.value)}
                maxLength={20}
                inputMode="numeric"
                placeholder="—"
                aria-label="Page number (optional)"
                className="w-16 border-b border-line-strong bg-transparent px-1 text-ink outline-none focus:border-burgundy"
              />
            </label>
          </div>

          <div className="paper relative min-h-[16rem] px-6 py-7 sm:px-10 sm:py-9">
            <div aria-hidden className="absolute inset-y-0 left-3 w-px bg-rose/60 sm:left-6" />
            <label htmlFor="passage" className="sr-only">The passage</label>
            {/* Highlight drawn behind the textarea's text: an invisible copy of the passage, wrapped identically. */}
            <div className="relative">
              <div aria-hidden className={cn(PASSAGE, "pointer-events-none min-h-[10rem] whitespace-pre-wrap break-words text-transparent")}>
                <span className={cn("marker", `hl-${highlight}`)} style={{ padding: 0, color: "transparent" }}>{body}</span>
                {"​"}
              </div>
              <textarea
                id="passage"
                ref={passageRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={2000}
                required
                placeholder="Type or paste the passage, exactly as it's printed…"
                className={cn(PASSAGE, "absolute inset-0 size-full resize-none overflow-hidden bg-transparent text-ink caret-burgundy outline-none placeholder:italic placeholder:text-ink-faint")}
              />
            </div>
            <p className="meta mt-4 text-right">{body.length}/2000</p>
          </div>
        </div>

        {/* the margin */}
        <aside className="space-y-7 lg:pt-11">
          <label className="block">
            <span className="sr-only">Your thoughts (optional)</span>
            <textarea
              value={commentary}
              onChange={(e) => setCommentary(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="What made you dog-ear this?"
              className="hand w-full resize-y border-l-2 border-burgundy/30 bg-transparent pl-3 text-2xl leading-[1.2] text-burgundy outline-none placeholder:text-ink-faint focus:border-burgundy"
            />
          </label>

          <div>
            <label htmlFor="tag-input" className="meta block">tags</label>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border-b border-line-strong pb-1.5 focus-within:border-burgundy">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-paper-deep py-0.5 pl-2 pr-1 font-mono text-xs">
                  #{t}
                  <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove tag ${t}`} className="rounded-full p-0.5 hover:bg-paper-shade">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <input
                id="tag-input"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={tagKeys}
                onBlur={() => tagDraft.trim() && addTag(tagDraft)}
                disabled={tags.length >= 8}
                placeholder={tags.length ? "" : "grief, the sea, sentences…"}
                className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-ink-faint"
              />
            </div>
            {tagSuggestions.filter((t) => !tags.includes(t)).length > 0 && tags.length < 8 && (
              <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1">
                {tagSuggestions.filter((t) => !tags.includes(t)).slice(0, 8).map((t) => (
                  <button key={t} type="button" onClick={() => addTag(t)} className="font-mono text-xs text-ink-faint hover:text-burgundy">#{t}</button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="meta mb-1.5">who can see it</p>
            <VisibilitySelect value={visibility} onChange={setVisibility} />
          </div>
        </aside>
      </div>

      {/* actions — kept in reach while you write */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur md:sticky md:bottom-0 md:mt-10 md:border md:px-5">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          {existing && (
            <Button variant="ghost" className="text-burgundy" disabled={pending} onClick={remove}>
              Delete
            </Button>
          )}
          <p role="alert" className="min-w-0 flex-1 text-sm text-burgundy">{error}</p>
          {!published && (
            <Button variant="paper" disabled={pending || !book || !body.trim()} onClick={() => save(true)}>
              Save as draft
            </Button>
          )}
          <Button type="submit" variant="burgundy" disabled={pending || !book || !body.trim()}>
            {pending ? "Saving…" : published ? "Save changes" : "Publish"}
          </Button>
        </div>
      </div>

      <BookPicker open={picking} onClose={() => setPicking(false)} onPick={setBook} suggestions={suggestions} title="Which book is it from?" />
    </form>
  );
}
