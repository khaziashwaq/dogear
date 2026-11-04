"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createListAction, deleteListAction, updateListAction } from "@/app/actions/content";
import { BookCover } from "@/components/book/book-cover";
import { BookPicker } from "@/components/book/book-picker";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { useToast } from "@/components/ui/toast";
import { VisibilitySelect } from "@/components/ui/visibility-select";
import { bookRef } from "@/lib/book-ref";
import type { Book, ListCoverStyle, ReadingList, SavedBook, Visibility } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ListCover } from "./list-cover";

const STYLES: { key: ListCoverStyle; swatch: string }[] = [
  { key: "rose", swatch: "bg-rose" }, { key: "sage", swatch: "bg-sage" }, { key: "butter", swatch: "bg-butter" },
  { key: "burgundy", swatch: "bg-burgundy" }, { key: "ink", swatch: "bg-ink" }, { key: "collage", swatch: "bg-paper-shade" },
];
const IDEAS = ["Books that feel like Radiohead songs", "Books that broke my heart", "Literature for overthinkers", "Books to read on a rainy Sunday", "My literary red flags"];

export function ListForm({ existing, initialBooks = [], suggestions = [] }: { existing?: ReadingList; initialBooks?: Book[]; suggestions?: Book[] }) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [coverStyle, setCoverStyle] = useState<ListCoverStyle>(existing?.coverStyle ?? "rose");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(existing?.coverImageUrl ?? null);
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? "public");
  const [isRanked, setRanked] = useState(existing?.isRanked ?? false);
  const [books, setBooks] = useState<Book[]>(initialBooks);
  const [picking, setPicking] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const previewBooks = (existing ? existing.preview : books.map((b) => ({ ...b, id: b.id ?? b.olWorkId ?? b.title, slug: b.slug ?? "" }))) as SavedBook[];

  return (
    <form
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]"
      onSubmit={(e) => {
        e.preventDefault();
        const input = { title, description: description || null, coverStyle, coverImageUrl, visibility, isRanked };
        start(async () => {
          const res = existing ? await updateListAction(existing.id, input) : await createListAction(input, books.map(bookRef));
          if (!res.ok) return toast(res.error, "error");
          toast(existing ? "List saved" : "List created ✦");
          router.push(`/lists/${res.data.id}`);
        });
      }}
    >
      <div className="space-y-5">
        <label className="block">
          <span className="meta mb-1.5 block">Title</span>
          <input className="field font-serif text-2xl" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="Books to read on a rainy Sunday" />
        </label>
        {!existing && !title && (
          <div className="flex flex-wrap gap-2">
            <span className="meta self-center">ideas:</span>
            {IDEAS.map((i) => <button key={i} type="button" onClick={() => setTitle(i)} className="hand rounded-full border border-line-strong px-3 text-lg hover:border-ink">{i}</button>)}
          </div>
        )}
        <label className="block">
          <span className="meta mb-1.5 block">Description</span>
          <textarea className="field resize-y" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="What ties these books together?" />
        </label>
        <fieldset>
          <legend className="meta mb-2">Cover</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cover colour">
            {STYLES.map((s) => (
              <button key={s.key} type="button" role="radio" aria-checked={coverStyle === s.key} aria-label={s.key} onClick={() => setCoverStyle(s.key)} className={cn("size-9 rounded-full border-2 transition-transform", s.swatch, coverStyle === s.key ? "scale-110 border-ink" : "border-transparent")} />
            ))}
          </div>
          <div className="mt-3"><ImageUpload kind="list" value={coverImageUrl} onChange={setCoverImageUrl} label="Add a cover image" /></div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-5">
          <VisibilitySelect value={visibility} onChange={setVisibility} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-burgundy" checked={isRanked} onChange={(e) => setRanked(e.target.checked)} /> Numbered (ranked) list</label>
        </div>

        {!existing && (
          <div>
            <p className="meta mb-2">Books</p>
            <ul className="space-y-2">
              {books.map((b, i) => (
                <li key={`${b.id ?? b.olWorkId}-${i}`} className="flex items-center gap-3 border border-line bg-card p-2">
                  <BookCover title={b.title} authors={b.authors} coverUrl={b.coverUrl} size="xs" />
                  <span className="flex-1 truncate font-serif text-lg">{b.title}</span>
                  <button type="button" aria-label={`Remove ${b.title}`} onClick={() => setBooks(books.filter((_, j) => j !== i))} className="p-1 text-ink-faint hover:text-burgundy"><X className="size-4" /></button>
                </li>
              ))}
            </ul>
            <Button variant="paper" className="mt-2" onClick={() => setPicking(true)}>+ Add a book</Button>
            <p className="mt-1 text-xs text-ink-faint">You can add more, write notes and reorder after creating.</p>
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-3 border-t border-line pt-5">
          {existing ? (
            <Button variant="ghost" className="text-burgundy" disabled={pending} onClick={() => {
              if (!confirm("Delete this list? Its likes and comments go too.")) return;
              start(async () => {
                const res = await deleteListAction(existing.id);
                if (!res.ok) return toast(res.error, "error");
                toast("List deleted");
                router.push(`/u/${existing.owner.username}/lists`);
              });
            }}>Delete list</Button>
          ) : <span />}
          <Button type="submit" size="lg" variant="burgundy" disabled={pending || !title.trim()}>{pending ? "Saving…" : existing ? "Save list" : "Create list"}</Button>
        </div>
      </div>
      <div className="lg:sticky lg:top-8 lg:self-start">
        <p className="meta mb-2">Preview</p>
        <div className="paper overflow-hidden">
          <ListCover style={coverStyle} books={previewBooks} imageUrl={coverImageUrl} />
          <div className="p-4"><p className="font-serif text-xl leading-tight">{title || "Untitled list"}</p></div>
        </div>
      </div>
      <BookPicker open={picking} onClose={() => setPicking(false)} onPick={(b) => setBooks((list) => [...list, b])} suggestions={suggestions} title="Add a book" />
    </form>
  );
}
