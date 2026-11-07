import type { Metadata } from "next";
import { QuoteForm } from "@/components/quote/quote-form";
import { getStore, requireViewer } from "@/lib/auth";
import { lookupBook } from "@/lib/book-lookup";

export const metadata: Metadata = { title: "Add a highlight" };

export default async function NewQuotePage({ searchParams }: PageProps<"/quotes/new">) {
  const sp = await searchParams;
  const viewer = await requireViewer("/quotes/new");
  const store = await getStore();
  const [book, shelf, tags] = await Promise.all([
    typeof sp.book === "string" ? lookupBook(sp.book) : null,
    store.getShelf(viewer.id, { sort: "recent" }),
    store.marginaliaTags(12),
  ]);
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-8 text-4xl sm:text-5xl">Add a highlight</h1>
      <QuoteForm initialBook={book} suggestions={shelf.slice(0, 8).map((s) => s.book)} tagSuggestions={tags.map((t) => t.tag)} />
    </div>
  );
}
